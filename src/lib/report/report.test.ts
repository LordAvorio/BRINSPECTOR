import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiResult } from '../ai/client';
import { mergeSuggestions } from '../ai/merge';
import { BrinspectorDb } from '../db';
import { addEvent, addScreenshot, getOrCreateActiveSession, handleTabClosed } from '../session';
import type { CaptureEvent, Session } from '../types';
import { buildReportDocument } from './document';
import { exportSessionJson, generateReport, type GenerateDeps } from './generate';
import { reportFilename, sessionToJson } from './render';

let db: BrinspectorDb;

beforeEach(() => {
  db = new BrinspectorDb(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

const ORIGIN = 'https://app.example.com';

function netEvent(session: Session, overrides: Partial<CaptureEvent> & { status: number; method?: string; body?: string }): CaptureEvent {
  const { status, method = 'GET', body, ...rest } = overrides;
  return {
    id: crypto.randomUUID(),
    sessionId: session.id,
    tabId: 1,
    kind: 'network',
    url: `${ORIGIN}/transfer`,
    timestamp: Date.now(),
    classification: status >= 200 && status < 300 ? 'ok' : 'error',
    screenshotStatus: 'none',
    redactedCount: 1,
    network: {
      requestId: 'r',
      initiator: 'fetch',
      method,
      url: `${ORIGIN}/api/transfer`,
      requestHeaders: {},
      requestBody: { state: 'none' },
      status,
      statusText: '',
      responseHeaders: {},
      responseBody: body ? { state: 'captured', text: body } : { state: 'none' },
      startedAt: 0,
      durationMs: 42,
    },
    ...rest,
  };
}

function flatten(doc: unknown): string {
  return JSON.stringify(doc);
}

describe('buildReportDocument', () => {
  it('groups by URL and shows request details, screenshot, and AI suggestion', async () => {
    const session = await getOrCreateActiveSession(db, 1, ORIGIN);
    const error = netEvent(session, { status: 500, screenshotId: 'shot', screenshotStatus: 'captured' });
    const ok = netEvent(session, { status: 200, url: `${ORIGIN}/home`, body: '{"secret":"never-printed"}' });
    const doc = buildReportDocument({
      session,
      counts: { errors: 1, network: 2, screenshots: 1, redacted: 2 },
      items: mergeSuggestions(
        [error, ok],
        [{ eventId: error.id, isHiddenFailure: false, rootCause: 'Gateway timeout', suggestedFix: 'Naikkan timeout', severity: 'high' }],
      ),
      screenshots: new Map([['shot', 'data:image/jpeg;base64,AAA']]),
      notes: 'Terjadi setelah klik bayar',
      ai: { ok: true, suggestions: [] },
      generatedAt: new Date(2026, 8, 29, 14, 30),
    });
    const text = flatten(doc);
    expect(text).toContain(`${ORIGIN}/transfer`);
    expect(text).toContain(`${ORIGIN}/home`);
    expect(text).toContain('GET https://app.example.com/api/transfer -> 500');
    expect(text).toContain('data:image/jpeg;base64,AAA');
    expect(text).toContain('Gateway timeout');
    expect(text).toContain('Naikkan timeout');
    expect(text).toContain('Terjadi setelah klik bayar');
    expect(text).toContain('best-effort');
    // ok events are compact: no bodies
    expect(text).not.toContain('never-printed');
  });

  it('shows an unavailable screenshot and the AI failure reason', async () => {
    const session = await getOrCreateActiveSession(db, 1, ORIGIN);
    const error = netEvent(session, { status: 404, screenshotStatus: 'unavailable' });
    const text = flatten(
      buildReportDocument({
        session,
        counts: { errors: 1, network: 1, screenshots: 0, redacted: 0 },
        items: mergeSuggestions([error], []),
        screenshots: new Map(),
        notes: '',
        ai: { ok: false, reason: 'AI service timed out' },
        generatedAt: new Date(),
      }),
    );
    expect(text).toContain('Screenshot tidak tersedia');
    expect(text).toContain('Tidak tersedia: AI service timed out');
  });

  it('keeps captured markup as literal text', async () => {
    const session = await getOrCreateActiveSession(db, 1, ORIGIN);
    const error = netEvent(session, { status: 500, body: '<img src=x onerror=alert(1)>' });
    const text = flatten(
      buildReportDocument({
        session,
        counts: { errors: 1, network: 1, screenshots: 0, redacted: 0 },
        items: mergeSuggestions([error], []),
        screenshots: new Map(),
        notes: '',
        ai: { ok: true, suggestions: [] },
        generatedAt: new Date(),
      }),
    );
    expect(text).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('render helpers', () => {
  it('names the file with host and timestamp', () => {
    expect(reportFilename('https://app.example.com', new Date(2026, 8, 29, 14, 30))).toBe(
      'brinspector-app.example.com-20260929-1430.pdf',
    );
    expect(reportFilename('http://localhost:3000', new Date(2026, 0, 2, 3, 4), 'json')).toBe(
      'brinspector-localhost-3000-20260102-0304.json',
    );
  });

  it('exports the redacted session as JSON', async () => {
    const session = await getOrCreateActiveSession(db, 1, ORIGIN);
    const event = netEvent(session, { status: 500 });
    const json = JSON.parse(
      sessionToJson({ session, events: [event], counts: { errors: 1, network: 1, screenshots: 0, redacted: 1 } }, 'n'),
    );
    expect(json).toMatchObject({ notes: 'n', counts: { errors: 1 }, events: [{ id: event.id }] });
  });
});

describe('generateReport', () => {
  function deps(ai: AiResult | Error): GenerateDeps & { downloaded: string[] } {
    const downloaded: string[] = [];
    return {
      downloaded,
      requestAi: vi.fn(async () => {
        if (ai instanceof Error) throw ai;
        return ai;
      }),
      render: vi.fn(async () => new Blob(['%PDF'])),
      download: (_blob, filename) => downloaded.push(filename),
      now: () => new Date(2026, 8, 29, 14, 30),
    };
  }

  it('still produces a PDF with a notice when AI fails', async () => {
    const session = await getOrCreateActiveSession(db, 1, ORIGIN);
    await addEvent(db, netEvent(session, { status: 500 }));
    const d = deps({ ok: false, reason: 'AI service timed out' });
    const steps: string[] = [];
    const result = await generateReport(db, session.id, '', (s) => steps.push(s), d);
    expect(result.ai).toEqual({ ok: false, reason: 'AI service timed out' });
    expect(d.downloaded).toEqual(['brinspector-app.example.com-20260929-1430.pdf']);
    expect(flatten((d.render as ReturnType<typeof vi.fn>).mock.calls[0]![0])).toContain('AI service timed out');
    expect(steps).toEqual(['loading', 'ai', 'pdf', 'download', 'done']);
  });

  it('tolerates a thrown AI error', async () => {
    const session = await getOrCreateActiveSession(db, 1, ORIGIN);
    await addEvent(db, netEvent(session, { status: 500 }));
    const result = await generateReport(db, session.id, '', undefined, deps(new Error('offline')));
    expect(result.ai.ok).toBe(false);
  });

  it('includes screenshots and promotes AI-detected hidden failures', async () => {
    const session = await getOrCreateActiveSession(db, 1, ORIGIN);
    const post = netEvent(session, { status: 200, method: 'POST', body: '{"success":false,"message":"Saldo tidak cukup"}' });
    await addEvent(db, post);
    await addScreenshot(db, { id: 'shot', sessionId: session.id, takenAt: 1, url: ORIGIN, dataUrl: 'data:image/jpeg;base64,ZZZ' }, [post.id]);
    const d = deps({
      ok: true,
      suggestions: [{ eventId: post.id, isHiddenFailure: true, rootCause: 'Saldo kurang', suggestedFix: 'Cek saldo', severity: 'medium' }],
    });
    await generateReport(db, session.id, '', undefined, d);
    const text = flatten((d.render as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    expect(text).toContain('TERDETEKSI AI');
    expect(text).toContain('data:image/jpeg;base64,ZZZ');
    expect(text).toContain('Saldo tidak cukup');
  });

  it('deletes a recent session after reporting it but keeps an active one', async () => {
    const active = await getOrCreateActiveSession(db, 1, ORIGIN);
    await addEvent(db, netEvent(active, { status: 500 }));
    await generateReport(db, active.id, '', undefined, deps({ ok: true, suggestions: [] }));
    expect(await db.sessions.get(active.id)).toBeDefined();

    await handleTabClosed(db, 1);
    await generateReport(db, active.id, '', undefined, deps({ ok: true, suggestions: [] }));
    expect(await db.sessions.get(active.id)).toBeUndefined();
  });

  it('refuses an empty session', async () => {
    const session = await getOrCreateActiveSession(db, 1, ORIGIN);
    await expect(generateReport(db, session.id, '', undefined, deps({ ok: true, suggestions: [] }))).rejects.toThrow(
      'Sesi kosong',
    );
  });

  it('exports JSON as a fallback', async () => {
    const session = await getOrCreateActiveSession(db, 1, ORIGIN);
    await addEvent(db, netEvent(session, { status: 500 }));
    const d = deps({ ok: true, suggestions: [] });
    expect(await exportSessionJson(db, session.id, '', d)).toBe('brinspector-app.example.com-20260929-1430.json');
    expect(d.downloaded).toHaveLength(1);
  });
});
