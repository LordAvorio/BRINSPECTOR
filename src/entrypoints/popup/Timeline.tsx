import type { CaptureEvent, SessionSummary } from '../../lib/types';
import { Chip, Panel } from './ui';

function describe(event: CaptureEvent): string {
  if (event.network) {
    let path = event.network.url;
    try {
      const url = new URL(event.network.url);
      path = url.pathname + url.search;
    } catch {
      // keep full text
    }
    const status = event.network.status === 0 ? 'GAGAL' : event.network.status;
    return `${event.network.method} ${path} ${status}`;
  }
  if (event.runtime) return event.runtime.message;
  return 'Capture manual';
}

const SHOT_LABEL: Record<CaptureEvent['screenshotStatus'], string> = {
  none: '',
  pending: 'screenshot...',
  captured: 'screenshot',
  unavailable: 'tanpa screenshot',
  discarded: 'screenshot dibuang',
};

function groupByUrl(events: CaptureEvent[]): Array<[string, CaptureEvent[]]> {
  const groups = new Map<string, CaptureEvent[]>();
  for (const event of events) {
    const list = groups.get(event.url);
    if (list) list.push(event);
    else groups.set(event.url, [event]);
  }
  return [...groups.entries()];
}

/** All captured values are rendered as React text nodes, never as HTML. */
export function Timeline({ summary }: { summary: SessionSummary | undefined }) {
  const events = summary?.events ?? [];
  return (
    <Panel
      title="Timeline sesi"
      action={
        summary && (
          <span className="flex gap-1">
            <Chip tone={summary.counts.errors ? 'error' : 'ok'}>{summary.counts.errors} error</Chip>
            <Chip tone="info">{summary.counts.network} network</Chip>
            <Chip tone="muted">{summary.counts.screenshots} shot</Chip>
          </span>
        )
      }
    >
      {events.length === 0 ? (
        <p className="text-body-sm text-text-low">Belum ada aktivitas terekam di tab ini.</p>
      ) : (
        <div className="max-h-52 overflow-y-auto">
          {groupByUrl(events).map(([url, group]) => (
            <div key={url} className="mb-1">
              <div className="sticky top-0 truncate bg-raised px-1 font-mono text-code-sm text-primary-container" title={url}>
                {url}
              </div>
              <ul>
                {group.map((event) => (
                  <li
                    key={event.id}
                    className={`flex h-5 items-center gap-1 border-b border-raised px-1 ${
                      event.classification === 'error' ? 'border-l-2 border-l-crimson' : ''
                    }`}
                  >
                    <Chip tone={event.classification === 'error' ? 'error' : event.kind === 'manual' ? 'info' : 'ok'}>
                      {event.classification === 'error' ? 'ERR' : event.kind === 'manual' ? 'MAN' : 'OK'}
                    </Chip>
                    <span className="min-w-0 flex-1 truncate font-mono text-code-sm" title={describe(event)}>
                      {describe(event)}
                    </span>
                    {event.screenshotStatus !== 'none' && (
                      <span className="shrink-0 font-mono text-label-sm text-text-low">{SHOT_LABEL[event.screenshotStatus]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {summary && summary.counts.redacted > 0 && (
        <p className="mt-1 font-mono text-label-sm text-text-low">{summary.counts.redacted} nilai sensitif diredaksi</p>
      )}
    </Panel>
  );
}
