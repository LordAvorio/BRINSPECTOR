import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ReportItem } from '../ai/merge';
import type { AiResult } from '../ai/client';
import type { Session, SessionSummary } from '../types';

/** Max characters of a body printed in the PDF (bodies are already truncated at capture). */
export const PDF_BODY_MAX_CHARS = 3000;

export interface ReportInput {
  session: Session;
  counts: SessionSummary['counts'];
  items: ReportItem[];
  screenshots: Map<string, string>;
  notes: string;
  ai: AiResult;
  generatedAt: Date;
}

const COLORS = {
  text: '#1b2430',
  muted: '#5b6b80',
  error: '#c2185b',
  ai: '#b26a00',
  ok: '#1b7f4a',
  accent: '#007a8a',
  codeBg: '#f2f5f8',
};

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString('id-ID', { hour12: false });
}

function clip(text: string | undefined): string {
  if (!text) return '';
  return text.length > PDF_BODY_MAX_CHARS ? `${text.slice(0, PDF_BODY_MAX_CHARS)}\n...[dipotong]` : text;
}

function code(label: string, text: string | undefined): Content[] {
  if (!text) return [];
  return [
    { text: label, style: 'label' },
    {
      table: { widths: ['*'], body: [[{ text: clip(text), style: 'code' }]] },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => COLORS.codeBg },
      margin: [0, 0, 0, 4],
    },
  ];
}

function title(item: ReportItem): string {
  const { event } = item;
  if (event.network) {
    const status = event.network.status === 0 ? 'GAGAL' : String(event.network.status);
    return `${event.network.method} ${event.network.url} -> ${status}`;
  }
  if (event.runtime) return event.runtime.message;
  return 'Capture manual';
}

function badge(item: ReportItem): { text: string; color: string } {
  if (item.aiDetected) return { text: 'TERDETEKSI AI', color: COLORS.ai };
  if (item.event.classification === 'error') return { text: 'ERROR', color: COLORS.error };
  return { text: item.event.kind === 'manual' ? 'MANUAL' : 'OK', color: COLORS.ok };
}

function screenshotBlock(item: ReportItem, screenshots: Map<string, string>): Content[] {
  const { event } = item;
  const image = event.screenshotId ? screenshots.get(event.screenshotId) : undefined;
  if (image) return [{ image, width: 480, margin: [0, 4, 0, 6] }];
  const reason = {
    unavailable: 'Screenshot tidak tersedia (tab tidak terlihat saat kejadian)',
    discarded: 'Screenshot dibuang (batas penyimpanan sesi)',
    pending: 'Screenshot tidak tersedia',
    captured: 'Screenshot tidak tersedia',
    none: '',
  }[event.screenshotStatus];
  return reason ? [{ text: reason, style: 'muted', margin: [0, 2, 0, 4] }] : [];
}

function suggestionBlock(item: ReportItem): Content[] {
  const s = item.suggestion;
  if (!s) return [];
  return [
    {
      table: {
        widths: ['auto', '*'],
        body: [
          [{ text: 'Severity', style: 'label' }, { text: s.severity.toUpperCase(), bold: true }],
          [{ text: 'Akar masalah', style: 'label' }, { text: s.rootCause }],
          [{ text: 'Saran perbaikan', style: 'label' }, { text: s.suggestedFix }],
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 2, 0, 6],
    },
  ];
}

function issueBlock(item: ReportItem, screenshots: Map<string, string>): Content {
  const { event } = item;
  const b = badge(item);
  const details: Content[] = [];
  if (event.network) {
    const n = event.network;
    details.push({
      text: [
        { text: 'Durasi: ', style: 'label' },
        `${n.durationMs} ms   `,
        ...(n.failureReason ? [{ text: 'Alasan gagal: ', style: 'label' }, n.failureReason] : []),
      ],
      margin: [0, 0, 0, 2],
    });
    details.push(...code('Request body', n.requestBody.text));
    details.push(...code('Response body', n.responseBody.text));
    if (n.responseBody.state === 'omitted') details.push({ text: 'Response body tidak direkam (bukan teks)', style: 'muted' });
  }
  if (event.runtime) {
    if (event.runtime.location) details.push({ text: `Lokasi: ${event.runtime.location}`, style: 'muted' });
    details.push(...code('Stack', event.runtime.stack));
  }
  return {
    stack: [
      {
        text: [
          { text: ` ${b.text} `, color: '#ffffff', background: b.color, bold: true, fontSize: 8 },
          { text: `  ${fmtTime(event.timestamp)}  `, style: 'muted' },
        ],
      },
      { text: title(item), bold: true, margin: [0, 2, 0, 2] },
      ...details,
      ...screenshotBlock(item, screenshots),
      ...suggestionBlock(item),
    ],
    margin: [0, 0, 0, 10],
    unbreakable: false,
  };
}

function compactLine(item: ReportItem): Content {
  const n = item.event.network;
  const text = n ? `${n.method} ${n.url}  ${n.status}  (${n.durationMs} ms)` : title(item);
  return { text, style: 'compact' };
}

function groupByUrl(items: ReportItem[]): Array<[string, ReportItem[]]> {
  const groups = new Map<string, ReportItem[]>();
  for (const item of items) {
    const list = groups.get(item.event.url);
    if (list) list.push(item);
    else groups.set(item.event.url, [item]);
  }
  return [...groups.entries()];
}

export function buildReportDocument(input: ReportInput): TDocumentDefinitions {
  const { session, counts, items, notes, ai } = input;
  const timestamps = items.map((i) => i.event.timestamp);
  const start = timestamps.length ? Math.min(...timestamps) : session.startedAt;
  const end = timestamps.length ? Math.max(...timestamps) : session.startedAt;
  const aiDetected = items.filter((i) => i.aiDetected).length;

  const content: Content[] = [
    { text: 'BRINSPECTOR - Laporan Bug', style: 'h1' },
    { text: `Dibuat ${fmtTime(input.generatedAt.getTime())}`, style: 'muted', margin: [0, 0, 0, 8] },
    {
      table: {
        widths: ['auto', '*'],
        body: [
          ['Origin', session.origin],
          ['Rentang waktu', `${fmtTime(start)} - ${fmtTime(end)}`],
          ['Error', String(counts.errors)],
          ['Terdeteksi AI', String(aiDetected)],
          ['Event network', String(counts.network)],
          ['Screenshot', String(counts.screenshots)],
          ['Nilai diredaksi', String(counts.redacted)],
          ['Saran AI', ai.ok ? 'Tersedia' : `Tidak tersedia: ${ai.reason}`],
        ].map(([k, v]) => [{ text: k!, style: 'label' }, { text: v! }]),
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 8],
    },
    {
      text: 'Redaksi data sensitif bersifat best-effort: periksa kembali sebelum membagikan laporan ini.',
      style: 'muted',
      italics: true,
      margin: [0, 0, 0, 8],
    },
  ];

  if (notes.trim()) {
    content.push({ text: 'Catatan insiden', style: 'h2' }, { text: notes, margin: [0, 0, 0, 8] });
  }

  for (const [url, group] of groupByUrl(items)) {
    content.push({ text: url, style: 'h2' });
    const issues = group.filter((i) => i.isIssue || i.event.kind === 'manual');
    const others = group.filter((i) => !i.isIssue && i.event.kind !== 'manual');
    for (const item of issues) content.push(issueBlock(item, input.screenshots));
    if (others.length) {
      content.push({ text: 'Request berhasil', style: 'label', margin: [0, 2, 0, 2] });
      for (const item of others) {
        content.push(compactLine(item));
        // Successful mutating requests keep their screenshot as evidence even when AI did not flag them.
        content.push(...screenshotBlock(item, input.screenshots).filter((c) => typeof c === 'object' && 'image' in c));
      }
    }
  }

  return {
    info: { title: `BRINSPECTOR ${session.origin}`, creator: 'BRINSPECTOR' },
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 40],
    footer: (page, pages) => ({ text: `${page} / ${pages}`, alignment: 'center', style: 'muted' }),
    defaultStyle: { font: 'Roboto', fontSize: 9, color: COLORS.text },
    styles: {
      h1: { fontSize: 16, bold: true, color: COLORS.accent },
      h2: { fontSize: 11, bold: true, color: COLORS.accent, margin: [0, 8, 0, 4] },
      label: { bold: true, color: COLORS.muted, fontSize: 8 },
      muted: { color: COLORS.muted, fontSize: 8 },
      code: { fontSize: 7.5, color: COLORS.text },
      compact: { fontSize: 8, color: COLORS.text, margin: [0, 0, 0, 1] },
    },
    content,
  };
}
