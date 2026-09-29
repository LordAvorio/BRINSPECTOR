import { browser } from 'wxt/browser';
import { LIMITS } from './constants';
import type { BrinspectorDb } from './db';
import { isMonitored } from './monitoring';
import { originOf } from './origin';
import { redactUrl } from './redact';
import { addEvent, addScreenshot, getOrCreateActiveSession, markScreenshotUnavailable } from './session';
import type { CaptureEvent } from './types';

/** Chrome allows about two captureVisibleTab calls per second. */
const MIN_CAPTURE_INTERVAL_MS = 550;
let lastCaptureAt = 0;

async function throttle(): Promise<void> {
  const wait = lastCaptureAt + MIN_CAPTURE_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCaptureAt = Date.now();
}

/** Takes a viewport screenshot of the tab and links it to the events, or marks them unavailable. */
export async function captureForEvents(db: BrinspectorDb, tabId: number, eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  const first = await db.events.get(eventIds[0]!);
  if (!first) return;
  try {
    const tab = await browser.tabs.get(tabId);
    if (!tab.active || tab.windowId === undefined) throw new Error('tab not visible');
    await throttle();
    const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: LIMITS.screenshotQuality,
    });
    await addScreenshot(
      db,
      {
        id: crypto.randomUUID(),
        sessionId: first.sessionId,
        takenAt: Date.now(),
        url: redactUrl(tab.url ?? first.url, { count: 0 }),
        dataUrl,
      },
      eventIds,
    );
  } catch {
    await markScreenshotUnavailable(db, eventIds);
  }
}

export class NotMonitoredError extends Error {}

/** "Capture now": records a manual event for the tab and screenshots it immediately. */
export async function captureNow(db: BrinspectorDb, tabId: number): Promise<CaptureEvent> {
  const tab = await browser.tabs.get(tabId);
  const origin = originOf(tab.url);
  if (!origin || !(await isMonitored(origin))) throw new NotMonitoredError('This site is not monitored');
  const session = await getOrCreateActiveSession(db, tabId, origin);
  const counter = { count: 0 };
  const event: CaptureEvent = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    tabId,
    kind: 'manual',
    url: redactUrl(tab.url!, counter),
    timestamp: Date.now(),
    classification: 'ok',
    screenshotStatus: 'pending',
    redactedCount: counter.count,
  };
  await addEvent(db, event);
  await captureForEvents(db, tabId, [event.id]);
  return (await db.events.get(event.id)) ?? event;
}
