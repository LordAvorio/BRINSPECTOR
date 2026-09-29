import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenshotScheduler, shouldTriggerScreenshot, type CaptureBatch } from './scheduler';
import type { CaptureEvent } from './types';

function event(overrides: Partial<CaptureEvent>): CaptureEvent {
  return {
    id: 'e',
    sessionId: 's',
    tabId: 1,
    kind: 'network',
    url: 'https://a.com/',
    timestamp: 0,
    classification: 'ok',
    screenshotStatus: 'none',
    redactedCount: 0,
    ...overrides,
  };
}

function network(method: string, classification: 'ok' | 'error' = 'ok') {
  return event({
    classification,
    network: {
      requestId: 'r',
      initiator: 'fetch',
      method,
      url: 'https://a.com/api',
      requestHeaders: {},
      requestBody: { state: 'none' },
      status: classification === 'ok' ? 200 : 500,
      statusText: '',
      responseHeaders: {},
      responseBody: { state: 'none' },
      startedAt: 0,
      durationMs: 1,
    },
  });
}

describe('shouldTriggerScreenshot', () => {
  it('triggers on failed requests', () => expect(shouldTriggerScreenshot(network('GET', 'error'))).toBe(true));
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('triggers on successful %s', (m) =>
    expect(shouldTriggerScreenshot(network(m))).toBe(true),
  );
  it('does not trigger on successful GET', () => expect(shouldTriggerScreenshot(network('GET'))).toBe(false));
  it('triggers on runtime errors', () =>
    expect(shouldTriggerScreenshot(event({ kind: 'runtime', classification: 'error' }))).toBe(true));
  it('triggers on manual capture', () => expect(shouldTriggerScreenshot(event({ kind: 'manual' }))).toBe(true));
});

describe('ScreenshotScheduler', () => {
  let capture: ReturnType<typeof vi.fn<CaptureBatch>>;
  let scheduler: ScreenshotScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    capture = vi.fn<CaptureBatch>(async () => {});
    scheduler = new ScreenshotScheduler(capture, () => Date.now(), 500, 2000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for the idle window after the last request ends', () => {
    scheduler.requestStarted(1, 'a');
    scheduler.trigger(1, 'e1');
    scheduler.requestEnded(1, 'a');
    scheduler.requestStarted(1, 'b');
    vi.advanceTimersByTime(400);
    scheduler.requestEnded(1, 'b');
    vi.advanceTimersByTime(499);
    expect(capture).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(capture).toHaveBeenCalledWith(1, ['e1']);
  });

  it('shares one screenshot across a burst of triggers', () => {
    scheduler.trigger(1, 'e1');
    vi.advanceTimersByTime(100);
    scheduler.trigger(1, 'e2');
    scheduler.trigger(1, 'e3');
    vi.advanceTimersByTime(500);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(1, ['e1', 'e2', 'e3']);
  });

  it('fires at the maximum wait when requests never settle', () => {
    scheduler.requestStarted(1, 'poll');
    scheduler.trigger(1, 'e1');
    vi.advanceTimersByTime(1999);
    expect(capture).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(capture).toHaveBeenCalledWith(1, ['e1']);
  });

  it('keeps tabs independent', () => {
    scheduler.requestStarted(2, 'x');
    scheduler.trigger(1, 'e1');
    scheduler.trigger(2, 'e2');
    vi.advanceTimersByTime(500);
    expect(capture).toHaveBeenCalledWith(1, ['e1']);
    expect(capture).not.toHaveBeenCalledWith(2, ['e2']);
  });

  it('drops pending work when a tab closes', () => {
    scheduler.trigger(1, 'e1');
    scheduler.tabClosed(1);
    vi.advanceTimersByTime(5000);
    expect(capture).not.toHaveBeenCalled();
  });
});
