import { browser } from 'wxt/browser';
import { createRelay } from '../capture/bridge';
import type { CaptureMessage } from '../lib/protocol';

// Registered at runtime only for monitored origins (see lib/monitoring.ts).
export default defineContentScript({
  matches: [],
  registration: 'runtime',
  runAt: 'document_start',
  main() {
    createRelay(document, (message) => {
      const payload: CaptureMessage = { type: 'capture', message };
      // The background may be restarting; dropping one event is preferable to breaking the page.
      browser.runtime.sendMessage(payload).catch(() => {});
    });
  },
});
