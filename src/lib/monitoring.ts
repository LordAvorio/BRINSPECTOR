import { browser } from 'wxt/browser';
import { originToPattern, patternToOrigin } from './origin';

export const MAIN_SCRIPT_ID = 'brinspector-capture-main';
export const RELAY_SCRIPT_ID = 'brinspector-capture-relay';

/** Host patterns granted at install time (the AI endpoint); these are never monitored sites. */
function requiredHostPatterns(): Set<string> {
  return new Set(browser.runtime.getManifest().host_permissions ?? []);
}

/**
 * Monitored origins are exactly the optional host permissions the tester granted,
 * so the permission store is the single source of truth and survives restarts.
 */
export async function getMonitoredOrigins(): Promise<string[]> {
  const required = requiredHostPatterns();
  const { origins = [] } = await browser.permissions.getAll();
  return origins
    .filter((pattern) => !required.has(pattern))
    .map(patternToOrigin)
    .filter((origin): origin is string => origin !== null)
    .sort();
}

export async function isMonitored(origin: string): Promise<boolean> {
  return (await getMonitoredOrigins()).includes(origin);
}

/** Must be called from a user gesture (popup click). Returns false when the tester denies access. */
export async function requestMonitoring(origin: string): Promise<boolean> {
  const granted = await browser.permissions.request({ origins: [originToPattern(origin)] });
  if (granted) await syncContentScripts();
  return granted;
}

export async function stopMonitoring(origin: string): Promise<void> {
  await browser.permissions.remove({ origins: [originToPattern(origin)] });
  await syncContentScripts();
}

/** Registers the capture scripts for all monitored origins (or removes them when none remain). */
export async function syncContentScripts(): Promise<void> {
  const origins = await getMonitoredOrigins();
  const existing = await browser.scripting.getRegisteredContentScripts({ ids: [MAIN_SCRIPT_ID, RELAY_SCRIPT_ID] });
  if (existing.length > 0) {
    await browser.scripting.unregisterContentScripts({ ids: existing.map((s) => s.id) });
  }
  if (origins.length === 0) return;
  const matches = origins.map(originToPattern);
  await browser.scripting.registerContentScripts([
    {
      id: RELAY_SCRIPT_ID,
      js: ['content-scripts/capture-relay.js'],
      matches,
      runAt: 'document_start',
      world: 'ISOLATED',
      persistAcrossSessions: true,
    },
    {
      id: MAIN_SCRIPT_ID,
      js: ['content-scripts/capture-main.js'],
      matches,
      runAt: 'document_start',
      world: 'MAIN',
      persistAcrossSessions: true,
    },
  ]);
}
