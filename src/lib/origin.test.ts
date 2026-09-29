import { describe, expect, it } from 'vitest';
import { originOf, originToPattern, patternToOrigin } from './origin';

describe('originOf', () => {
  it.each([
    ['https://app.example.com/login?x=1', 'https://app.example.com'],
    ['http://localhost:3000/a', 'http://localhost:3000'],
  ])('%s -> %s', (url, origin) => expect(originOf(url)).toBe(origin));

  it.each(['chrome://extensions', 'file:///C:/a.html', 'about:blank', 'not a url', undefined])(
    'rejects %s',
    (url) => expect(originOf(url)).toBeNull(),
  );
});

describe('patterns', () => {
  it('round-trips an origin', () => {
    expect(originToPattern('http://localhost:3000')).toBe('http://localhost:3000/*');
    expect(patternToOrigin('http://localhost:3000/*')).toBe('http://localhost:3000');
  });

  it('ignores wildcard patterns', () => {
    expect(patternToOrigin('https://*/*')).toBeNull();
    expect(patternToOrigin('https://*.example.com/*')).toBeNull();
  });
});
