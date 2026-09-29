import { describe, expect, it, vi } from 'vitest';
import type { RawMessage } from '../lib/protocol';
import { installConsoleHook } from './console-hook';

function setup() {
  const messages: RawMessage[] = [];
  const target = new EventTarget();
  const originalError = vi.fn();
  const win = Object.assign(target, {
    console: { error: originalError, log: vi.fn() },
    location: { href: 'https://app.example.com/checkout' },
    ErrorEvent: window.ErrorEvent,
  });
  installConsoleHook(win as unknown as Window & typeof globalThis, (m) => messages.push(m));
  const runtime = () => messages.flatMap((m) => (m.type === 'runtime' ? [m.runtime] : []));
  return { win, originalError, runtime, messages };
}

describe('console hook', () => {
  it('records console.error and still prints it with the same arguments', () => {
    const { win, originalError, runtime } = setup();
    const err = new TypeError("Cannot read properties of undefined (reading 'token')");
    win.console.error('payment failed', { code: 'GW_TIMEOUT' }, err);
    expect(originalError).toHaveBeenCalledWith('payment failed', { code: 'GW_TIMEOUT' }, err);
    expect(runtime()[0]).toMatchObject({
      source: 'console',
      message: `payment failed {"code":"GW_TIMEOUT"} TypeError: Cannot read properties of undefined (reading 'token')`,
    });
    expect(runtime()[0]!.stack).toContain('TypeError');
  });

  it('records uncaught exceptions with location', () => {
    const { win, runtime, messages } = setup();
    const error = new TypeError('x is undefined');
    win.dispatchEvent(
      new window.ErrorEvent('error', { error, message: error.message, filename: 'https://a.com/app.js', lineno: 10, colno: 5 }),
    );
    expect(runtime()[0]).toMatchObject({
      source: 'exception',
      message: 'TypeError: x is undefined',
      location: 'https://a.com/app.js:10:5',
    });
    const first = messages[0]!;
    expect(first.type === 'runtime' && first.url).toBe('https://app.example.com/checkout');
  });

  it('ignores non-ErrorEvent error events (resource load failures)', () => {
    const { win, runtime } = setup();
    win.dispatchEvent(new Event('error'));
    expect(runtime()).toHaveLength(0);
  });

  it('records unhandled rejections', () => {
    const { win, runtime } = setup();
    const event = new Event('unhandledrejection') as Event & { reason: unknown };
    event.reason = new Error('boom');
    win.dispatchEvent(event);
    expect(runtime()[0]).toMatchObject({ source: 'rejection', message: 'Unhandled rejection: Error: boom' });
  });

  it('keeps console working when capture fails', () => {
    const target = new EventTarget();
    const originalError = vi.fn();
    const win = Object.assign(target, {
      console: { error: originalError },
      location: { href: 'https://a.com/' },
      ErrorEvent: window.ErrorEvent,
    });
    installConsoleHook(win as unknown as Window & typeof globalThis, () => {
      throw new Error('broken');
    });
    win.console.error('still printed');
    expect(originalError).toHaveBeenCalledWith('still printed');
  });
});
