import { useCallback, useEffect, useState } from 'react';
import { originOf } from '../../lib/origin';
import type { SessionSummary } from '../../lib/types';
import type { PopupApi } from './api';
import { MonitoringPanel } from './MonitoringPanel';
import { RecentSessions, ReportPanel } from './ReportPanel';
import { Timeline } from './Timeline';
import { Chip } from './ui';

const REFRESH_MS = 1000;

interface ViewState {
  tabId: number | null;
  origin: string | null;
  monitored: boolean;
  monitoredSites: string[];
  summary: SessionSummary | undefined;
  recent: SessionSummary[];
}

const INITIAL: ViewState = { tabId: null, origin: null, monitored: false, monitoredSites: [], summary: undefined, recent: [] };

export function App({ api }: { api: PopupApi }) {
  const [view, setView] = useState<ViewState>(INITIAL);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const tab = await api.getActiveTab();
    const origin = originOf(tab?.url);
    const [monitoredSites, summary, recent] = await Promise.all([
      api.listMonitored(),
      tab ? api.getActiveSummary(tab.id) : Promise.resolve(undefined),
      api.listRecent(),
    ]);
    setView({
      tabId: tab?.id ?? null,
      origin,
      monitored: origin !== null && monitoredSites.includes(origin),
      monitoredSites,
      summary,
      recent,
    });
    setLoaded(true);
  }, [api]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const onChanged = () => void refresh();

  return (
    <main className="flex flex-col gap-2 p-2">
      <header className="flex items-center justify-between">
        <h1 className="font-mono text-label-md uppercase tracking-widest text-primary-container">BRINSPECTOR</h1>
        {loaded && (
          <Chip tone={view.monitored ? 'ok' : 'muted'}>{view.monitored ? 'Monitoring aktif' : 'Tidak dimonitor'}</Chip>
        )}
      </header>

      <MonitoringPanel
        api={api}
        tabId={view.tabId}
        origin={view.origin}
        monitored={view.monitored}
        monitoredSites={view.monitoredSites}
        onChanged={onChanged}
      />

      {view.monitored && <Timeline summary={view.summary} />}

      {view.monitored && (
        <ReportPanel api={api} summary={view.summary} tabId={view.tabId} canCapture={view.monitored} onChanged={onChanged} />
      )}

      <RecentSessions api={api} recent={view.recent} onChanged={onChanged} />
    </main>
  );
}
