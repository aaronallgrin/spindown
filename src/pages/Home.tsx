import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useStore } from '../store';
import { getSync } from '../sync';
import { Ask, Bars, Cloud, Gavel } from '../components/icons';
import { D20 } from '../ui';

export default function Home() {
  const { game } = useStore();
  const nav = useNavigate();
  const count = useLiveQuery(() => db.games.count(), []);
  const syncOn = !!getSync();

  return (
    <div className="home-glow min-h-full">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-[calc(9vh+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <Logo />

        <div className="mt-10 flex flex-col gap-3">
          {game && (
            <button
              onClick={() => nav('/play')}
              className="flex items-center gap-3 rounded-2xl bg-felt-2/80 px-5 py-4 text-left ring-1 ring-brass/50 backdrop-blur transition hover:bg-felt-3"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brass" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-cond text-xl font-semibold text-brass">Resume game</span>
                <span className="block truncate text-sm text-dim">
                  {game.phase === 'seating'
                    ? 'Still choosing seats'
                    : `${game.config.players.map((p) => p.name).join(', ')}${game.round > 0 ? `, round ${game.round}` : ''}`}
                </span>
              </span>
            </button>
          )}

          <BigLink to="/new" sub="Life counter">
            New game
          </BigLink>
          <BigLink to="/find" primary tag="NEW">
            Find a game
          </BigLink>
          <BigLink to="/history" sub={count ? `${count} games` : undefined}>
            Game history
          </BigLink>
        </div>

        <nav className="mt-3 grid grid-cols-2 gap-2.5">
          {[
            { to: '/judge', title: 'Ask a Judge', sub: 'Rules, rulings', icon: <Gavel /> },
            { to: '/stats', title: 'Stats', sub: 'Win rates, games', icon: <Bars /> },
            { to: '/query', title: 'Query', sub: 'Ask your games', icon: <Ask /> },
            { to: '/sync', title: 'Cloud sync', sub: syncOn ? 'On' : 'Back up games', icon: <Cloud /> },
          ].map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group flex items-center gap-3 rounded-2xl bg-felt-2/80 px-3.5 py-3 ring-1 ring-white/[.05] transition hover:bg-felt-3"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.06] text-brass transition group-hover:bg-brass group-hover:text-felt">
                {t.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-cond text-lg leading-tight font-bold">{t.title}</span>
                <span className="block truncate text-xs text-dim">{t.sub}</span>
              </span>
            </Link>
          ))}
        </nav>

        <footer className="mt-auto pt-14 text-center text-[11px] leading-relaxed text-dim/80">
          <p className="mb-1 font-medium text-dim">Special thanks to</p>
          <p>Rachiepie, Partner</p>
          <p>TJ Scales, SVP and Director of Quality Improvement</p>
          <p>Drew Garza, Advisor</p>
          <p>Ben Perez, Consulting Senior Software Engineer</p>
          <p>Vikeo</p>
          <p>My local pod</p>
          <p>Queen &amp; Rooke</p>
          <VersionButton />
        </footer>
      </div>
    </div>
  );
}

/** One of the big stacked buttons on Home. */
function BigLink({ to, children, sub, tag, primary = false }: { to: string; children: ReactNode; sub?: string; tag?: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-2xl px-5 py-[1.1rem] transition active:scale-[.98] ${
        primary
          ? 'bg-brass text-felt shadow-[0_10px_30px_-10px_rgba(255,163,26,.6)] hover:bg-brass-2'
          : 'bg-felt-2/90 text-bone ring-1 ring-white/[.05] hover:bg-felt-3'
      }`}
    >
      <span className="font-cond text-2xl leading-none font-bold tracking-wide">{children}</span>
      {sub && <span className={`ml-auto text-sm ${primary ? 'text-felt/70' : 'text-dim'}`}>{sub}</span>}
      {tag && <span className="ml-auto rounded-md bg-felt px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-brass">{tag}</span>}
    </Link>
  );
}

/**
 * The logo. Tap the die to roll a real d20: it tumbles, lands on a number,
 * the title flickers to "Random" for a moment, then the app refreshes.
 * The installed app has no browser refresh button, so this is how to pull the
 * latest version: the check for an update starts with the roll and the reload
 * happens once the die settles.
 */
function Logo() {
  const [face, setFace] = useState<number | null>(null); // null = resting "20"
  const [phase, setPhase] = useState<'rest' | 'rolling' | 'landed'>('rest');
  const [turns, setTurns] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const roll = () => {
    if (phase !== 'rest') return;
    const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
    const result = 1 + Math.floor(Math.random() * 20);
    const updated = fetchUpdate();
    setPhase('rolling');
    setTurns((t) => t + 1);
    // flicker through faces, slowing down like a real die
    let t = 0;
    [40, 50, 60, 70, 85, 100, 120, 145, 175].forEach((step) => {
      t += step;
      later(t, () => setFace(1 + Math.floor(Math.random() * 20)));
    });
    later(t + 200, () => {
      setFace(result);
      setPhase('landed');
    });
    later(t + 2300, async () => {
      await updated;
      window.location.reload();
    });
  };

  const random = phase !== 'rest';
  return (
    <header className="flex flex-col items-center text-center">
      <button
        type="button"
        onClick={roll}
        aria-label={phase === 'landed' && face ? `Rolled ${face}` : 'Roll a d20'}
        className="roll-in rounded-full"
      >
        <div
          className="transition-[rotate,scale] duration-[1100ms] ease-[cubic-bezier(.15,.85,.25,1)]"
          style={{ rotate: `${turns * 720}deg`, scale: phase === 'landed' ? '1.08' : '1' }}
        >
          <D20 value={face ?? 20} size={84} />
        </div>
      </button>
      <h1
        key={random ? 'random' : 'spindown'}
        className={`${turns ? 'title-flicker ' : ''}mt-4 flex items-center font-cond text-[3.4rem] leading-none font-bold tracking-wide`}
      >
        <span className="text-bone">{random ? 'Ran' : 'Spin'}</span>
        <span className="ml-1.5 rounded-xl bg-brass px-2 pb-1 text-felt">{random ? 'dom' : 'down'}</span>
      </h1>
      <p className="mt-2 text-[13px] text-dim">Created by aaronallgrin</p>
    </header>
  );
}

/** Ask the service worker for a newer build and wait (briefly) for it to take over. */
async function fetchUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) return;
    await reg.update();
    const next = reg.installing ?? reg.waiting;
    if (!next) return;
    await new Promise<void>((done) => {
      next.addEventListener('statechange', () => next.state === 'activated' && done());
      window.setTimeout(done, 4000);
    });
  } catch {
    /* offline or no service worker: a plain reload still happens */
  }
}

/** The version line. Tap it to check for a newer build and refresh. */
function VersionButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetchUpdate();
        window.location.reload();
      }}
      aria-label="Refresh the app"
      className="mt-4 rounded-md px-2 py-1 text-xs text-dim active:text-brass"
    >
      {busy ? 'Refreshing…' : `Version: ${__BUILD_DATE__}`}
    </button>
  );
}
