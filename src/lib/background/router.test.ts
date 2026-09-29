import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrinspectorDb } from '../db';
import { ScreenshotScheduler } from '../scheduler';
import type { RawCaptureEvent } from '../types';
import { handleCaptureMessage, type RouterContext } from './router';

let db: BrinspectorDb;
let ctx: RouterContext;
let capture: ReturnType<typeof vi.fn>;

beforeEach(() => {
  db = new BrinspectorDb(`test-${crypto.randomUUID()}`);
  capture = vi.fn(async () => {});
  // Real timers with short windows: fake timers would also stall fake-indexeddb.
  ctx = { db, scheduler: new ScreenshotScheduler(capture as never, () => Date.now(), 20, 100) };
});

afterEach(async () => {
  await db.delete();
});

const sender = { tab: { id: 4 }, url: 'https://app.example.com/transfer' };

function network(method: string, status: number): RawCaptureEvent {
  return {
    type: 'network',
    url: 'https://app.example.com/transfer',
    timestamp: 1,
    network: {
      requestId: 'r1',
      initiator: 'fetch',
      method,
      url: 'https://app.example.com/api',
      requestHeaders: {},
      requestBody: { state: 'none' },
      status,
      statusText: '',
      responseHeaders: {},
      responseBody: { state: 'none' },
      startedAt: 0,
      durationMs: 1,
    },
  };
}

describe('handleCaptureMessage', () => {
  it('stores a POST and schedules a screenshot once the page is idle', async () => {
    await handleCaptureMessage(ctx, { type: 'capture', message: { type: 'request-start', requestId: 'r1' } }, sender);
    await handleCaptureMessage(ctx, { type: 'capture', message: network('POST', 200) }, sender);
    await handleCaptureMessage(ctx, { type: 'capture', message: { type: 'request-end', requestId: 'r1' } }, sender);
    const [stored] = await db.events.toArray();
    expect(stored?.screenshotStatus).toBe('pending');
    await vi.waitFor(() => expect(capture).toHaveBeenCalledWith(4, [stored!.id]));
  });

  it('stores a successful GET without scheduling a screenshot', async () => {
    await handleCaptureMessage(ctx, { type: 'capture', message: network('GET', 200) }, sender);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await db.events.count()).toBe(1);
    expect(capture).not.toHaveBeenCalled();
  });

  it('drops malformed messages and messages without a tab', async () => {
    await handleCaptureMessage(ctx, { type: 'capture', message: { type: 'network', url: 1 } }, sender);
    await handleCaptureMessage(ctx, { type: 'capture', message: network('GET', 500) }, { url: sender.url });
    expect(await db.events.count()).toBe(0);
  });
});
