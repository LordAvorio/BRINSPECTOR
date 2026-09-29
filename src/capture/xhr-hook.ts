import type { BodyCapture } from '../lib/types';
import { describeRequestBody, fromText, isTextual, parseRawHeaders } from './body';
import { attempt, resolveUrl, type Emit } from './fetch-hook';

interface XhrState {
  method: string;
  url: string;
  headers: Record<string, string>;
}

const HOOKED = Symbol.for('brinspector.hooked');

function xhrResponseBody(xhr: XMLHttpRequest, contentType: string | undefined): BodyCapture {
  if (!isTextual(contentType)) return { state: 'omitted', contentType };
  if (xhr.responseType === '' || xhr.responseType === 'text') return fromText(xhr.responseText ?? '', contentType);
  if (xhr.responseType === 'json') {
    return xhr.response == null ? { state: 'none', contentType } : fromText(JSON.stringify(xhr.response), contentType);
  }
  return { state: 'omitted', contentType };
}

/** Wraps XMLHttpRequest open/setRequestHeader/send; original behavior is always invoked unchanged. */
export function installXhrHook(win: Window & typeof globalThis, emit: Emit, now = () => Date.now()): void {
  const proto = win.XMLHttpRequest?.prototype as (XMLHttpRequest & Record<symbol, boolean>) | undefined;
  if (!proto || proto[HOOKED]) return;
  Object.defineProperty(proto, HOOKED, { value: true });

  const states = new WeakMap<XMLHttpRequest, XhrState>();
  const { open, send, setRequestHeader } = proto;

  proto.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    attempt(() =>
      states.set(this, {
        method: String(args[0]).toUpperCase(),
        url: resolveUrl(String(args[1]), win.location.href),
        headers: {},
      }),
    );
    return Reflect.apply(open, this, args);
  } as XMLHttpRequest['open'];

  proto.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
    attempt(() => {
      const state = states.get(this);
      if (state) state.headers[name.toLowerCase()] = String(value);
    });
    return Reflect.apply(setRequestHeader, this, [name, value]);
  };

  proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    attempt(() => {
      const state = states.get(this);
      if (!state) return;
      const xhr = this;
      const startedAt = now();
      const requestId = crypto.randomUUID();
      const requestBody = describeRequestBody(body, state.headers['content-type']);
      let failure: string | undefined;
      const onFail = (event: Event) => {
        failure = { error: 'Network error', abort: 'Aborted', timeout: 'Timeout' }[event.type] ?? event.type;
      };
      xhr.addEventListener('error', onFail);
      xhr.addEventListener('abort', onFail);
      xhr.addEventListener('timeout', onFail);
      xhr.addEventListener('loadend', () =>
        attempt(() => {
          const contentType = xhr.getResponseHeader('content-type') ?? undefined;
          emit({
            type: 'network',
            url: win.location.href,
            timestamp: now(),
            network: {
              requestId,
              initiator: 'xhr',
              method: state.method,
              url: state.url,
              requestHeaders: { ...state.headers },
              requestBody,
              status: xhr.status,
              statusText: xhr.statusText,
              responseHeaders: parseRawHeaders(xhr.getAllResponseHeaders()),
              responseBody: xhr.status === 0 ? { state: 'none' } : xhrResponseBody(xhr, contentType),
              failureReason: xhr.status === 0 ? (failure ?? 'Request failed') : undefined,
              startedAt,
              durationMs: now() - startedAt,
            },
          });
          emit({ type: 'request-end', requestId });
        }),
      );
      emit({ type: 'request-start', requestId });
    });
    return Reflect.apply(send, this, [body]);
  };
}
