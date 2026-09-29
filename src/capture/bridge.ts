import { CHANNEL_RE, HANDSHAKE_EVENT, parseRawMessage, RELAY_READY_EVENT, type RawMessage } from '../lib/protocol';

const MAX_QUEUE = 500;

/**
 * Page-side (MAIN world) end of the bridge. Runs at document_start before any page script,
 * so the random channel name and the cached DOM primitives cannot be observed or patched by the page.
 */
export function createMainBridge(doc: Document): (message: RawMessage) => void {
  const dispatch = EventTarget.prototype.dispatchEvent;
  const listen = EventTarget.prototype.addEventListener;
  const Custom = CustomEvent;
  const stringify = JSON.stringify;
  const channel = `brinspector-${crypto.randomUUID()}`;
  const queue: string[] = [];
  let ready = false;

  const post = (detail: string) => dispatch.call(doc, new Custom(channel, { detail }));
  const announce = () => dispatch.call(doc, new Custom(HANDSHAKE_EVENT, { detail: channel }));

  listen.call(doc, `${channel}:ack`, () => {
    ready = true;
    queue.splice(0).forEach(post);
  });
  listen.call(doc, RELAY_READY_EVENT, announce);
  announce();

  return (message) => {
    try {
      const detail = stringify(message);
      if (ready) post(detail);
      else if (queue.length < MAX_QUEUE) queue.push(detail);
    } catch {
      // Never let capture affect the page.
    }
  };
}

/**
 * Extension-side (ISOLATED world) end. Accepts only the first well-formed handshake and
 * forwards messages that parse and validate; anything else is dropped.
 */
export function createRelay(doc: Document, forward: (message: RawMessage) => void): void {
  let channel: string | null = null;

  doc.addEventListener(HANDSHAKE_EVENT, (event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (channel || typeof detail !== 'string' || !CHANNEL_RE.test(detail)) return;
    channel = detail;
    doc.addEventListener(channel, (message) => {
      const raw = (message as CustomEvent<unknown>).detail;
      if (typeof raw !== 'string') return;
      let parsed: RawMessage | null = null;
      try {
        parsed = parseRawMessage(JSON.parse(raw));
      } catch {
        return;
      }
      if (parsed) forward(parsed);
    });
    doc.dispatchEvent(new CustomEvent(`${channel}:ack`));
  });

  doc.dispatchEvent(new CustomEvent(RELAY_READY_EVENT));
}
