import Dexie, { type Table } from 'dexie';
import type { CaptureEvent, Screenshot, Session } from './types';

export class BrinspectorDb extends Dexie {
  sessions!: Table<Session, string>;
  events!: Table<CaptureEvent, string>;
  screenshots!: Table<Screenshot, string>;

  constructor(name = 'brinspector') {
    super(name);
    this.version(1).stores({
      sessions: 'id, tabId, state',
      events: 'id, sessionId, [sessionId+timestamp], [sessionId+kind+timestamp], screenshotId',
      screenshots: 'id, sessionId, [sessionId+takenAt]',
    });
  }
}

let instance: BrinspectorDb | undefined;

export function getDb(): BrinspectorDb {
  instance ??= new BrinspectorDb();
  return instance;
}
