import { useState } from 'react';
import { LIMITS } from '../../lib/constants';
import type { AiResult } from '../../lib/ai/client';
import type { ReportStep } from '../../lib/report/generate';
import type { SessionSummary } from '../../lib/types';
import type { PopupApi } from './api';
import { Button, Panel } from './ui';

const STEP_LABEL: Record<ReportStep, string> = {
  loading: 'Memuat sesi...',
  ai: 'Meminta saran AI...',
  pdf: 'Menyusun PDF...',
  download: 'Mengunduh...',
  done: 'Selesai',
};

type ReportState =
  | { status: 'idle' }
  | { status: 'running'; step: ReportStep }
  | { status: 'done'; filename: string; ai: AiResult }
  | { status: 'failed'; error: string };

function useReport(api: PopupApi) {
  const [state, setState] = useState<ReportState>({ status: 'idle' });
  const [exported, setExported] = useState<string | null>(null);

  const generate = (sessionId: string, notes: string) => {
    setExported(null);
    setState({ status: 'running', step: 'loading' });
    api
      .generate(sessionId, notes, (step) => setState({ status: 'running', step }))
      .then((result) => setState({ status: 'done', filename: result.filename, ai: result.ai }))
      .catch((error: unknown) =>
        setState({ status: 'failed', error: error instanceof Error ? error.message : String(error) }),
      );
  };

  const exportJson = (sessionId: string, notes: string) => {
    api
      .exportJson(sessionId, notes)
      .then(setExported)
      .catch((error: unknown) => setState({ status: 'failed', error: String(error) }));
  };

  return { state, setState, generate, exportJson, exported };
}

function ReportStatus({
  state,
  exported,
  onRetry,
  onExport,
}: {
  state: ReportState;
  exported: string | null;
  onRetry: () => void;
  onExport: () => void;
}) {
  if (state.status === 'running') {
    return <p className="mt-1 font-mono text-code-sm text-primary-container">{STEP_LABEL[state.step]}</p>;
  }
  if (state.status === 'failed') {
    return (
      <div role="alert" className="mt-1 rounded border border-crimson/40 bg-crimson/10 p-1.5">
        <p className="text-body-sm text-crimson">Gagal membuat PDF: {state.error}</p>
        <div className="mt-1 flex gap-1">
          <Button variant="danger" onClick={onRetry}>
            Coba lagi
          </Button>
          <Button onClick={onExport}>Export JSON</Button>
        </div>
        {exported && <p className="mt-1 font-mono text-label-sm text-text-low">JSON diunduh: {exported}</p>}
      </div>
    );
  }
  if (state.status === 'done') {
    return (
      <div className="mt-1">
        <p className="font-mono text-code-sm text-emerald">Laporan diunduh: {state.filename}</p>
        {!state.ai.ok && (
          <p className="font-mono text-code-sm text-amber">Saran AI tidak tersedia: {state.ai.reason}</p>
        )}
      </div>
    );
  }
  return null;
}

export function ReportPanel({
  api,
  summary,
  tabId,
  canCapture,
  onChanged,
}: {
  api: PopupApi;
  summary: SessionSummary | undefined;
  tabId: number | null;
  canCapture: boolean;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState('');
  const { state, setState, generate, exportJson, exported } = useReport(api);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const empty = !summary || summary.events.length === 0;
  const sessionId = summary?.session.id;

  return (
    <Panel title="Laporan">
      <div className="mb-2 flex gap-1">
        <Button
          disabled={tabId === null || !canCapture}
          onClick={() => {
            if (tabId === null) return;
            setCaptureError(null);
            void api.captureNow(tabId).then((res) => {
              if (!res.ok) setCaptureError(res.error);
              onChanged();
            });
          }}
        >
          Capture now
        </Button>
        <Button
          variant="danger"
          disabled={tabId === null || empty}
          onClick={() => {
            if (tabId === null) return;
            void api.clearSession(tabId).then(() => {
              setState({ status: 'idle' });
              onChanged();
            });
          }}
        >
          Clear
        </Button>
      </div>
      {captureError && <p className="mb-1 text-body-sm text-crimson">{captureError}</p>}

      <label className="block">
        <span className="font-mono text-label-sm uppercase text-text-low">Catatan insiden (opsional)</span>
        <textarea
          value={notes}
          maxLength={LIMITS.notesMaxChars}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Mis. terjadi setelah klik tombol Transfer dengan saldo kosong"
          className="mt-0.5 w-full resize-none rounded border border-hairline bg-base p-1.5 font-mono text-code-md text-text-high placeholder:text-text-low focus:border-primary-container focus:outline-none"
        />
        <span className="block text-right font-mono text-label-sm text-text-low">
          {notes.length} / {LIMITS.notesMaxChars}
        </span>
      </label>

      <Button
        variant="primary"
        disabled={empty || state.status === 'running'}
        onClick={() => sessionId && generate(sessionId, notes)}
      >
        Generate Report
      </Button>

      <ReportStatus
        state={state}
        exported={exported}
        onRetry={() => sessionId && generate(sessionId, notes)}
        onExport={() => sessionId && exportJson(sessionId, notes)}
      />

      {state.status === 'done' && tabId !== null && (
        <div className="mt-1 flex items-center gap-1">
          <span className="text-body-sm">Mulai sesi baru?</span>
          <Button
            onClick={() =>
              void api.clearSession(tabId).then(() => {
                setNotes('');
                setState({ status: 'idle' });
                onChanged();
              })
            }
          >
            Ya
          </Button>
          <Button onClick={() => setState({ status: 'idle' })}>Tidak</Button>
        </div>
      )}
    </Panel>
  );
}

function RecentRow({ api, summary, onChanged }: { api: PopupApi; summary: SessionSummary; onChanged: () => void }) {
  const { state, generate, exportJson, exported } = useReport(api);
  const id = summary.session.id;
  return (
    <li className="py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate font-mono text-code-sm">{summary.session.origin}</span>
          <span className="block font-mono text-label-sm text-text-low">
            ditutup {new Date(summary.session.closedAt ?? 0).toLocaleTimeString('id-ID')} - {summary.counts.errors} error
          </span>
        </span>
        <Button
          disabled={state.status === 'running' || state.status === 'done' || summary.events.length === 0}
          onClick={() => generate(id, '')}
        >
          Generate
        </Button>
      </div>
      <ReportStatus
        state={state}
        exported={exported}
        onRetry={() => generate(id, '')}
        onExport={() => exportJson(id, '')}
      />
      {state.status === 'done' && (
        <button type="button" className="font-mono text-label-sm text-text-low underline" onClick={onChanged}>
          Tutup
        </button>
      )}
    </li>
  );
}

export function RecentSessions({ api, recent, onChanged }: { api: PopupApi; recent: SessionSummary[]; onChanged: () => void }) {
  if (recent.length === 0) return null;
  return (
    <Panel title="Sesi baru ditutup">
      <ul className="divide-y divide-raised">
        {recent.map((summary) => (
          <RecentRow key={summary.session.id} api={api} summary={summary} onChanged={onChanged} />
        ))}
      </ul>
    </Panel>
  );
}
