import { classifyNetwork, classifyRuntime } from './classify';
import type { BrinspectorDb } from './db';
import { originOf } from './origin';
import { redactNetwork, redactRuntime, redactUrl, type Counter } from './redact';
import { addEvent, getOrCreateActiveSession } from './session';
import type { CaptureEvent, RawCaptureEvent } from './types';

/** Turns a validated page event into a stored event: redact first, then classify, then persist. */
export async function ingestRawEvent(
  db: BrinspectorDb,
  raw: RawCaptureEvent,
  tabId: number,
  senderUrl: string | undefined,
): Promise<CaptureEvent | null> {
  // The sender URL comes from the browser, not the page, so the page cannot pick which session it joins.
  const origin = originOf(senderUrl);
  if (!origin) return null;
  const session = await getOrCreateActiveSession(db, tabId, origin);

  const urlCounter: Counter = { count: 0 };
  const base = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    tabId,
    url: redactUrl(raw.url, urlCounter),
    timestamp: raw.timestamp,
    screenshotStatus: 'none' as const,
  };

  let event: CaptureEvent;
  if (raw.type === 'network') {
    const { network, count } = redactNetwork(raw.network);
    event = {
      ...base,
      kind: 'network',
      classification: classifyNetwork(network.status, network.failureReason),
      network,
      redactedCount: count + urlCounter.count,
    };
  } else {
    const { runtime, count } = redactRuntime(raw.runtime);
    event = {
      ...base,
      kind: 'runtime',
      classification: classifyRuntime(),
      runtime,
      redactedCount: count + urlCounter.count,
    };
  }

  await addEvent(db, event);
  return event;
}
