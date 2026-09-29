import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrinspectorDb } from './db';
import { ingestRawEvent } from './ingest';
import { SECRET_MARKER } from './redact';
import type { RawCaptureEvent } from './types';

let db: BrinspectorDb;

beforeEach(() => {
  db = new BrinspectorDb(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

const raw: RawCaptureEvent = {
  type: 'network',
  url: 'https://app.example.com/login?email=budi@bri.co.id',
  timestamp: 5,
  network: {
    requestId: 'r',
    initiator: 'fetch',
    method: 'GET',
    url: 'https://app.example.com/api/me',
    requestHeaders: { Authorization: 'Bearer abc123' },
    requestBody: { state: 'none' },
    status: 401,
    statusText: 'Unauthorized',
    responseHeaders: {},
    responseBody: { state: 'captured', text: '{"error":"expired"}', contentType: 'application/json' },
    startedAt: 1,
    durationMs: 4,
  },
};

describe('ingestRawEvent', () => {
  it('stores the event redacted and classified in the tab session', async () => {
    const event = await ingestRawEvent(db, raw, 3, 'https://app.example.com/login');
    const stored = await db.events.get(event!.id);
    expect(stored?.network?.requestHeaders.Authorization).toBe(SECRET_MARKER);
    expect(JSON.stringify(stored)).not.toMatch(/abc123|budi@bri/);
    expect(stored?.classification).toBe('error');
    expect(stored?.redactedCount).toBe(2);
    const session = await db.sessions.get(stored!.sessionId);
    expect(session).toMatchObject({ tabId: 3, origin: 'https://app.example.com', state: 'active' });
  });

  it('ignores events from pages that cannot be monitored', async () => {
    expect(await ingestRawEvent(db, raw, 3, 'chrome://newtab')).toBeNull();
    expect(await db.events.count()).toBe(0);
  });

  it('classifies runtime errors as errors', async () => {
    const event = await ingestRawEvent(
      db,
      { type: 'runtime', url: 'https://app.example.com/', timestamp: 1, runtime: { source: 'exception', message: 'x' } },
      3,
      'https://app.example.com/',
    );
    expect(event?.classification).toBe('error');
    expect(event?.kind).toBe('runtime');
  });
});
