import type { ReactNode } from 'react';

type Tone = 'error' | 'warn' | 'ok' | 'info' | 'muted';

const TONES: Record<Tone, string> = {
  error: 'border-crimson/40 bg-crimson/15 text-crimson',
  warn: 'border-amber/40 bg-amber/15 text-amber',
  ok: 'border-emerald/40 bg-emerald/15 text-emerald',
  info: 'border-primary-container/40 bg-primary-container/15 text-primary-container',
  muted: 'border-hairline bg-raised text-text-low',
};

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-4 items-center rounded-full border px-1.5 font-mono text-label-sm uppercase ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded border border-hairline bg-substrate p-2">
      <header className="mb-1.5 flex items-center justify-between">
        <h2 className="font-mono text-label-md uppercase text-text-high">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'ghost',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  title?: string;
}) {
  const styles = {
    primary: 'bg-primary-container text-base font-bold hover:shadow-[0_0_8px_rgba(0,229,255,0.4)]',
    ghost: 'border border-hairline text-text-normal hover:bg-raised hover:text-text-high',
    danger: 'border border-crimson/40 bg-crimson/10 text-crimson hover:bg-crimson/20',
  }[variant];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`h-6 rounded px-2 font-mono text-code-md disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}
