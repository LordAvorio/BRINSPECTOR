import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BrinspectorDb } from './db';
import * as monitoring from './monitoring';
import { captureForEvents, captureNow, NotMonitoredError } from './screenshot';
import { addEvent, getOrCreateActiveSession } from './session';
import type { CaptureEvent } from './types';

let db: BrinspectorDb;

beforeEach(() => {
  db = new BrinspectorDb(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

async function seedEvent(): Promise<CaptureEvent> {
  const session = await getOrCreateActiveSession(db, 1, 'https://app.example.com');
  const event: CaptureEvent = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    tabId: 1,
    kind: 'runtime',
    url: 'https://app.example.com/',
    timestamp: 1,
    classification: 'error',
    screenshotStatus: 'none',
    redactedCount: 0,
  };
  await addEvent(db, event);
  return event;
}

function mockTab(tab: Record<string, unknown>) {
  vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({
    id: 1,
    index: 0,
    windowId: 9,
    active: true,
    url: 'https://app.example.com/pay?email=budi@bri.co.id',
    highlighted: true,
    pinned: false,
    incognito: false,
    ...tab,
  } as never);
}

describe('captureForEvents', () => {
  it('stores a JPEG viewport screenshot linked to the events', async () => {
    const event = await seedEvent();
    mockTab({});
    const capture = vi.spyOn(fakeBrowser.tabs, 'captureVisibleTab').mockResolvedValue('data:image/jpeg;base64,AAA' as never);
    await captureForEvents(db, 1, [event.id]);
    expect(capture).toHaveBeenCalledWith(9, { format: 'jpeg', quality: 70 });
    const stored = await db.events.get(event.id);
    expect(stored?.screenshotStatus).toBe('captured');
    const shot = await db.screenshots.get(stored!.screenshotId!);
    expect(shot?.dataUrl).toBe('data:image/jpeg;base64,AAA');
    expect(shot?.url).not.toContain('budi@bri');
  });

  it('marks events unavailable when the tab is not the visible tab', async () => {
    const event = await seedEvent();
    mockTab({ active: false });
    const capture = vi.spyOn(fakeBrowser.tabs, 'captureVisibleTab');
    await captureForEvents(db, 1, [event.id]);
    expect(capture).not.toHaveBeenCalled();
    expect((await db.events.get(event.id))?.screenshotStatus).toBe('unavailable');
  });

  it('marks events unavailable when capture fails', async () => {
    const event = await seedEvent();
    mockTab({});
    vi.spyOn(fakeBrowser.tabs, 'captureVisibleTab').mockRejectedValue(new Error('minimized'));
    await captureForEvents(db, 1, [event.id]);
    expect((await db.events.get(event.id))?.screenshotStatus).toBe('unavailable');
  });
});

describe('captureNow', () => {
  it('adds a manual event with a screenshot', async () => {
    vi.spyOn(monitoring, 'isMonitored').mockResolvedValue(true);
    mockTab({});
    vi.spyOn(fakeBrowser.tabs, 'captureVisibleTab').mockResolvedValue('data:image/jpeg;base64,BBB' as never);
    const event = await captureNow(db, 1);
    expect(event.kind).toBe('manual');
    expect(event.screenshotStatus).toBe('captured');
  });

  it('refuses unmonitored sites', async () => {
    vi.spyOn(monitoring, 'isMonitored').mockResolvedValue(false);
    mockTab({});
    await expect(captureNow(db, 1)).rejects.toBeInstanceOf(NotMonitoredError);
  });
});
