import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionSummary } from '../../lib/types';
import type { PopupApi } from './api';
import { App } from './App';

afterEach(cleanup);

const ORIGIN = 'https://app.example.com';

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    session: { id: 's1', tabId: 1, origin: ORIGIN, state: 'active', startedAt: 0 },
    events: [],
    counts: { errors: 0, network: 0, screenshots: 0, redacted: 0 },
    ...overrides,
  };
}

const errorSummary = summary({
  events: [
    {
      id: 'e1',
      sessionId: 's1',
      tabId: 1,
      kind: 'network',
      url: `${ORIGIN}/transfer`,
      timestamp: 1,
      classification: 'error',
      screenshotStatus: 'captured',
      redactedCount: 3,
      network: {
        requestId: 'r',
        initiator: 'fetch',
        method: 'POST',
        url: `${ORIGIN}/api/transfer`,
        requestHeaders: {},
        requestBody: { state: 'none' },
        status: 500,
        statusText: '',
        responseHeaders: {},
        responseBody: { state: 'none' },
        startedAt: 0,
        durationMs: 1,
      },
    },
    {
      id: 'e2',
      sessionId: 's1',
      tabId: 1,
      kind: 'runtime',
      url: `${ORIGIN}/home`,
      timestamp: 2,
      classification: 'error',
      screenshotStatus: 'none',
      redactedCount: 0,
      runtime: { source: 'console', message: '<img src=x onerror=alert(1)>' },
    },
  ],
  counts: { errors: 2, network: 1, screenshots: 1, redacted: 3 },
});

function fakeApi(overrides: Partial<PopupApi> = {}): PopupApi {
  let monitored: string[] = [];
  return {
    getActiveTab: vi.fn(async () => ({ id: 1, url: `${ORIGIN}/transfer` })),
    isMonitored: vi.fn(async (o: string) => monitored.includes(o)),
    listMonitored: vi.fn(async () => monitored),
    requestMonitoring: vi.fn(async (o: string) => {
      monitored = [o];
      return true;
    }),
    stopMonitoring: vi.fn(async (o: string) => {
      monitored = monitored.filter((m) => m !== o);
    }),
    reloadTab: vi.fn(async () => {}),
    getActiveSummary: vi.fn(async () => undefined),
    listRecent: vi.fn(async () => []),
    captureNow: vi.fn(async () => ({ ok: true as const })),
    clearSession: vi.fn(async () => {}),
    generate: vi.fn(async () => ({ filename: 'brinspector-x.pdf', ai: { ok: true as const, suggestions: [] } })),
    exportJson: vi.fn(async () => 'brinspector-x.json'),
    ...overrides,
  };
}

async function renderApp(api: PopupApi) {
  await act(async () => {
    render(<App api={api} />);
  });
}

describe('monitoring section', () => {
  it('requests access for the exact origin and offers a reload', async () => {
    const api = fakeApi();
    await renderApp(api);
    const toggle = (await screen.findByRole('switch', { name: 'Monitor situs ini' })) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(api.requestMonitoring).toHaveBeenCalledWith(ORIGIN);
    fireEvent.click(await screen.findByRole('button', { name: 'Muat ulang' }));
    expect(api.reloadTab).toHaveBeenCalledWith(1);
  });

  it('explains a denied permission', async () => {
    const api = fakeApi({ requestMonitoring: vi.fn(async () => false) });
    await renderApp(api);
    fireEvent.click(await screen.findByRole('switch'));
    expect(await screen.findByText('Izin ditolak: situs ini tidak dimonitor.')).toBeTruthy();
  });

  it('disables monitoring on unsupported pages', async () => {
    await renderApp(fakeApi({ getActiveTab: vi.fn(async () => ({ id: 1, url: 'chrome://extensions' })) }));
    expect(await screen.findByText(/Halaman ini tidak bisa dimonitor/)).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('lists monitored sites and removes one', async () => {
    const api = fakeApi({ listMonitored: vi.fn(async () => [ORIGIN, 'http://localhost:3000']) });
    await renderApp(api);
    fireEvent.click(await screen.findByText('Situs dimonitor (2)'));
    fireEvent.click(screen.getByTitle('Hapus http://localhost:3000'));
    expect(api.stopMonitoring).toHaveBeenCalledWith('http://localhost:3000');
  });
});

describe('timeline', () => {
  it('groups events by URL and renders captured markup as plain text', async () => {
    const api = fakeApi({
      listMonitored: vi.fn(async () => [ORIGIN]),
      getActiveSummary: vi.fn(async () => errorSummary),
    });
    const { container } = render(<App api={api} />);
    expect(await screen.findByText(`${ORIGIN}/transfer`)).toBeTruthy();
    expect(screen.getByText(`${ORIGIN}/home`)).toBeTruthy();
    expect(screen.getByText('POST /api/transfer 500')).toBeTruthy();
    expect(screen.getAllByText('<img src=x onerror=alert(1)>').length).toBeGreaterThan(0);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('3 nilai sensitif diredaksi')).toBeTruthy();
  });
});

describe('report actions', () => {
  const monitoredApi = (overrides: Partial<PopupApi> = {}) =>
    fakeApi({ listMonitored: vi.fn(async () => [ORIGIN]), ...overrides });

  it('disables Generate Report for an empty session but allows Capture now', async () => {
    const api = monitoredApi({ getActiveSummary: vi.fn(async () => summary()) });
    await renderApp(api);
    const generate = (await screen.findByRole('button', { name: 'Generate Report' })) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Capture now' }));
    expect(api.captureNow).toHaveBeenCalledWith(1);
  });

  it('shows failure with Retry and Export JSON', async () => {
    const api = monitoredApi({
      getActiveSummary: vi.fn(async () => errorSummary),
      generate: vi.fn(async () => {
        throw new Error('pdf broke');
      }),
    });
    await renderApp(api);
    fireEvent.change(await screen.findByPlaceholderText(/Mis. terjadi/), { target: { value: 'catatan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Gagal membuat PDF: pdf broke');
    expect(api.generate).toHaveBeenCalledWith('s1', 'catatan', expect.any(Function));
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    await waitFor(() => expect(api.exportJson).toHaveBeenCalledWith('s1', 'catatan'));
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(api.generate).toHaveBeenCalledTimes(2);
  });

  it('notes missing AI suggestions and offers a new session', async () => {
    const api = monitoredApi({
      getActiveSummary: vi.fn(async () => errorSummary),
      generate: vi.fn(async () => ({ filename: 'r.pdf', ai: { ok: false as const, reason: 'AI service timed out' } })),
    });
    await renderApp(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Generate Report' }));
    expect(await screen.findByText('Saran AI tidak tersedia: AI service timed out')).toBeTruthy();
    expect(screen.getByText('Laporan diunduh: r.pdf')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ya' }));
    await waitFor(() => expect(api.clearSession).toHaveBeenCalledWith(1));
  });

  it('lists recently closed sessions with their own Generate action', async () => {
    const recent = summary({
      session: { id: 'old', tabId: null, origin: ORIGIN, state: 'recent', startedAt: 0, closedAt: 1 },
      events: errorSummary.events,
      counts: errorSummary.counts,
    });
    const api = fakeApi({ listRecent: vi.fn(async () => [recent]) });
    await renderApp(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Generate' }));
    expect(api.generate).toHaveBeenCalledWith('old', '', expect.any(Function));
  });
});
