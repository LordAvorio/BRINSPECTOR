import { useState } from 'react';
import type { PopupApi } from './api';
import { Button, Chip, Panel } from './ui';

export interface MonitoringPanelProps {
  api: PopupApi;
  tabId: number | null;
  origin: string | null;
  monitored: boolean;
  monitoredSites: string[];
  onChanged: () => void;
}

export function MonitoringPanel({ api, tabId, origin, monitored, monitoredSites, onChanged }: MonitoringPanelProps) {
  const [offerReload, setOfferReload] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showSites, setShowSites] = useState(false);

  const toggle = () => {
    if (!origin) return;
    setMessage(null);
    if (monitored) {
      void api.stopMonitoring(origin).then(() => {
        setOfferReload(false);
        onChanged();
      });
      return;
    }
    // Called synchronously inside the click so the browser still treats it as a user gesture.
    void api.requestMonitoring(origin).then((granted) => {
      if (granted) setOfferReload(true);
      else setMessage('Izin ditolak: situs ini tidak dimonitor.');
      onChanged();
    });
  };

  return (
    <Panel
      title="Monitoring"
      action={
        <button type="button" className="font-mono text-label-sm text-text-low hover:text-text-high" onClick={() => setShowSites((v) => !v)}>
          {showSites ? 'Tutup daftar' : `Situs dimonitor (${monitoredSites.length})`}
        </button>
      }
    >
      {origin ? (
        <label className="flex cursor-pointer items-center justify-between gap-2">
          <span className="min-w-0">
            <span className="block text-body-sm text-text-high">Monitor situs ini</span>
            <span className="block truncate font-mono text-code-sm text-text-low">{origin}</span>
          </span>
          <span className="flex items-center gap-2">
            <Chip tone={monitored ? 'ok' : 'muted'}>{monitored ? 'ON' : 'OFF'}</Chip>
            <input
              type="checkbox"
              role="switch"
              aria-label="Monitor situs ini"
              checked={monitored}
              onChange={toggle}
              className="h-4 w-4 accent-[var(--color-primary-container)]"
            />
          </span>
        </label>
      ) : (
        <p className="text-body-sm text-text-low">
          Halaman ini tidak bisa dimonitor. Buka situs http/https untuk mulai.
        </p>
      )}

      {offerReload && monitored && tabId !== null && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded border border-amber/40 bg-amber/10 p-1.5">
          <span className="text-body-sm text-amber">Aktivitas sebelum monitoring aktif tidak terekam.</span>
          <Button
            onClick={() => {
              setOfferReload(false);
              void api.reloadTab(tabId);
            }}
          >
            Muat ulang
          </Button>
        </div>
      )}

      {message && <p className="mt-1 text-body-sm text-crimson">{message}</p>}

      {showSites && (
        <ul className="mt-2 divide-y divide-raised border-t border-hairline">
          {monitoredSites.length === 0 && <li className="py-1 text-body-sm text-text-low">Belum ada situs.</li>}
          {monitoredSites.map((site) => (
            <li key={site} className="flex items-center justify-between py-1">
              <span className="truncate font-mono text-code-sm">{site}</span>
              <Button variant="danger" onClick={() => void api.stopMonitoring(site).then(onChanged)} title={`Hapus ${site}`}>
                Hapus
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
