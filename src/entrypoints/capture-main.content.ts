import { createMainBridge } from '../capture/bridge';
import { installConsoleHook } from '../capture/console-hook';
import { installFetchHook } from '../capture/fetch-hook';
import { installXhrHook } from '../capture/xhr-hook';

// Registered at runtime only for monitored origins (see lib/monitoring.ts).
export default defineContentScript({
  matches: [],
  registration: 'runtime',
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const emit = createMainBridge(document);
    installFetchHook(window, emit);
    installXhrHook(window, emit);
    installConsoleHook(window, emit);
  },
});
