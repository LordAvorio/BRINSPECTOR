import { describe, expect, it } from 'vitest';
import { HANDSHAKE_EVENT, parseRawMessage, type RawMessage } from '../lib/protocol';
import { createMainBridge, createRelay } from './bridge';

const runtimeEvent: RawMessage = {
  type: 'runtime',
  url: 'https://app.example.com/',
  timestamp: 1,
  runtime: { source: 'console', message: 'boom' },
};

function newDoc(): Document {
  return document.implementation.createHTMLDocument('t');
}

describe('bridge', () => {
  it('delivers messages when the relay starts first', () => {
    const doc = newDoc();
    const received: RawMessage[] = [];
    createRelay(doc, (m) => received.push(m));
    const emit = createMainBridge(doc);
    emit(runtimeEvent);
    expect(received).toEqual([runtimeEvent]);
  });

  it('queues messages until the relay starts', () => {
    const doc = newDoc();
    const received: RawMessage[] = [];
    const emit = createMainBridge(doc);
    emit(runtimeEvent);
    createRelay(doc, (m) => received.push(m));
    expect(received).toEqual([runtimeEvent]);
  });

  it('discards forged messages on a guessed channel and forged handshakes', () => {
    const doc = newDoc();
    const received: RawMessage[] = [];
    createRelay(doc, (m) => received.push(m));
    const emit = createMainBridge(doc);
    // Handshake is already locked; a page script cannot redirect the relay to its own channel.
    const forgedChannel = `brinspector-${crypto.randomUUID()}`;
    doc.dispatchEvent(new CustomEvent(HANDSHAKE_EVENT, { detail: forgedChannel }));
    doc.dispatchEvent(new CustomEvent(forgedChannel, { detail: JSON.stringify(runtimeEvent) }));
    emit(runtimeEvent);
    expect(received).toEqual([runtimeEvent]);
  });

  it('discards malformed messages', () => {
    expect(parseRawMessage({ type: 'network', url: 'x', timestamp: 1, network: { status: 'bad' } })).toBeNull();
    expect(parseRawMessage({ type: 'evil' })).toBeNull();
    expect(parseRawMessage('string')).toBeNull();
    expect(parseRawMessage(runtimeEvent)).toEqual(runtimeEvent);
  });
});
