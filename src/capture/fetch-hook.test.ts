import { describe, expect, it, vi } from 'vitest';
import { LIMITS } from '../lib/constants';
import type { RawMessage } from '../lib/protocol';
import { installFetchHook } from './fetch-hook';

function setup(respond: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const messages: RawMessage[] = [];
  const win = { fetch: vi.fn(respond), location: { href: 'https://app.example.com/page' } };
  installFetchHook(win as unknown as Window & typeof globalThis, (m) => messages.push(m));
  const network = () => messages.filter((m) => m.type === 'network');
  return { win, messages, network };
}

describe('fetch hook', () => {
  it('records a JSON call while the page receives the full, unmodified body', async () => {
    const body = JSON.stringify({ success: false, message: 'Saldo tidak cukup' });
    const { win, network, messages } = setup(async () =>
      new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const response = await win.fetch('/api/transfer', {
      method: 'post',
      body: '{"amount":1}',
      headers: { 'content-type': 'application/json' },
    });
    expect(await response.text()).toBe(body);
    await vi.waitFor(() => expect(network()).toHaveLength(1));
    const event = network()[0]!;
    expect(event.type === 'network' && event.network).toMatchObject({
      method: 'POST',
      url: 'https://app.example.com/api/transfer',
      status: 200,
      requestBody: { state: 'captured', text: '{"amount":1}' },
      responseBody: { state: 'captured', text: body },
    });
    expect(messages.map((m) => m.type)).toEqual(['request-start', 'network', 'request-end']);
  });

  it('omits binary bodies', async () => {
    const { win, network } = setup(async () =>
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
    );
    await win.fetch('/logo.png');
    await vi.waitFor(() => expect(network()).toHaveLength(1));
    const event = network()[0]!;
    expect(event.type === 'network' && event.network.responseBody.state).toBe('omitted');
  });

  it('truncates oversized bodies but gives the page everything', async () => {
    const big = 'x'.repeat(LIMITS.bodyMaxChars + 100);
    const { win, network } = setup(async () => new Response(big, { headers: { 'content-type': 'text/plain' } }));
    const response = await win.fetch('/big');
    expect((await response.text()).length).toBe(big.length);
    await vi.waitFor(() => expect(network()).toHaveLength(1));
    const event = network()[0]!;
    expect(event.type === 'network' && event.network.responseBody).toMatchObject({ state: 'truncated' });
    expect(event.type === 'network' && event.network.responseBody.text?.length).toBe(LIMITS.bodyMaxChars);
  });

  it('records failed requests with status 0 and rethrows to the page', async () => {
    const { win, network } = setup(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(win.fetch('/cors')).rejects.toThrow('Failed to fetch');
    const event = network()[0]!;
    expect(event.type === 'network' && event.network).toMatchObject({
      status: 0,
      failureReason: 'TypeError: Failed to fetch',
    });
  });

  it('does not break the page when capture itself fails', async () => {
    const win = {
      fetch: vi.fn(async (_input: unknown) => new Response('ok')),
      location: { href: 'https://app.example.com/' },
    };
    installFetchHook(win as unknown as Window & typeof globalThis, () => {
      throw new Error('emit broken');
    });
    const response = await win.fetch('/x');
    expect(await response.text()).toBe('ok');
  });

  it('does not wrap twice', () => {
    const { win } = setup(async () => new Response(''));
    const first = win.fetch;
    installFetchHook(win as unknown as Window & typeof globalThis, () => {});
    expect(win.fetch).toBe(first);
  });
});
