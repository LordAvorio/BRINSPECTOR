import type { BodyCapture, NetworkDetails, RawCaptureEvent, RawSignal, RuntimeDetails } from './types';

export const HANDSHAKE_EVENT = 'brinspector:handshake';
export const RELAY_READY_EVENT = 'brinspector:relay-ready';
export const CHANNEL_RE = /^brinspector-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type RawMessage = RawCaptureEvent | RawSignal;

/** Runtime message sent from the relay content script to the background. */
export interface CaptureMessage {
  type: 'capture';
  message: RawMessage;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optString = (v: unknown) => v === undefined || isString(v);

function isStringRecord(v: unknown): v is Record<string, string> {
  return isObject(v) && Object.values(v).every(isString);
}

function isBody(v: unknown): v is BodyCapture {
  return (
    isObject(v) &&
    ['none', 'captured', 'truncated', 'omitted'].includes(v.state as string) &&
    optString(v.text) &&
    optString(v.contentType)
  );
}

function isNetwork(v: unknown): v is NetworkDetails {
  return (
    isObject(v) &&
    isString(v.requestId) &&
    (v.initiator === 'fetch' || v.initiator === 'xhr') &&
    isString(v.method) &&
    isString(v.url) &&
    isStringRecord(v.requestHeaders) &&
    isBody(v.requestBody) &&
    isNumber(v.status) &&
    isString(v.statusText) &&
    isStringRecord(v.responseHeaders) &&
    isBody(v.responseBody) &&
    optString(v.failureReason) &&
    isNumber(v.startedAt) &&
    isNumber(v.durationMs)
  );
}

function isRuntime(v: unknown): v is RuntimeDetails {
  return (
    isObject(v) &&
    ['console', 'exception', 'rejection'].includes(v.source as string) &&
    isString(v.message) &&
    optString(v.stack) &&
    optString(v.location)
  );
}

/** Validates an untrusted message from the page context; returns null when the shape is wrong. */
export function parseRawMessage(value: unknown): RawMessage | null {
  if (!isObject(value)) return null;
  switch (value.type) {
    case 'request-start':
    case 'request-end':
      return isString(value.requestId) ? ({ type: value.type, requestId: value.requestId } as RawSignal) : null;
    case 'network':
      return isString(value.url) && isNumber(value.timestamp) && isNetwork(value.network)
        ? (value as unknown as RawCaptureEvent)
        : null;
    case 'runtime':
      return isString(value.url) && isNumber(value.timestamp) && isRuntime(value.runtime)
        ? (value as unknown as RawCaptureEvent)
        : null;
    default:
      return null;
  }
}
