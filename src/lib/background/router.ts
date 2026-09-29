import type { BrinspectorDb } from '../db';
import { ingestRawEvent } from '../ingest';
import { parseRawMessage } from '../protocol';
import type { ScreenshotScheduler } from '../scheduler';
import { shouldTriggerScreenshot } from '../scheduler';
import { captureNow } from '../screenshot';

export interface PopupRequest {
  type: 'capture-now';
  tabId: number;
}

export type PopupResponse = { ok: true } | { ok: false; error: string };

export interface RouterContext {
  db: BrinspectorDb;
  scheduler: ScreenshotScheduler;
}

export interface MessageSender {
  tab?: { id?: number };
  url?: string;
  id?: string;
}

/** Handles a page capture message relayed by the content script. */
export async function handleCaptureMessage(ctx: RouterContext, payload: unknown, sender: MessageSender): Promise<void> {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;
  const message = parseRawMessage((payload as { message?: unknown })?.message);
  if (!message) return;
  if (message.type === 'request-start') return ctx.scheduler.requestStarted(tabId, message.requestId);
  if (message.type === 'request-end') return ctx.scheduler.requestEnded(tabId, message.requestId);
  const event = await ingestRawEvent(ctx.db, message, tabId, sender.url);
  if (event && shouldTriggerScreenshot(event)) {
    await ctx.db.events.update(event.id, { screenshotStatus: 'pending' });
    ctx.scheduler.trigger(tabId, event.id);
  }
}

export async function handlePopupRequest(ctx: RouterContext, request: PopupRequest): Promise<PopupResponse> {
  try {
    await captureNow(ctx.db, request.tabId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
