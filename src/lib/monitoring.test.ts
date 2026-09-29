import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  getMonitoredOrigins,
  MAIN_SCRIPT_ID,
  RELAY_SCRIPT_ID,
  requestMonitoring,
  stopMonitoring,
  syncContentScripts,
} from './monitoring';

let granted: Set<string>;
let registered: Array<{ id: string; matches?: string[]; world?: string }>;

beforeEach(() => {
  granted = new Set();
  registered = [];
  vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
    manifest_version: 3,
    name: 'test',
    version: '0',
    host_permissions: ['https://foundry.example.com/*'],
  });
  vi.spyOn(fakeBrowser.permissions, 'getAll').mockImplementation(async () => ({
    origins: ['https://foundry.example.com/*', ...granted],
  }));
  vi.spyOn(fakeBrowser.permissions, 'remove').mockImplementation(async ({ origins = [] }) => {
    origins.forEach((o) => granted.delete(o));
    return true;
  });
  vi.spyOn(fakeBrowser.scripting, 'getRegisteredContentScripts').mockImplementation(async () => registered as never);
  vi.spyOn(fakeBrowser.scripting, 'unregisterContentScripts').mockImplementation(async () => {
    registered = [];
  });
  vi.spyOn(fakeBrowser.scripting, 'registerContentScripts').mockImplementation(async (scripts) => {
    registered.push(...(scripts as typeof registered));
  });
});

describe('monitoring', () => {
  it('registers capture scripts for the exact origin when access is granted', async () => {
    vi.spyOn(fakeBrowser.permissions, 'request').mockImplementation(async ({ origins = [] }) => {
      origins.forEach((o) => granted.add(o));
      return true;
    });
    expect(await requestMonitoring('https://app.example.com')).toBe(true);
    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({ origins: ['https://app.example.com/*'] });
    expect(await getMonitoredOrigins()).toEqual(['https://app.example.com']);
    expect(registered.map((s) => [s.id, s.world, s.matches])).toEqual([
      [RELAY_SCRIPT_ID, 'ISOLATED', ['https://app.example.com/*']],
      [MAIN_SCRIPT_ID, 'MAIN', ['https://app.example.com/*']],
    ]);
  });

  it('leaves the origin unmonitored when access is denied', async () => {
    vi.spyOn(fakeBrowser.permissions, 'request').mockImplementation(async () => false as never);
    expect(await requestMonitoring('https://app.example.com')).toBe(false);
    expect(await getMonitoredOrigins()).toEqual([]);
    expect(registered).toEqual([]);
  });

  it('releases access and unregisters scripts on removal', async () => {
    granted.add('https://app.example.com/*');
    await syncContentScripts();
    await stopMonitoring('https://app.example.com');
    expect(fakeBrowser.permissions.remove).toHaveBeenCalledWith({ origins: ['https://app.example.com/*'] });
    expect(await getMonitoredOrigins()).toEqual([]);
    expect(registered).toEqual([]);
  });

  it('re-registers scripts for stored origins on sync', async () => {
    granted.add('https://a.example.com/*');
    granted.add('http://localhost:3000/*');
    await syncContentScripts();
    expect(registered[0]!.matches).toEqual(['http://localhost:3000/*', 'https://a.example.com/*']);
  });

  it('never treats the AI endpoint as a monitored site', async () => {
    expect(await getMonitoredOrigins()).toEqual([]);
  });
});
