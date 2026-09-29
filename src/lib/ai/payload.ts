import { LIMITS } from '../constants';
import type { BodyCapture, CaptureEvent } from '../types';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface AiItem {
  eventId: string;
  kind: 'network' | 'runtime';
  classification: 'ok' | 'error';
  pageUrl: string;
  method?: string;
  requestUrl?: string;
  status?: number;
  failureReason?: string;
  durationMs?: number;
  requestBody?: string;
  responseBody?: string;
  message?: string;
  stack?: string;
  occurrences?: number;
}

export interface AiPayload {
  origin: string;
  notes: string;
  items: AiItem[];
}

function truncate(text: string | undefined, max = LIMITS.aiBodyMaxChars): string | undefined {
  if (text === undefined) return undefined;
  return text.length > max ? `${text.slice(0, max)}...[truncated]` : text;
}

function bodyText(body: BodyCapture): string | undefined {
  return body.text === undefined ? undefined : truncate(body.text);
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** Selects what the AI sees: all errors, all mutating requests, and GETs deduplicated by method+path+status. */
export function buildAiPayload(origin: string, events: CaptureEvent[], notes: string): AiPayload {
  const items: AiItem[] = [];
  const seenGets = new Map<string, AiItem>();

  for (const event of [...events].sort((a, b) => a.timestamp - b.timestamp)) {
    if (event.kind === 'runtime' && event.runtime) {
      items.push({
        eventId: event.id,
        kind: 'runtime',
        classification: event.classification,
        pageUrl: event.url,
        message: truncate(event.runtime.message),
        stack: truncate(event.runtime.stack),
      });
      continue;
    }
    const network = event.network;
    if (event.kind !== 'network' || !network) continue;
    const item: AiItem = {
      eventId: event.id,
      kind: 'network',
      classification: event.classification,
      pageUrl: event.url,
      method: network.method,
      requestUrl: network.url,
      status: network.status,
      failureReason: network.failureReason,
      durationMs: network.durationMs,
      requestBody: bodyText(network.requestBody),
      responseBody: bodyText(network.responseBody),
    };
    if (event.classification === 'error' || MUTATING.has(network.method)) {
      items.push(item);
      continue;
    }
    const key = `${network.method} ${pathOf(network.url)} ${network.status}`;
    const existing = seenGets.get(key);
    if (existing) {
      existing.occurrences = (existing.occurrences ?? 1) + 1;
    } else {
      seenGets.set(key, item);
      items.push(item);
    }
  }

  return { origin, notes: notes.slice(0, LIMITS.notesMaxChars), items };
}
