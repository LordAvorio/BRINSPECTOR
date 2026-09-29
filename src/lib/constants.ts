/** Tunable limits. Values are initial defaults; see design.md open questions. */
export const LIMITS = {
  /** Max characters of a request/response body kept at capture time. */
  bodyMaxChars: 64 * 1024,
  /** Max network events kept per session (oldest dropped first). */
  maxNetworkEvents: 300,
  /** Max screenshots kept per session (oldest dropped first). */
  maxScreenshots: 30,
  /** How long a closed tab's session stays available. */
  recentTtlMs: 30 * 60 * 1000,
  /** Max number of recently closed sessions kept. */
  maxRecentSessions: 3,
  /** Quiet period with no pending requests before a screenshot is taken. */
  idleWindowMs: 500,
  /** Upper bound on waiting for the page to become idle. */
  maxScreenshotWaitMs: 2000,
  /** JPEG quality for screenshots (0-100). */
  screenshotQuality: 70,
  /** Max characters of a body sent to the AI service. */
  aiBodyMaxChars: 2000,
  /** AI request timeout. */
  aiTimeoutMs: 60_000,
  /** Max characters of tester incident notes. */
  notesMaxChars: 500,
} as const;
