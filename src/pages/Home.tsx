import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from '../nav';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useStore } from '../store';
import { getSync } from '../sync';
import { Cloud } from '../components/icons';
import { D20 } from '../ui';
import AppQr from '../components/AppQr';
import { needsNames } from '../game';
import { FALLING, seasonOf } from '../season';

export default function Home() {
  const { game, lastConfig, start } = useStore();
  const nav = useNavigate();
  const [sharing, setSharing] = useState(false);
  const again = !game && lastConfig && lastConfig.players.every((p) => p.name.trim()) && !needsNames(lastConfig) ? lastConfig : null;
  const count = useLiveQuery(() => db.games.count(), []);
  const syncOn = !!getSync();

  return (
    <div className="relative min-h-full">
      <SeasonFx />
      <div className="relative mx-auto flex min-h-full max-w-md flex-col px-5 pt-[calc(9vh+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
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

          {again && (
            <button
              onClick={() => {
                start(again);
                nav('/play');
              }}
              className="flex items-center gap-3 rounded-2xl bg-felt-2/90 px-5 py-4 text-left ring-1 ring-brass/50 transition hover:bg-felt-3 active:scale-[.98]"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-cond text-2xl leading-tight font-bold text-brass">Same table again</span>
                <span className="block truncate text-sm text-dim">{again.players.map((p) => p.name).join(', ')}</span>
              </span>
              <span className="text-sm text-dim">Same decks</span>
            </button>
          )}

          <BigLink to="/new" primary sub="Life counter">
            New game
          </BigLink>
          <BigLink to="/find" tag="NEW">
            Plan game night
          </BigLink>
          <BigLink to="/history" sub={count ? `${count} games · stats` : 'Stats'}>
            Game history
          </BigLink>
        </div>

        {!installed && (
          <p className="mt-3 rounded-2xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm">
            <span className="font-semibold text-brass">Keep Spindown one tap away.</span>{' '}
            <span className="text-bone/80">iPhone: Share, then Add to Home Screen. Android: menu ⋮, then Install app.</span>
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setSharing((v) => !v)}
            className="rounded-2xl bg-felt-2/80 px-4 py-3 text-left ring-1 ring-white/[.05] transition hover:bg-felt-3"
          >
            <span className="block font-cond text-lg leading-tight font-bold">Share Spindown</span>
            <span className="block truncate text-xs text-dim">{sharing ? 'Tap to hide' : 'QR code for a friend’s phone'}</span>
          </button>
          <Link to="/sync" className="flex items-center gap-3 rounded-2xl bg-felt-2/80 px-3.5 py-3 ring-1 ring-white/[.05] transition hover:bg-felt-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.06] text-brass">
              <Cloud />
            </span>
            <span className="min-w-0">
              <span className="block font-cond text-lg leading-tight font-bold">Cloud sync</span>
              <span className={`block truncate text-xs font-semibold ${syncOn ? 'text-green-400' : 'text-red-400'}`}>{syncOn ? 'On' : 'Off'}</span>
            </span>
          </Link>
        </div>
        {sharing && (
          <div className="mt-2">
            <AppQr />
          </div>
        )}

        <footer className="mt-auto flex items-center justify-center gap-1 pt-12 text-xs text-dim">
          <About />
          <span aria-hidden>·</span>
          <VersionButton />
        </footer>
      </div>
    </div>
  );
}

// running from the home screen icon rather than a browser tab
const installed =
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** Snow in winter, leaves in fall, petals in spring, nothing in summer. Decoration only. */
function SeasonFx() {
  // laid out once per visit to Home
  const [bits] = useState(() => {
    const look = FALLING[seasonOf(new Date())];
    return look
      ? Array.from({ length: look.count }, (_, i) => {
          const size = look.size[0] + Math.random() * (look.size[1] - look.size[0]);
          return {
            left: `${Math.random() * 100}%`,
            width: size,
            height: look.leaf ? size * 0.6 : size,
            background: look.colors[i % look.colors.length],
            borderRadius: look.leaf ? '0 70% 0 70%' : '50%',
            opacity: 0.2 + Math.random() * 0.35,
            animationDuration: `${10 + Math.random() * 12}s`,
            animationDelay: `-${Math.random() * 22}s`,
            '--drift': `${Math.round(Math.random() * 80 - 40)}px`,
          } as CSSProperties;
        })
      : [];
  });
  return (
    <div aria-hidden className="season-fx pointer-events-none fixed inset-0 overflow-hidden">
      {bits.map((style, i) => (
        <i key={i} style={style} />
      ))}
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
          ? 'bg-brass text-felt hover:bg-brass-2'
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

const THANKS = [
  'Rachiepie, Partner',
  'TJ Scales, SVP and Director of Quality Improvement',
  'Drew Garza, Advisor',
  'Ben Perez, Consulting Senior Software Engineer',
  'Vikeo',
  'My local pod',
  'Queen & Rooke',
];

/** Credits live in a sheet instead of at the bottom of Home. */
function About() {
  const sheet = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => sheet.current?.showModal()} className="rounded-md px-2 py-1 active:text-brass">
        About &amp; thanks
      </button>
      <dialog
        ref={sheet}
        className="sheet"
        aria-labelledby="about-title"
        // a tap on the dimmed backdrop closes it
        onClick={(e) => e.target === sheet.current && sheet.current.close()}
      >
        <div className="px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" aria-hidden />
          <h2 id="about-title" className="font-cond text-3xl font-bold">
            <span className="text-bone">Spin</span>
            <span className="ml-1 rounded-lg bg-brass px-1.5 text-felt">down</span>
          </h2>
          <p className="mt-1 text-sm text-dim">Created by aaronallgrin</p>
          <p className="mt-6 mb-2 text-xs font-semibold tracking-wider text-dim uppercase">Special thanks</p>
          <ul className="flex flex-col gap-1.5 text-[15px] text-bone/90">
            {THANKS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => sheet.current?.close()}
            className="mt-7 w-full rounded-xl bg-white/[.06] py-3 font-semibold transition active:scale-[.98]"
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
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
      className="rounded-md px-2 py-1 active:text-brass"
    >
      {busy ? 'Refreshing…' : `Version: ${__BUILD_DATE__}`}
    </button>
  );
}
