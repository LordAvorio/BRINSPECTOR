import { describe, expect, it } from 'vitest';
import type { RawMessage } from '../lib/protocol';
import { installXhrHook } from './xhr-hook';

/** Minimal XHR stand-in: tests drive completion via respond()/fail(). */
class FakeXhr extends EventTarget {
  status = 0;
  statusText = '';
  responseType: XMLHttpRequestResponseType = '';
  responseText = '';
  response: unknown = null;
  headers: Record<string, string> = {};
  sent: unknown = undefined;
  opened: unknown[] = [];

  open(...args: unknown[]) {
    this.opened = args;
  }
  setRequestHeader(_name: string, _value: string) {}
  send(body?: unknown) {
    this.sent = body;
  }
  getResponseHeader(name: string) {
    return this.headers[name.toLowerCase()] ?? null;
  }
  getAllResponseHeaders() {
    return Object.entries(this.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
  }
  respond(status: number, text: string, contentType = 'application/json') {
    this.status = status;
    this.statusText = status === 200 ? 'OK' : 'Error';
    this.responseText = text;
    this.headers = { 'content-type': contentType, 'set-cookie': 'sid=1' };
    this.dispatchEvent(new Event('load'));
    this.dispatchEvent(new Event('loadend'));
  }
  fail(type: 'error' | 'abort' | 'timeout') {
    this.dispatchEvent(new Event(type));
    this.dispatchEvent(new Event('loadend'));
  }
}

function setup() {
  class Xhr extends FakeXhr {}
  const messages: RawMessage[] = [];
  const win = { XMLHttpRequest: Xhr, location: { href: 'https://app.example.com/form' } };
  installXhrHook(win as unknown as Window & typeof globalThis, (m) => messages.push(m));
  const network = () => messages.flatMap((m) => (m.type === 'network' ? [m.network] : []));
  return { Xhr, messages, network };
}

describe('xhr hook', () => {
  it('records method, url, headers, bodies, and status; page still sees the response', () => {
    const { Xhr, network, messages } = setup();
    const xhr = new Xhr() as unknown as XMLHttpRequest & FakeXhr;
    xhr.open('post', '/api/save');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send('{"name":"a"}');
    expect(xhr.sent).toBe('{"name":"a"}');
    xhr.respond(422, '{"errors":["name taken"]}');
    expect(xhr.responseText).toBe('{"errors":["name taken"]}');
    expect(network()[0]).toMatchObject({
      initiator: 'xhr',
      method: 'POST',
      url: 'https://app.example.com/api/save',
      requestHeaders: { 'content-type': 'application/json' },
      requestBody: { state: 'captured', text: '{"name":"a"}' },
      status: 422,
      responseBody: { state: 'captured', text: '{"errors":["name taken"]}' },
    });
    expect(messages.map((m) => m.type)).toEqual(['request-start', 'network', 'request-end']);
  });

  it.each([
    ['error', 'Network error'],
    ['abort', 'Aborted'],
    ['timeout', 'Timeout'],
  ] as const)('records %s as a failed request', (type, reason) => {
    const { Xhr, network } = setup();
    const xhr = new Xhr() as unknown as XMLHttpRequest & FakeXhr;
    xhr.open('GET', '/x');
    xhr.send();
    xhr.fail(type);
    expect(network()[0]).toMatchObject({ status: 0, failureReason: reason });
  });

  it('serializes json responseType', () => {
    const { Xhr, network } = setup();
    const xhr = new Xhr() as unknown as XMLHttpRequest & FakeXhr;
    xhr.responseType = 'json';
    xhr.open('GET', '/j');
    xhr.send();
    xhr.response = { ok: true };
    xhr.respond(200, '');
    expect(network()[0]!.responseBody).toMatchObject({ state: 'captured', text: '{"ok":true}' });
  });

  it('omits binary bodies', () => {
    const { Xhr, network } = setup();
    const xhr = new Xhr() as unknown as XMLHttpRequest & FakeXhr;
    xhr.open('GET', '/img');
    xhr.send();
    xhr.respond(200, '', 'image/png');
    expect(network()[0]!.responseBody.state).toBe('omitted');
  });

  it('keeps working when capture throws', () => {
    class Xhr extends FakeXhr {}
    const win = { XMLHttpRequest: Xhr, location: { href: 'https://a.com/' } };
    installXhrHook(win as unknown as Window & typeof globalThis, () => {
      throw new Error('broken');
    });
    const xhr = new Xhr() as unknown as XMLHttpRequest & FakeXhr;
    xhr.open('GET', '/x');
    xhr.send('b');
    expect(xhr.sent).toBe('b');
    expect(() => xhr.respond(200, 'ok')).not.toThrow();
  });
});
