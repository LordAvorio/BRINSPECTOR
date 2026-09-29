import { describe, expect, it } from 'vitest';
import { LIMITS } from '../constants';
import type { CaptureEvent } from '../types';
import { buildAiPayload } from './payload';

let seq = 0;
function net(method: string, url: string, status: number, body = '', extra: Partial<CaptureEvent> = {}): CaptureEvent {
  seq++;
  return {
    id: `e${seq}`,
    sessionId: 's',
    tabId: 1,
    kind: 'network',
    url: 'https://a.com/page',
    timestamp: seq,
    classification: status >= 200 && status < 300 ? 'ok' : 'error',
    screenshotStatus: 'none',
    redactedCount: 0,
    network: {
      requestId: `r${seq}`,
      initiator: 'fetch',
      method,
      url,
      requestHeaders: {},
      requestBody: { state: 'none' },
      status,
      statusText: '',
      responseHeaders: {},
      responseBody: body ? { state: 'captured', text: body } : { state: 'none' },
      startedAt: 0,
      durationMs: 5,
    },
    ...extra,
  };
}

describe('buildAiPayload', () => {
  it('includes a repeated polling GET once with its occurrence count', () => {
    const events = Array.from({ length: 50 }, () => net('GET', 'https://a.com/api/status?t=1', 200));
    const payload = buildAiPayload('https://a.com', events, '');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]!.occurrences).toBe(50);
  });

  it('includes every error and every mutating request', () => {
    const events = [
      net('POST', 'https://a.com/api/transfer', 200, '{"success":false}'),
      net('POST', 'https://a.com/api/transfer', 200, '{"success":true}'),
      net('GET', 'https://a.com/api/x', 500),
      net('GET', 'https://a.com/api/x', 500),
    ];
    expect(buildAiPayload('https://a.com', events, '').items).toHaveLength(4);
  });

  it('includes runtime errors and skips manual captures', () => {
    const events: CaptureEvent[] = [
      { ...net('GET', 'https://a.com/', 200), kind: 'manual', network: undefined },
      {
        ...net('GET', 'https://a.com/', 200),
        kind: 'runtime',
        classification: 'error',
        network: undefined,
        runtime: { source: 'exception', message: 'TypeError: x' },
      },
    ];
    const payload = buildAiPayload('https://a.com', events, '');
    expect(payload.items.map((i) => i.kind)).toEqual(['runtime']);
  });

  it('truncates bodies and notes', () => {
    const body = 'x'.repeat(LIMITS.aiBodyMaxChars + 10);
    const payload = buildAiPayload('https://a.com', [net('POST', 'https://a.com/api', 200, body)], 'n'.repeat(600));
    expect(payload.items[0]!.responseBody).toHaveLength(LIMITS.aiBodyMaxChars + '...[truncated]'.length);
    expect(payload.notes).toHaveLength(LIMITS.notesMaxChars);
  });
});
