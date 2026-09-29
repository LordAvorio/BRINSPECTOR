import { describe, expect, it } from 'vitest';
import { classifyNetwork, classifyRuntime } from './classify';

describe('classifyNetwork', () => {
  it.each([
    [200, 'ok'],
    [201, 'ok'],
    [204, 'ok'],
    [299, 'ok'],
    [304, 'error'],
    [404, 'error'],
    [500, 'error'],
  ] as const)('status %i is %s', (status, expected) => {
    expect(classifyNetwork(status)).toBe(expected);
  });

  it('treats status 0 as error (network failure, CORS, abort)', () => {
    expect(classifyNetwork(0)).toBe('error');
  });

  it('treats a failure reason as error even with a status', () => {
    expect(classifyNetwork(200, 'timeout')).toBe('error');
  });

  it('does not look at the body: 200 is ok', () => {
    expect(classifyNetwork(200)).toBe('ok');
  });
});

describe('classifyRuntime', () => {
  it('always returns error', () => {
    expect(classifyRuntime()).toBe('error');
  });
});
