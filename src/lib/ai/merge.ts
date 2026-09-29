import type { CaptureEvent } from '../types';
import type { AiSuggestion } from './client';

export interface ReportItem {
  event: CaptureEvent;
  suggestion?: AiSuggestion;
  /** Classified ok by status but flagged by AI as an actual failure. */
  aiDetected: boolean;
  /** Errors and AI-detected failures are issues; everything else is listed compactly. */
  isIssue: boolean;
}

export function mergeSuggestions(events: CaptureEvent[], suggestions: AiSuggestion[]): ReportItem[] {
  const byId = new Map(suggestions.map((s) => [s.eventId, s]));
  return [...events]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((event) => {
      const suggestion = byId.get(event.id);
      const aiDetected = event.classification === 'ok' && suggestion?.isHiddenFailure === true;
      return {
        event,
        suggestion: event.classification === 'error' || aiDetected ? suggestion : undefined,
        aiDetected,
        isIssue: event.classification === 'error' || aiDetected,
      };
    });
}
