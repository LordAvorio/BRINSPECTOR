import { attempt, type Emit } from './fetch-hook';

const HOOKED = Symbol.for('brinspector.hooked');
const MAX_ARG_CHARS = 2000;

function describeValue(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  try {
    const json = JSON.stringify(value);
    return (json ?? String(value)).slice(0, MAX_ARG_CHARS);
  } catch {
    return String(value);
  }
}

function stackOf(values: unknown[]): string | undefined {
  const error = values.find((v): v is Error => v instanceof Error);
  return error?.stack;
}

/** Captures console.error, uncaught exceptions, and unhandled rejections without changing console output. */
export function installConsoleHook(win: Window & typeof globalThis, emit: Emit, now = () => Date.now()): void {
  const console = win.console as Console & Record<symbol, boolean>;
  if (!console || console[HOOKED]) return;
  Object.defineProperty(console, HOOKED, { value: true });

  const originalError = console.error;
  console.error = function (this: unknown, ...args: unknown[]) {
    attempt(() =>
      emit({
        type: 'runtime',
        url: win.location.href,
        timestamp: now(),
        runtime: {
          source: 'console',
          message: args.map(describeValue).join(' '),
          stack: stackOf(args),
        },
      }),
    );
    return Reflect.apply(originalError, this, args);
  };

  win.addEventListener('error', (event: Event) =>
    attempt(() => {
      // Resource load failures (img/script 404) are not ErrorEvents; they show up as network events instead.
      if (!(event instanceof win.ErrorEvent)) return;
      emit({
        type: 'runtime',
        url: win.location.href,
        timestamp: now(),
        runtime: {
          source: 'exception',
          message: event.error instanceof Error ? `${event.error.name}: ${event.error.message}` : event.message,
          stack: event.error instanceof Error ? event.error.stack : undefined,
          location: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
        },
      });
    }),
  );

  win.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) =>
    attempt(() =>
      emit({
        type: 'runtime',
        url: win.location.href,
        timestamp: now(),
        runtime: {
          source: 'rejection',
          message: `Unhandled rejection: ${describeValue(event.reason)}`,
          stack: event.reason instanceof Error ? event.reason.stack : undefined,
        },
      }),
    ),
  );
}
