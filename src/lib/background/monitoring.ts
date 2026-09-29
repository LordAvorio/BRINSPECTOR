import { browser } from 'wxt/browser';
import { syncContentScripts } from '../monitoring';

/** Keeps capture script registrations in step with granted site permissions. */
export function registerMonitoringHandlers(): void {
  const sync = () => void syncContentScripts().catch((error) => console.error('BRINSPECTOR sync failed', error));
  browser.runtime.onInstalled.addListener(sync);
  browser.runtime.onStartup.addListener(sync);
  // Covers grants that finish after the popup closed and removals made from chrome://extensions.
  browser.permissions.onAdded.addListener(sync);
  browser.permissions.onRemoved.addListener(sync);
}
