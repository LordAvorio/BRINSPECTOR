import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { readAiConfig, requestSuggestions, type AiResult } from '../ai/client';
import { mergeSuggestions } from '../ai/merge';
import { buildAiPayload } from '../ai/payload';
import type { BrinspectorDb } from '../db';
import { deleteSession, getSessionSummary } from '../session';
import { buildReportDocument } from './document';
import { renderPdf, reportFilename, sessionToJson, triggerDownload } from './render';

export type ReportStep = 'loading' | 'ai' | 'pdf' | 'download' | 'done';

export interface GenerateDeps {
  requestAi: (payload: ReturnType<typeof buildAiPayload>) => Promise<AiResult>;
  render: (doc: TDocumentDefinitions) => Promise<Blob>;
  download: (blob: Blob, filename: string) => void;
  now: () => Date;
}

export const defaultDeps: GenerateDeps = {
  requestAi: (payload) => requestSuggestions(payload, readAiConfig()),
  render: renderPdf,
  download: triggerDownload,
  now: () => new Date(),
};

export interface GenerateResult {
  filename: string;
  ai: AiResult;
}

/** Loads the session, asks the AI (failure is tolerated), renders the PDF, and downloads it. */
export async function generateReport(
  db: BrinspectorDb,
  sessionId: string,
  notes: string,
  onStep: (step: ReportStep) => void = () => {},
  deps: GenerateDeps = defaultDeps,
): Promise<GenerateResult> {
  onStep('loading');
  const summary = await getSessionSummary(db, sessionId);
  if (!summary || summary.events.length === 0) throw new Error('Sesi kosong: tidak ada yang bisa dilaporkan');

  onStep('ai');
  const ai = await deps
    .requestAi(buildAiPayload(summary.session.origin, summary.events, notes))
    .catch((error: unknown): AiResult => ({ ok: false, reason: String(error) }));

  onStep('pdf');
  const screenshots = new Map(
    (await db.screenshots.where('sessionId').equals(sessionId).toArray()).map((s) => [s.id, s.dataUrl]),
  );
  const generatedAt = deps.now();
  const doc = buildReportDocument({
    session: summary.session,
    counts: summary.counts,
    items: mergeSuggestions(summary.events, ai.ok ? ai.suggestions : []),
    screenshots,
    notes,
    ai,
    generatedAt,
  });
  const blob = await deps.render(doc);

  onStep('download');
  const filename = reportFilename(summary.session.origin, generatedAt);
  deps.download(blob, filename);

  // A report from a recently closed tab consumes that session.
  if (summary.session.state === 'recent') await deleteSession(db, sessionId);
  onStep('done');
  return { filename, ai };
}

/** Fallback when PDF generation fails: download the redacted session as JSON. */
export async function exportSessionJson(
  db: BrinspectorDb,
  sessionId: string,
  notes: string,
  deps: Pick<GenerateDeps, 'download' | 'now'> = defaultDeps,
): Promise<string> {
  const summary = await getSessionSummary(db, sessionId);
  if (!summary) throw new Error('Sesi tidak ditemukan');
  const filename = reportFilename(summary.session.origin, deps.now(), 'json');
  deps.download(new Blob([sessionToJson(summary, notes)], { type: 'application/json' }), filename);
  return filename;
}
