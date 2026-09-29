import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import * as monitoring from '../monitoring';
import { registerMonitoringHandlers } from './monitoring';

const listeners: Record<string, () => void> = {};

beforeEach(() => {
  vi.spyOn(monitoring, 'syncContentScripts').mockResolvedValue();
  vi.spyOn(fakeBrowser.permissions.onAdded, 'addListener').mockImplementation((fn) => {
    listeners.added = fn as () => void;
  });
  vi.spyOn(fakeBrowser.permissions.onRemoved, 'addListener').mockImplementation((fn) => {
    listeners.removed = fn as () => void;
  });
  registerMonitoringHandlers();
});

describe('monitoring handlers', () => {
  it('re-syncs registrations on install and startup', async () => {
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', previousVersion: '0.0.1' });
    await fakeBrowser.runtime.onStartup.trigger();
    expect(monitoring.syncContentScripts).toHaveBeenCalledTimes(2);
  });

  it('re-syncs when site permissions change', () => {
    listeners.added!();
    listeners.removed!();
    expect(monitoring.syncContentScripts).toHaveBeenCalledTimes(2);
  });
});
