export type Classification = 'ok' | 'error';

export type EventKind = 'network' | 'runtime' | 'manual';

export type ScreenshotStatus = 'none' | 'pending' | 'captured' | 'unavailable' | 'discarded';

export interface BodyCapture {
  state: 'none' | 'captured' | 'truncated' | 'omitted';
  text?: string;
  contentType?: string;
}

export interface NetworkDetails {
  requestId: string;
  initiator: 'fetch' | 'xhr';
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: BodyCapture;
  status: number;
  statusText: string;
  responseHeaders: Record<string, string>;
  responseBody: BodyCapture;
  /** Set when the request failed without an HTTP status (network, CORS, timeout, abort). */
  failureReason?: string;
  startedAt: number;
  durationMs: number;
}

export interface RuntimeDetails {
  source: 'console' | 'exception' | 'rejection';
  message: string;
  stack?: string;
  location?: string;
}

/** Event shape produced in the page context, before validation and redaction. */
export type RawCaptureEvent =
  | { type: 'network'; url: string; timestamp: number; network: NetworkDetails }
  | { type: 'runtime'; url: string; timestamp: number; runtime: RuntimeDetails };

/** Page-context signals used for idle tracking; never stored. */
export type RawSignal =
  | { type: 'request-start'; requestId: string }
  | { type: 'request-end'; requestId: string };

export interface CaptureEvent {
  id: string;
  sessionId: string;
  tabId: number;
  kind: EventKind;
  url: string;
  timestamp: number;
  classification: Classification;
  network?: NetworkDetails;
  runtime?: RuntimeDetails;
  screenshotId?: string;
  screenshotStatus: ScreenshotStatus;
  redactedCount: number;
}

export interface Session {
  id: string;
  /** Null once the tab has been closed. */
  tabId: number | null;
  origin: string;
  state: 'active' | 'recent';
  startedAt: number;
  closedAt?: number;
}

export interface Screenshot {
  id: string;
  sessionId: string;
  takenAt: number;
  url: string;
  dataUrl: string;
}

export interface SessionSummary {
  session: Session;
  events: CaptureEvent[];
  counts: {
    errors: number;
    network: number;
    screenshots: number;
    redacted: number;
  };
}
