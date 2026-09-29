import type { BodyCapture, NetworkDetails, RuntimeDetails } from './types';

export const SECRET_MARKER = '[REDACTED:secret]';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
]);

/** Matched as whole words of a key (so `shipping` does not match `pin`). */
const SENSITIVE_KEY_WORDS = new Set(['pin', 'otp', 'pass', 'cvv', 'cvc']);
/** Matched anywhere inside a key. */
const SENSITIVE_KEY_PARTS = ['password', 'passcode', 'passwd', 'token', 'secret'];

export function isSensitiveHeader(name: string): boolean {
  const n = name.toLowerCase();
  return SENSITIVE_HEADERS.has(n) || n.includes('token') || n.includes('secret');
}

function keyWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEY_PARTS.some((part) => lower.includes(part))) return true;
  return keyWords(key).some((word) => SENSITIVE_KEY_WORDS.has(word));
}

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const NIK_PROVINCES = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 31, 32, 33, 34, 35, 36, 51, 52, 53, 61, 62, 63, 64,
  65, 71, 72, 73, 74, 75, 76, 81, 82, 91, 92, 93, 94, 95, 96, 97,
]);

/** NIK: province code + regency + district + DDMMYY (DD+40 for women) + serial. */
export function looksLikeNik(digits: string): boolean {
  if (digits.length !== 16) return false;
  if (!NIK_PROVINCES.has(Number(digits.slice(0, 2)))) return false;
  const day = Number(digits.slice(6, 8));
  const month = Number(digits.slice(8, 10));
  const validDay = (day >= 1 && day <= 31) || (day >= 41 && day <= 71);
  return validDay && month >= 1 && month <= 12;
}

function looksLikeCard(digits: string): boolean {
  return digits.length >= 13 && digits.length <= 19 && /^[2-6]/.test(digits) && luhnValid(digits);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const DIGIT_RUN_RE = /(?<![\d])\d(?:[ -]?\d){11,18}(?![\d])/g;
const PHONE_RE = /(?<![\w+])(?:\+62[ -]?|62|0)8\d{1,3}[ -]?\d{3,4}[ -]?\d{3,5}(?!\d)|(?<![\w+])\+\d{1,3}[ -]?\d{2,4}[ -]?\d{3,4}[ -]?\d{3,4}(?!\d)/g;

export interface Counter {
  count: number;
}

/** Masks card numbers, NIK, emails, and phone numbers inside free text. */
export function redactText(text: string, counter: Counter): string {
  let out = text.replace(EMAIL_RE, () => {
    counter.count++;
    return '[REDACTED:email]';
  });
  out = out.replace(DIGIT_RUN_RE, (match) => {
    const digits = match.replace(/[ -]/g, '');
    if (looksLikeCard(digits)) {
      counter.count++;
      return '[REDACTED:card]';
    }
    if (digits === match && looksLikeNik(digits)) {
      counter.count++;
      return '[REDACTED:nik]';
    }
    return match;
  });
  out = out.replace(PHONE_RE, () => {
    counter.count++;
    return '[REDACTED:phone]';
  });
  return out;
}

function redactJsonValue(value: unknown, counter: Counter): unknown {
  if (Array.isArray(value)) return value.map((v) => redactJsonValue(v, counter));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (isSensitiveKey(key) && v !== null && v !== '') {
        counter.count++;
        out[key] = SECRET_MARKER;
      } else {
        out[key] = redactJsonValue(v, counter);
      }
    }
    return out;
  }
  if (typeof value === 'string') return redactText(value, counter);
  if (typeof value === 'number' && Number.isInteger(value)) {
    const before = counter.count;
    const replaced = redactText(String(value), counter);
    return counter.count > before ? replaced : value;
  }
  return value;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/** Redacts `a=1&b=2` pairs; output is decoded text meant for display, not for replaying requests. */
export function redactQueryString(query: string, counter: Counter): string {
  return query
    .split('&')
    .map((pair) => {
      if (!pair) return pair;
      const eq = pair.indexOf('=');
      const key = safeDecode(eq === -1 ? pair : pair.slice(0, eq));
      if (eq === -1) return redactText(key, counter);
      const value = safeDecode(pair.slice(eq + 1));
      if (isSensitiveKey(key) && value !== '') {
        counter.count++;
        return `${key}=${SECRET_MARKER}`;
      }
      return `${key}=${redactText(value, counter)}`;
    })
    .join('&');
}

export function redactUrl(url: string, counter: Counter): string {
  const hashIndex = url.indexOf('#');
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex === -1) return redactText(safeDecode(withoutHash), counter) + redactText(hash, counter);
  const base = redactText(safeDecode(withoutHash.slice(0, queryIndex)), counter);
  const query = redactQueryString(withoutHash.slice(queryIndex + 1), counter);
  return `${base}?${query}${redactText(hash, counter)}`;
}

export function redactHeaders(headers: Record<string, string>, counter: Counter): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (isSensitiveHeader(name)) {
      counter.count++;
      out[name] = SECRET_MARKER;
    } else {
      out[name] = redactText(value, counter);
    }
  }
  return out;
}

/** Redacts a body as JSON, form-encoded, or plain text depending on its content. */
export function redactBodyText(text: string, contentType: string | undefined, counter: Counter): string {
  const type = (contentType ?? '').toLowerCase();
  const trimmed = text.trim();
  if (type.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(redactJsonValue(JSON.parse(text), counter));
    } catch {
      // Truncated or invalid JSON: fall back to key-value and pattern scanning below.
      return redactText(redactLooseKeyValues(text, counter), counter);
    }
  }
  if (type.includes('x-www-form-urlencoded')) {
    return redactQueryString(text, counter);
  }
  return redactText(text, counter);
}

/** Handles `"key": "value"` pairs in text that could not be parsed as JSON (e.g. truncated). */
function redactLooseKeyValues(text: string, counter: Counter): string {
  return text.replace(/"([^"\\]{1,64})"\s*:\s*"((?:[^"\\]|\\.)*)"/g, (match, key: string, value: string) => {
    if (!isSensitiveKey(key) || value === '') return match;
    counter.count++;
    return `"${key}": "${SECRET_MARKER}"`;
  });
}

function redactBody(body: BodyCapture, counter: Counter): BodyCapture {
  if (body.text === undefined) return body;
  return { ...body, text: redactBodyText(body.text, body.contentType, counter) };
}

export function redactNetwork(network: NetworkDetails): { network: NetworkDetails; count: number } {
  const counter: Counter = { count: 0 };
  const redacted: NetworkDetails = {
    ...network,
    url: redactUrl(network.url, counter),
    requestHeaders: redactHeaders(network.requestHeaders, counter),
    requestBody: redactBody(network.requestBody, counter),
    responseHeaders: redactHeaders(network.responseHeaders, counter),
    responseBody: redactBody(network.responseBody, counter),
    statusText: redactText(network.statusText, counter),
    failureReason: network.failureReason ? redactText(network.failureReason, counter) : undefined,
  };
  return { network: redacted, count: counter.count };
}

export function redactRuntime(runtime: RuntimeDetails): { runtime: RuntimeDetails; count: number } {
  const counter: Counter = { count: 0 };
  const redacted: RuntimeDetails = {
    ...runtime,
    message: redactText(runtime.message, counter),
    stack: runtime.stack ? redactText(runtime.stack, counter) : undefined,
    location: runtime.location ? redactUrl(runtime.location, counter) : undefined,
  };
  return { runtime: redacted, count: counter.count };
}
