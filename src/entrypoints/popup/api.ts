import { browser } from 'wxt/browser';
import type { PopupRequest, PopupResponse } from '../../lib/background/router';
import { getDb } from '../../lib/db';
import { getMonitoredOrigins, isMonitored, requestMonitoring, stopMonitoring } from '../../lib/monitoring';
import { exportSessionJson, generateReport, type GenerateResult, type ReportStep } from '../../lib/report/generate';
import { clearActiveSession, findActiveSession, getSessionSummary, listRecentSessions } from '../../lib/session';
import type { SessionSummary } from '../../lib/types';

export interface ActiveTab {
  id: number;
  url?: string;
}

/** Everything the popup does, behind one interface so components can be tested with a fake. */
export interface PopupApi {
  getActiveTab(): Promise<ActiveTab | null>;
  isMonitored(origin: string): Promise<boolean>;
  listMonitored(): Promise<string[]>;
  /** Must be invoked synchronously from a click handler (permission prompts need a user gesture). */
  requestMonitoring(origin: string): Promise<boolean>;
  stopMonitoring(origin: string): Promise<void>;
  reloadTab(tabId: number): Promise<void>;
  getActiveSummary(tabId: number): Promise<SessionSummary | undefined>;
  listRecent(): Promise<SessionSummary[]>;
  captureNow(tabId: number): Promise<PopupResponse>;
  clearSession(tabId: number): Promise<void>;
  generate(sessionId: string, notes: string, onStep: (step: ReportStep) => void): Promise<GenerateResult>;
  exportJson(sessionId: string, notes: string): Promise<string>;
}

export function createPopupApi(): PopupApi {
  const db = getDb();
  return {
    async getActiveTab() {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      return tab?.id === undefined ? null : { id: tab.id, url: tab.url };
    },
    isMonitored,
    listMonitored: getMonitoredOrigins,
    requestMonitoring,
    stopMonitoring,
    async reloadTab(tabId) {
      await browser.tabs.reload(tabId);
    },
    async getActiveSummary(tabId) {
      const session = await findActiveSession(db, tabId);
      return session ? getSessionSummary(db, session.id) : undefined;
    },
    async listRecent() {
      const sessions = await listRecentSessions(db);
      const summaries = await Promise.all(sessions.map((s) => getSessionSummary(db, s.id)));
      return summaries.filter((s): s is SessionSummary => s !== undefined);
    },
    async captureNow(tabId) {
      const request: PopupRequest = { type: 'capture-now', tabId };
      return (await browser.runtime.sendMessage(request)) as PopupResponse;
    },
    async clearSession(tabId) {
      await clearActiveSession(db, tabId);
    },
    generate: (sessionId, notes, onStep) => generateReport(db, sessionId, notes, onStep),
    exportJson: (sessionId, notes) => exportSessionJson(db, sessionId, notes),
  };
}
