import type { Classification } from './types';

/** Status-only classification: bodies are never inspected (hidden failures are left to the AI). */
export function classifyNetwork(status: number, failureReason?: string): Classification {
  if (failureReason || status === 0) return 'error';
  return status >= 200 && status <= 299 ? 'ok' : 'error';
}

export function classifyRuntime(): Classification {
  return 'error';
}
