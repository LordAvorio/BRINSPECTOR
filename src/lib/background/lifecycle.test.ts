import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BrinspectorDb } from '../db';
import { getOrCreateActiveSession } from '../session';
import { registerLifecycleHandlers } from './lifecycle';

let db: BrinspectorDb;

beforeEach(() => {
  db = new BrinspectorDb(`test-${crypto.randomUUID()}`);
  registerLifecycleHandlers(db);
});

afterEach(async () => {
  await db.delete();
});

describe('session lifecycle wiring', () => {
  it('moves the session to recent when its tab closes', async () => {
    const session = await getOrCreateActiveSession(db, 7, 'https://app.example.com');
    await fakeBrowser.tabs.onRemoved.trigger(7, { windowId: 1, isWindowClosing: false });
    await vi.waitFor(async () => expect((await db.sessions.get(session.id))?.state).toBe('recent'));
  });

  it('purges all sessions on browser startup', async () => {
    await getOrCreateActiveSession(db, 1, 'https://app.example.com');
    await fakeBrowser.runtime.onStartup.trigger();
    await vi.waitFor(async () => expect(await db.sessions.count()).toBe(0));
  });
});
