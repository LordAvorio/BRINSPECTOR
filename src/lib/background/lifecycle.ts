import { browser } from 'wxt/browser';
import type { BrinspectorDb } from '../db';
import { handleTabClosed, purgeAllSessions, purgeExpiredRecent } from '../session';

export const PURGE_ALARM = 'brinspector-purge-recent';

/** Wires tab-close, browser-startup, and periodic expiry handling for sessions. */
export function registerLifecycleHandlers(db: BrinspectorDb): void {
  browser.tabs.onRemoved.addListener((tabId) => {
    void handleTabClosed(db, tabId);
  });

  // Session data never survives a browser restart; monitored sites live in storage.local and are kept.
  browser.runtime.onStartup.addListener(() => {
    void purgeAllSessions(db);
  });

  void browser.alarms.create(PURGE_ALARM, { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PURGE_ALARM) void purgeExpiredRecent(db);
  });
}
