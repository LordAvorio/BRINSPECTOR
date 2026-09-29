import type { RawMessage } from '../lib/protocol';
import type { NetworkDetails } from '../lib/types';
import { describeRequestBody, headersToRecord, isTextual, readLimited } from './body';

export type Emit = (message: RawMessage) => void;

type RequestPart = Pick<
  NetworkDetails,
  'requestId' | 'initiator' | 'method' | 'url' | 'requestHeaders' | 'requestBody' | 'startedAt'
>;

const HOOKED = Symbol.for('brinspector.hooked');

/** Capture must never affect the page, so every capture step swallows its own errors. */
export function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function resolveUrl(raw: string, base: string): string {
  try {
    return new URL(raw, base).href;
  } catch {
    return raw;
  }
}

function describeFetchRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  pageUrl: string,
  startedAt: number,
): RequestPart {
  const request = input instanceof Request ? input : null;
  const headers = headersToRecord(init?.headers ?? request?.headers);
  const requestBody =
    init?.body !== undefined && init.body !== null
      ? describeRequestBody(init.body, headers['content-type'])
      : request?.body
        ? { state: 'omitted' as const }
        : { state: 'none' as const };
  return {
    requestId: crypto.randomUUID(),
    initiator: 'fetch',
    method: (init?.method ?? request?.method ?? 'GET').toUpperCase(),
    url: resolveUrl(request ? request.url : String(input), pageUrl),
    requestHeaders: headers,
    requestBody,
    startedAt,
  };
}

/** Wraps window.fetch; the page always receives the original, unconsumed response. */
export function installFetchHook(win: Window & typeof globalThis, emit: Emit, now = () => Date.now()): void {
  const original = win.fetch;
  if (typeof original !== 'function' || (original as unknown as Record<symbol, boolean>)[HOOKED]) return;

  const wrapped = function (this: unknown, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const startedAt = now();
    const request = attempt(() => describeFetchRequest(input, init, win.location.href, startedAt));
    if (request) attempt(() => emit({ type: 'request-start', requestId: request.requestId }));

    const result = Reflect.apply(original, this, [input, init]) as Promise<Response>;
    if (!request) return result;

    const finish = (network: Omit<NetworkDetails, keyof RequestPart | 'durationMs'>) =>
      attempt(() => {
        emit({
          type: 'network',
          url: win.location.href,
          timestamp: now(),
          network: { ...request, ...network, durationMs: now() - startedAt },
        });
        emit({ type: 'request-end', requestId: request.requestId });
      });

    return result.then(
      (response) => {
        const prepared = attempt(() => {
          const contentType = response.headers.get('content-type') ?? undefined;
          return {
            contentType,
            copy: isTextual(contentType) ? response.clone() : null,
            status: response.status,
            statusText: response.statusText,
            responseHeaders: headersToRecord(response.headers),
          };
        });
        if (prepared) {
          const { contentType, copy, ...rest } = prepared;
          const body = copy
            ? readLimited(copy.body, contentType).catch(() => ({ state: 'omitted' as const, contentType }))
            : Promise.resolve({ state: 'omitted' as const, contentType });
          void body.then((responseBody) => finish({ ...rest, responseBody }));
        } else {
          attempt(() => emit({ type: 'request-end', requestId: request.requestId }));
        }
        return response;
      },
      (error: unknown) => {
        finish({
          status: 0,
          statusText: '',
          responseHeaders: {},
          responseBody: { state: 'none' },
          failureReason: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        });
        throw error;
      },
    );
  };

  Object.defineProperty(wrapped, HOOKED, { value: true });
  Object.defineProperty(wrapped, 'name', { value: 'fetch' });
  win.fetch = wrapped as typeof fetch;
}
