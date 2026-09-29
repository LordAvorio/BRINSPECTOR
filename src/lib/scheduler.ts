import { LIMITS } from './constants';
import type { CaptureEvent } from './types';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function shouldTriggerScreenshot(event: CaptureEvent): boolean {
  if (event.kind === 'manual' || event.classification === 'error') return true;
  return event.kind === 'network' && MUTATING.has(event.network?.method ?? '');
}

interface Batch {
  eventIds: string[];
  startedAt: number;
  timer?: ReturnType<typeof setTimeout>;
}

export type CaptureBatch = (tabId: number, eventIds: string[]) => Promise<void>;

/**
 * Collects triggering events per tab and fires one screenshot once the tab has had no pending
 * requests for the idle window, or when the maximum wait elapses.
 */
export class ScreenshotScheduler {
  private readonly pending = new Map<number, Set<string>>();
  private readonly batches = new Map<number, Batch>();

  constructor(
    private readonly capture: CaptureBatch,
    private readonly now: () => number = () => Date.now(),
    private readonly idleWindowMs: number = LIMITS.idleWindowMs,
    private readonly maxWaitMs: number = LIMITS.maxScreenshotWaitMs,
  ) {}

  requestStarted(tabId: number, requestId: string): void {
    let set = this.pending.get(tabId);
    if (!set) this.pending.set(tabId, (set = new Set()));
    set.add(requestId);
    this.schedule(tabId);
  }

  requestEnded(tabId: number, requestId: string): void {
    this.pending.get(tabId)?.delete(requestId);
    this.schedule(tabId);
  }

  trigger(tabId: number, eventId: string): void {
    let batch = this.batches.get(tabId);
    if (!batch) this.batches.set(tabId, (batch = { eventIds: [], startedAt: this.now() }));
    batch.eventIds.push(eventId);
    this.schedule(tabId);
  }

  tabClosed(tabId: number): void {
    const batch = this.batches.get(tabId);
    if (batch?.timer) clearTimeout(batch.timer);
    this.batches.delete(tabId);
    this.pending.delete(tabId);
  }

  pendingCount(tabId: number): number {
    return this.pending.get(tabId)?.size ?? 0;
  }

  private schedule(tabId: number): void {
    const batch = this.batches.get(tabId);
    if (!batch) return;
    if (batch.timer) clearTimeout(batch.timer);
    const remaining = this.maxWaitMs - (this.now() - batch.startedAt);
    if (remaining <= 0) {
      this.fire(tabId);
      return;
    }
    const delay = this.pendingCount(tabId) === 0 ? Math.min(this.idleWindowMs, remaining) : remaining;
    batch.timer = setTimeout(() => this.fire(tabId), delay);
  }

  private fire(tabId: number): void {
    const batch = this.batches.get(tabId);
    if (!batch) return;
    if (batch.timer) clearTimeout(batch.timer);
    this.batches.delete(tabId);
    void this.capture(tabId, batch.eventIds).catch((error) => console.error('BRINSPECTOR screenshot failed', error));
  }
}
