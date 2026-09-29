/** Returns the origin (scheme://host[:port]) for http(s) URLs, or null for pages that cannot be monitored. */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Match pattern for exactly one origin; an explicit port restricts it to that port. */
export function originToPattern(origin: string): string {
  return `${origin}/*`;
}

/** Inverse of originToPattern; returns null for wildcard or non-http(s) patterns. */
export function patternToOrigin(pattern: string): string | null {
  const match = /^(https?:\/\/[^/*]+)\/\*$/.exec(pattern);
  return match?.[1] ?? null;
}
