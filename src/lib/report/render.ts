import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { SessionSummary } from '../types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function reportFilename(origin: string, date: Date, extension = 'pdf'): string {
  let host = origin;
  try {
    host = new URL(origin).host;
  } catch {
    // keep raw origin
  }
  const safeHost = host.replace(/[^a-zA-Z0-9.-]/g, '-');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `brinspector-${safeHost}-${stamp}.${extension}`;
}

/** Fallback export: the already-redacted session as JSON, without screenshots. */
export function sessionToJson(summary: SessionSummary, notes: string): string {
  return JSON.stringify(
    { session: summary.session, counts: summary.counts, notes, events: summary.events },
    null,
    2,
  );
}

export async function renderPdf(doc: TDocumentDefinitions): Promise<Blob> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const maker = pdfMake as unknown as {
    addVirtualFileSystem(vfs: unknown): void;
    createPdf(doc: TDocumentDefinitions): { getBlob(): Promise<Blob> };
  };
  maker.addVirtualFileSystem(vfs);
  return maker.createPdf(doc).getBlob();
}

export function triggerDownload(blob: Blob, filename: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
