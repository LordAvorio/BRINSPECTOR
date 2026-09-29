import { describe, expect, it } from 'vitest';
import type { CaptureEvent } from '../types';
import { mergeSuggestions } from './merge';

function ev(id: string, classification: 'ok' | 'error', timestamp: number): CaptureEvent {
  return {
    id,
    sessionId: 's',
    tabId: 1,
    kind: 'network',
    url: 'https://a.com/transfer',
    timestamp,
    classification,
    screenshotStatus: 'captured',
    screenshotId: `shot-${id}`,
    redactedCount: 0,
  };
}

describe('mergeSuggestions', () => {
  it('promotes a 200 POST flagged as hidden failure to an AI-detected issue', () => {
    const items = mergeSuggestions(
      [ev('post', 'ok', 1)],
      [
        {
          eventId: 'post',
          isHiddenFailure: true,
          rootCause: 'Saldo tidak cukup',
          suggestedFix: 'Validasi saldo sebelum submit',
          severity: 'medium',
        },
      ],
    );
    expect(items[0]).toMatchObject({ isIssue: true, aiDetected: true, suggestion: { rootCause: 'Saldo tidak cukup' } });
    expect(items[0]!.event.screenshotId).toBe('shot-post');
  });

  it('attaches suggestions to errors and keeps ok events compact', () => {
    const items = mergeSuggestions(
      [ev('ok', 'ok', 2), ev('err', 'error', 1)],
      [
        { eventId: 'err', isHiddenFailure: false, rootCause: 'r', suggestedFix: 'f', severity: 'high' },
        { eventId: 'ok', isHiddenFailure: false, rootCause: 'r', suggestedFix: 'f', severity: 'low' },
      ],
    );
    expect(items.map((i) => [i.event.id, i.isIssue, i.aiDetected, i.suggestion?.severity])).toEqual([
      ['err', true, false, 'high'],
      ['ok', false, false, undefined],
    ]);
  });

  it('works without any suggestions', () => {
    expect(mergeSuggestions([ev('err', 'error', 1)], [])[0]).toMatchObject({ isIssue: true, suggestion: undefined });
  });
});
