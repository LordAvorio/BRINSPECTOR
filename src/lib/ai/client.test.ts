import { describe, expect, it, vi } from 'vitest';
import { chatCompletionsUrl, readAiConfig, requestSuggestions, type AiConfig } from './client';
import type { AiPayload } from './payload';

const config: AiConfig = {
  endpoint: 'https://res.openai.azure.com',
  deployment: 'gpt-4o-mini',
  apiVersion: '2024-10-21',
  apiKey: 'k',
};

const payload: AiPayload = {
  origin: 'https://a.com',
  notes: '',
  items: [{ eventId: 'e1', kind: 'network', classification: 'error', pageUrl: 'https://a.com/', status: 500 }],
};

function reply(content: unknown, status = 200) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status }),
  );
}

const good = JSON.stringify({
  suggestions: [
    { eventId: 'e1', isHiddenFailure: false, rootCause: 'r', suggestedFix: 'f', severity: 'high' },
    { eventId: 'unknown', isHiddenFailure: false, rootCause: 'r', suggestedFix: 'f', severity: 'low' },
  ],
});

describe('readAiConfig', () => {
  it('returns null when the key is missing', () => {
    expect(readAiConfig({ WXT_FOUNDRY_ENDPOINT: 'https://x', WXT_FOUNDRY_DEPLOYMENT: 'd' })).toBeNull();
  });

  it('reads a complete configuration', () => {
    expect(
      readAiConfig({ WXT_FOUNDRY_ENDPOINT: 'https://x/', WXT_FOUNDRY_DEPLOYMENT: 'd', WXT_FOUNDRY_API_KEY: 'k' }),
    ).toEqual({ endpoint: 'https://x', deployment: 'd', apiVersion: '2024-10-21', apiKey: 'k' });
  });
});

describe('chatCompletionsUrl', () => {
  it('builds the deployments URL', () => {
    expect(chatCompletionsUrl(config)).toBe(
      'https://res.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-21',
    );
  });

  it('keeps a full chat-completions URL', () => {
    expect(
      chatCompletionsUrl({ ...config, endpoint: 'https://p.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview' }),
    ).toBe('https://p.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview');
  });
});

describe('requestSuggestions', () => {
  it('sends a structured-output request and returns suggestions for known events only', async () => {
    const fetchImpl = reply(good);
    const result = await requestSuggestions(payload, config, fetchImpl as typeof fetch);
    expect(result).toEqual({
      ok: true,
      suggestions: [{ eventId: 'e1', isHiddenFailure: false, rootCause: 'r', suggestedFix: 'f', severity: 'high' }],
    });
    const [, init] = fetchImpl.mock.calls[0]!;
    expect((init!.headers as Record<string, string>)['api-key']).toBe('k');
    const body = JSON.parse(init!.body as string);
    expect(body.response_format.type).toBe('json_schema');
    expect(JSON.parse(body.messages[1].content)).toEqual(payload);
  });

  it('reports a timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
        ),
    );
    const result = await requestSuggestions(payload, config, fetchImpl as typeof fetch, 10);
    expect(result).toEqual({ ok: false, reason: 'AI service timed out' });
  });

  it('rejects an invalid structure', async () => {
    const result = await requestSuggestions(
      payload,
      config,
      reply(JSON.stringify({ suggestions: [{ eventId: 'e1', severity: 'urgent' }] })) as typeof fetch,
    );
    expect(result.ok).toBe(false);
  });

  it('reports HTTP errors', async () => {
    const result = await requestSuggestions(payload, config, reply(good, 401) as typeof fetch);
    expect(result).toEqual({ ok: false, reason: 'AI service responded with HTTP 401' });
  });

  it('reports a missing configuration without calling the service', async () => {
    const fetchImpl = vi.fn();
    const result = await requestSuggestions(payload, null, fetchImpl as typeof fetch);
    expect(result).toEqual({ ok: false, reason: 'AI is not configured in this build' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
