import { describe, expect, it } from 'vitest';
import {
  isSensitiveKey,
  luhnValid,
  looksLikeNik,
  redactBodyText,
  redactHeaders,
  redactNetwork,
  redactRuntime,
  redactText,
  redactUrl,
  SECRET_MARKER,
  type Counter,
} from './redact';
import type { NetworkDetails } from './types';

const counter = (): Counter => ({ count: 0 });

function network(overrides: Partial<NetworkDetails> = {}): NetworkDetails {
  return {
    requestId: 'r1',
    initiator: 'fetch',
    method: 'POST',
    url: 'https://app.example.com/api/login',
    requestHeaders: {},
    requestBody: { state: 'none' },
    status: 200,
    statusText: 'OK',
    responseHeaders: {},
    responseBody: { state: 'none' },
    startedAt: 0,
    durationMs: 10,
    ...overrides,
  };
}

describe('sensitive headers', () => {
  it.each(['Authorization', 'Proxy-Authorization', 'Cookie', 'Set-Cookie', 'X-Api-Key', 'X-Csrf-Token', 'x-client-secret'])(
    'masks %s',
    (name) => {
      const c = counter();
      expect(redactHeaders({ [name]: 'abc123' }, c)[name]).toBe(SECRET_MARKER);
      expect(c.count).toBe(1);
    },
  );

  it('keeps ordinary headers', () => {
    expect(redactHeaders({ 'Content-Type': 'application/json' }, counter())).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('stores no raw bearer token', () => {
    const { network: out } = redactNetwork(network({ requestHeaders: { Authorization: 'Bearer abc123' } }));
    expect(JSON.stringify(out)).not.toContain('abc123');
  });
});

describe('sensitive JSON keys', () => {
  it.each(['password', 'newPassword', 'pin', 'user_pin', 'otp', 'otpCode', 'pass', 'accessToken', 'client_secret', 'cvv', 'cvc'])(
    '%s is sensitive',
    (key) => expect(isSensitiveKey(key)).toBe(true),
  );

  it.each(['shipping', 'spinner', 'mapping', 'passenger', 'name', 'amount'])('%s is not sensitive', (key) =>
    expect(isSensitiveKey(key)).toBe(false),
  );

  it('masks nested password field', () => {
    const c = counter();
    const out = redactBodyText('{"user": {"name": "a", "password": "x"}}', 'application/json', c);
    expect(JSON.parse(out)).toEqual({ user: { name: 'a', password: '[REDACTED:secret]' } });
    expect(c.count).toBe(1);
  });

  it('masks inside arrays', () => {
    const out = redactBodyText('[{"otp":"123456"},{"otp":"654321"}]', 'application/json', counter());
    expect(out).not.toMatch(/123456|654321/);
  });

  it('masks keys in truncated JSON', () => {
    const out = redactBodyText('{"username":"a","password":"hunter2","note":"abc', 'application/json', counter());
    expect(out).not.toContain('hunter2');
  });

  it('masks form-encoded bodies', () => {
    const out = redactBodyText('user=a&password=hunter2', 'application/x-www-form-urlencoded', counter());
    expect(out).toBe(`user=a&password=${SECRET_MARKER}`);
  });
});

describe('value patterns', () => {
  it('detects Luhn-valid numbers', () => {
    expect(luhnValid('4111111111111111')).toBe(true);
    expect(luhnValid('4111111111111112')).toBe(false);
  });

  it('masks a card number in a console message', () => {
    const c = counter();
    expect(redactText('charge failed for 4111111111111111', c)).toBe('charge failed for [REDACTED:card]');
    expect(c.count).toBe(1);
  });

  it('masks a spaced card number', () => {
    expect(redactText('card 4111 1111 1111 1111 ok', counter())).toBe('card [REDACTED:card] ok');
  });

  it('masks a card number stored as a JSON number', () => {
    const out = redactBodyText('{"cardNumber": 4111111111111111}', 'application/json', counter());
    expect(out).toContain('[REDACTED:card]');
  });

  it('masks a non-Luhn 16-digit NIK', () => {
    const nik = '3171234501900001';
    expect(looksLikeNik(nik)).toBe(true);
    expect(luhnValid(nik)).toBe(false);
    expect(redactText(`nik ${nik}`, counter())).toBe('nik [REDACTED:nik]');
  });

  it('does not mask millisecond timestamps', () => {
    expect(redactText('ts=1727600000000', counter())).toBe('ts=1727600000000');
  });

  it('masks emails', () => {
    expect(redactText('sent to budi@bri.co.id', counter())).toBe('sent to [REDACTED:email]');
  });

  it.each(['081234567890', '+6281234567890', '0812-3456-7890'])('masks phone %s', (phone) => {
    expect(redactText(`call ${phone} now`, counter())).toBe('call [REDACTED:phone] now');
  });

  it('keeps ordinary numbers', () => {
    expect(redactText('amount 1420000 id 98812', counter())).toBe('amount 1420000 id 98812');
  });
});

describe('urls', () => {
  it('masks sensitive query params and emails', () => {
    const out = redactUrl('https://a.com/reset?token=abc&email=budi%40bri.co.id&page=2', counter());
    expect(out).toBe(`https://a.com/reset?token=${SECRET_MARKER}&email=[REDACTED:email]&page=2`);
  });
});

describe('redactNetwork / redactRuntime', () => {
  it('counts all redactions across the event', () => {
    const { network: out, count } = redactNetwork(
      network({
        url: 'https://a.com/x?access_token=t',
        requestHeaders: { Cookie: 'sid=1' },
        requestBody: { state: 'captured', text: '{"password":"p"}', contentType: 'application/json' },
        responseBody: { state: 'captured', text: '{"email":"a@b.co"}', contentType: 'application/json' },
      }),
    );
    expect(count).toBe(4);
    expect(JSON.stringify(out)).not.toMatch(/sid=1|"p"|a@b\.co|=t\b/);
  });

  it('redacts runtime messages and stacks', () => {
    const { runtime, count } = redactRuntime({
      source: 'console',
      message: 'failed for budi@bri.co.id',
      stack: 'Error at 4111111111111111',
    });
    expect(runtime.message).toBe('failed for [REDACTED:email]');
    expect(runtime.stack).toBe('Error at [REDACTED:card]');
    expect(count).toBe(2);
  });
});
