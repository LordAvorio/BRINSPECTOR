import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LIMITS } from './constants';
import { BrinspectorDb } from './db';
import {
  addEvent,
  addScreenshot,
  clearActiveSession,
  getOrCreateActiveSession,
  getSessionSummary,
  handleTabClosed,
  listRecentSessions,
  markScreenshotUnavailable,
  purgeAllSessions,
  purgeExpiredRecent,
} from './session';
import type { CaptureEvent } from './types';

let db: BrinspectorDb;

beforeEach(() => {
  db = new BrinspectorDb(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

const ORIGIN = 'https://app.example.com';

function event(sessionId: string, overrides: Partial<CaptureEvent> = {}): CaptureEvent {
  return {
    id: crypto.randomUUID(),
    sessionId,
    tabId: 1,
    kind: 'network',
    url: `${ORIGIN}/login`,
    timestamp: Date.now(),
    classification: 'ok',
    screenshotStatus: 'none',
    redactedCount: 0,
    ...overrides,
  };
}

describe('active sessions', () => {
  it('keeps one session across navigation in the same tab', async () => {
    const a = await getOrCreateActiveSession(db, 1, ORIGIN);
    await addEvent(db, event(a.id, { url: `${ORIGIN}/login` }));
    const b = await getOrCreateActiveSession(db, 1, ORIGIN);
    await addEvent(db, event(b.id, { url: `${ORIGIN}/dashboard` }));
    expect(b.id).toBe(a.id);
    const summary = await getSessionSummary(db, a.id);
    expect(summary?.events.map((e) => e.url)).toEqual([`${ORIGIN}/login`, `${ORIGIN}/dashboard`]);
  });

  it('gives separate tabs separate sessions', async () => {
    const a = await getOrCreateActiveSession(db, 1, ORIGIN);
    const b = await getOrCreateActiveSession(db, 2, ORIGIN);
    expect(a.id).not.toBe(b.id);
  });

  it('clears the session and starts a new empty one', async () => {
    const a = await getOrCreateActiveSession(db, 1, ORIGIN);
    await addEvent(db, event(a.id));
    const next = await clearActiveSession(db, 1);
    expect(next?.id).not.toBe(a.id);
    expect(await db.events.count()).toBe(0);
    expect((await getSessionSummary(db, next!.id))?.events).toHaveLength(0);
  });

  it('summarizes counts', async () => {
    const s = await getOrCreateActiveSession(db, 1, ORIGIN);
    await addEvent(db, event(s.id, { classification: 'error', redactedCount: 2 }));
    await addEvent(db, event(s.id, { kind: 'runtime', classification: 'error', redactedCount: 1 }));
    await addEvent(db, event(s.id));
    const summary = await getSessionSummary(db, s.id);
    expect(summary?.counts).toEqual({ errors: 2, network: 2, screenshots: 0, redacted: 3 });
  });
});

describe('bounded storage', () => {
  it('drops the oldest network events beyond the limit', async () => {
    const s = await getOrCreateActiveSession(db, 1, ORIGIN);
    for (let i = 0; i < LIMITS.maxNetworkEvents + 5; i++) {
      await addEvent(db, event(s.id, { id: `e${i}`, timestamp: i }));
    }
    const summary = await getSessionSummary(db, s.id);
    expect(summary?.counts.network).toBe(LIMITS.maxNetworkEvents);
    expect(summary?.events[0]!.id).toBe('e5');
  });

  it('drops the oldest screenshot and marks its events discarded', async () => {
    const s = await getOrCreateActiveSession(db, 1, ORIGIN);
    const first = event(s.id, { id: 'first' });
    await addEvent(db, first);
    for (let i = 0; i <= LIMITS.maxScreenshots; i++) {
      await addScreenshot(
        db,
        { id: `shot${i}`, sessionId: s.id, takenAt: i, url: first.url, dataUrl: 'data:' },
        i === 0 ? ['first'] : [],
      );
    }
    expect(await db.screenshots.count()).toBe(LIMITS.maxScreenshots);
    const stored = await db.events.get('first');
    expect(stored?.screenshotStatus).toBe('discarded');
    expect(stored?.screenshotId).toBeUndefined();
  });

  it('links screenshots and marks unavailable ones', async () => {
    const s = await getOrCreateActiveSession(db, 1, ORIGIN);
    await addEvent(db, event(s.id, { id: 'a' }));
    await addEvent(db, event(s.id, { id: 'b' }));
    await addScreenshot(db, { id: 'shot', sessionId: s.id, takenAt: 1, url: ORIGIN, dataUrl: 'data:' }, ['a']);
    await markScreenshotUnavailable(db, ['b']);
    expect((await db.events.get('a'))?.screenshotId).toBe('shot');
    expect((await db.events.get('b'))?.screenshotStatus).toBe('unavailable');
  });
});

describe('recent sessions', () => {
  it('keeps a closed tab session available as recent', async () => {
    const s = await getOrCreateActiveSession(db, 1, ORIGIN, 1000);
    await handleTabClosed(db, 1, 2000);
    const recent = await listRecentSessions(db, 2000 + LIMITS.recentTtlMs - 1);
    expect(recent.map((r) => r.id)).toEqual([s.id]);
    expect(recent[0]!.tabId).toBeNull();
  });

  it('deletes recent sessions after the TTL', async () => {
    const s = await getOrCreateActiveSession(db, 1, ORIGIN, 1000);
    await addEvent(db, event(s.id));
    await handleTabClosed(db, 1, 2000);
    await purgeExpiredRecent(db, 2000 + LIMITS.recentTtlMs);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.events.count()).toBe(0);
  });

  it('keeps at most the configured number of recent sessions', async () => {
    for (let tab = 1; tab <= LIMITS.maxRecentSessions + 1; tab++) {
      await getOrCreateActiveSession(db, tab, ORIGIN, tab);
      await handleTabClosed(db, tab, 100 + tab);
    }
    const recent = await listRecentSessions(db, 200);
    expect(recent).toHaveLength(LIMITS.maxRecentSessions);
    expect(recent.every((r) => r.closedAt !== 101)).toBe(true);
  });

  it('purges everything on restart', async () => {
    const s = await getOrCreateActiveSession(db, 1, ORIGIN);
    await addEvent(db, event(s.id));
    await purgeAllSessions(db);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.events.count()).toBe(0);
  });
});
