import Dexie from 'dexie';
import { LIMITS } from './constants';
import type { BrinspectorDb } from './db';
import type { CaptureEvent, Screenshot, Session, SessionSummary } from './types';

export async function findActiveSession(db: BrinspectorDb, tabId: number): Promise<Session | undefined> {
  return db.sessions.where('tabId').equals(tabId).and((s) => s.state === 'active').first();
}

/** Returns the tab's active session, starting one if needed; a different origin starts a new session. */
export async function getOrCreateActiveSession(
  db: BrinspectorDb,
  tabId: number,
  origin: string,
  now = Date.now(),
): Promise<Session> {
  return db.transaction('rw', db.sessions, db.events, db.screenshots, async () => {
    const existing = await findActiveSession(db, tabId);
    if (existing && existing.origin === origin) return existing;
    if (existing) await moveToRecent(db, existing, now);
    const session: Session = { id: crypto.randomUUID(), tabId, origin, state: 'active', startedAt: now };
    await db.sessions.add(session);
    return session;
  });
}

async function moveToRecent(db: BrinspectorDb, session: Session, now: number): Promise<void> {
  await db.sessions.update(session.id, { state: 'recent', tabId: null, closedAt: now });
  const recent = await db.sessions.where('state').equals('recent').sortBy('closedAt');
  const excess = recent.length - LIMITS.maxRecentSessions;
  for (const old of recent.slice(0, Math.max(0, excess))) await deleteSession(db, old.id);
}

export async function addEvent(db: BrinspectorDb, event: CaptureEvent): Promise<void> {
  await db.transaction('rw', db.events, async () => {
    await db.events.add(event);
    if (event.kind !== 'network') return;
    const range = db.events
      .where('[sessionId+kind+timestamp]')
      .between([event.sessionId, 'network', Dexie.minKey], [event.sessionId, 'network', Dexie.maxKey]);
    const excess = (await range.clone().count()) - LIMITS.maxNetworkEvents;
    if (excess > 0) await db.events.bulkDelete(await range.limit(excess).primaryKeys());
  });
}

/** Stores a screenshot, links it to the triggering events, and drops the oldest beyond the limit. */
export async function addScreenshot(db: BrinspectorDb, screenshot: Screenshot, eventIds: string[]): Promise<void> {
  await db.transaction('rw', db.events, db.screenshots, async () => {
    await db.screenshots.add(screenshot);
    await db.events
      .where('id')
      .anyOf(eventIds)
      .modify({ screenshotId: screenshot.id, screenshotStatus: 'captured' });
    const all = await db.screenshots
      .where('[sessionId+takenAt]')
      .between([screenshot.sessionId, Dexie.minKey], [screenshot.sessionId, Dexie.maxKey])
      .toArray();
    const excess = all.length - LIMITS.maxScreenshots;
    for (const old of all.slice(0, Math.max(0, excess))) {
      await db.screenshots.delete(old.id);
      await db.events.where('screenshotId').equals(old.id).modify({ screenshotId: undefined, screenshotStatus: 'discarded' });
    }
  });
}

export async function markScreenshotUnavailable(db: BrinspectorDb, eventIds: string[]): Promise<void> {
  await db.events.where('id').anyOf(eventIds).modify({ screenshotStatus: 'unavailable' });
}

export async function deleteSession(db: BrinspectorDb, sessionId: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.events, db.screenshots, async () => {
    await db.events.where('sessionId').equals(sessionId).delete();
    await db.screenshots.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

/** Deletes the tab's session data and starts a new empty session for the same origin. */
export async function clearActiveSession(db: BrinspectorDb, tabId: number, now = Date.now()): Promise<Session | undefined> {
  const active = await findActiveSession(db, tabId);
  if (!active) return undefined;
  await deleteSession(db, active.id);
  return getOrCreateActiveSession(db, tabId, active.origin, now);
}

export async function handleTabClosed(db: BrinspectorDb, tabId: number, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.sessions, db.events, db.screenshots, async () => {
    const active = await findActiveSession(db, tabId);
    if (active) await moveToRecent(db, active, now);
  });
}

export async function purgeExpiredRecent(db: BrinspectorDb, now = Date.now()): Promise<void> {
  const expired = await db.sessions
    .where('state')
    .equals('recent')
    .filter((s) => (s.closedAt ?? 0) + LIMITS.recentTtlMs <= now)
    .toArray();
  for (const session of expired) await deleteSession(db, session.id);
}

export async function purgeAllSessions(db: BrinspectorDb): Promise<void> {
  await db.transaction('rw', db.sessions, db.events, db.screenshots, async () => {
    await Promise.all([db.sessions.clear(), db.events.clear(), db.screenshots.clear()]);
  });
}

export async function listRecentSessions(db: BrinspectorDb, now = Date.now()): Promise<Session[]> {
  await purgeExpiredRecent(db, now);
  const recent = await db.sessions.where('state').equals('recent').sortBy('closedAt');
  return recent.reverse();
}

export async function getSessionSummary(db: BrinspectorDb, sessionId: string): Promise<SessionSummary | undefined> {
  const session = await db.sessions.get(sessionId);
  if (!session) return undefined;
  const events = await db.events
    .where('[sessionId+timestamp]')
    .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
    .toArray();
  const screenshots = await db.screenshots.where('sessionId').equals(sessionId).count();
  return {
    session,
    events,
    counts: {
      errors: events.filter((e) => e.classification === 'error').length,
      network: events.filter((e) => e.kind === 'network').length,
      screenshots,
      redacted: events.reduce((sum, e) => sum + e.redactedCount, 0),
    },
  };
}
