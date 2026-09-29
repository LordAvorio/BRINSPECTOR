import { browser } from 'wxt/browser';
import { registerLifecycleHandlers } from '../lib/background/lifecycle';
import { registerMonitoringHandlers } from '../lib/background/monitoring';
import { handleCaptureMessage, handlePopupRequest, type PopupRequest } from '../lib/background/router';
import { getDb } from '../lib/db';
import { ScreenshotScheduler } from '../lib/scheduler';
import { captureForEvents } from '../lib/screenshot';

export default defineBackground(() => {
  const db = getDb();
  const scheduler = new ScreenshotScheduler((tabId, eventIds) => captureForEvents(db, tabId, eventIds));
  const ctx = { db, scheduler };

  registerLifecycleHandlers(db);
  registerMonitoringHandlers();
  browser.tabs.onRemoved.addListener((tabId) => scheduler.tabClosed(tabId));

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return false;
    const type = (message as { type?: unknown })?.type;
    if (type === 'capture') {
      void handleCaptureMessage(ctx, message, sender).catch((error) => console.error('BRINSPECTOR ingest failed', error));
      return false;
    }
    if (type === 'capture-now') {
      void handlePopupRequest(ctx, message as PopupRequest).then(sendResponse);
      return true;
    }
    return false;
  });
});
