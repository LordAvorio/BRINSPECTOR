import { LIMITS } from '../lib/constants';
import type { BodyCapture } from '../lib/types';

const TEXTUAL_TYPE = /json|text\/|xml|javascript|x-www-form-urlencoded|graphql/i;

export function isTextual(contentType: string | null | undefined): boolean {
  if (!contentType) return true;
  if (/text\/event-stream/i.test(contentType)) return false;
  return TEXTUAL_TYPE.test(contentType);
}

export function fromText(text: string, contentType?: string, max = LIMITS.bodyMaxChars): BodyCapture {
  if (text.length > max) return { state: 'truncated', text: text.slice(0, max), contentType };
  return { state: 'captured', text, contentType };
}

/** Reads at most `max` characters from a stream, then cancels it so long or endless streams do not hang. */
export async function readLimited(
  stream: ReadableStream<Uint8Array> | null,
  contentType?: string,
  max = LIMITS.bodyMaxChars,
): Promise<BodyCapture> {
  if (!stream) return { state: 'none', contentType };
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length > max) {
        await reader.cancel();
        return { state: 'truncated', text: text.slice(0, max), contentType };
      }
    }
    text += decoder.decode();
    return fromText(text, contentType, max);
  } finally {
    reader.releaseLock();
  }
}

/** Describes a fetch/XHR request body without consuming it. */
export function describeRequestBody(body: unknown, contentType?: string): BodyCapture {
  if (body === undefined || body === null) return { state: 'none' };
  if (typeof body === 'string') return fromText(body, contentType);
  if (body instanceof URLSearchParams) return fromText(body.toString(), 'application/x-www-form-urlencoded');
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const parts: string[] = [];
    body.forEach((value, key) => {
      parts.push(`${key}=${typeof value === 'string' ? value : '[file]'}`);
    });
    return fromText(parts.join('&'), 'application/x-www-form-urlencoded');
  }
  return { state: 'omitted', contentType };
}

export function headersToRecord(headers: Headers | HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  new Headers(headers).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export function parseRawHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const idx = line.indexOf(':');
    if (idx > 0) out[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return out;
}
