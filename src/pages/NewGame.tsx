import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { makeConfig } from '../game';
import { defaultLayout, layoutsFor } from '../layouts';
import { SUB_FORMATS, type Format } from '../types';
import ConfirmBtn from '../components/ConfirmBtn';
import SeatMap from '../components/SeatMap';
import { usePress } from '../components/usePress';
import type { Layout } from '../layouts';
import { Page } from '../ui';

const PREFS = 'spindown.newGame.v2';
type Prefs = {
  /** Commander, or one of the other formats */
  kind: 'commander' | 'other';
  other: { format: Exclude<Format, 'commander'>; sub: string };
  players: number;
  layoutId: string;
};

const DEFAULTS: Prefs = { kind: 'commander', other: { format: 'constructed', sub: 'Standard' }, players: 4, layoutId: 'p4-sides' };

const loadPrefs = (): Prefs => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || 'null');
    if (p && layoutsFor(p.players, 'portrait').some((l) => l.id === p.layoutId)) return { ...DEFAULTS, ...p };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
};

const GROUPS: { format: Exclude<Format, 'commander'>; title: string }[] = [
  { format: 'constructed', title: 'Constructed' },
  { format: 'other', title: 'Casual and limited' },
];

/** Format, players and seating, then start the life counter. */
export default function NewGame() {
  const { game, start, discard } = useStore();
  const nav = useNavigate();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const layouts = layoutsFor(prefs.players, 'portrait');
  const commonCount = prefs.kind === 'commander' ? 4 : 2;
  const [pickCount, setPickCount] = useState(prefs.players !== commonCount);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    if (patch.kind && patch.kind !== prefs.kind) {
      next.players = patch.kind === 'commander' ? 4 : 2;
      setPickCount(false);
    }
    if (next.players !== prefs.players || !layoutsFor(next.players, 'portrait').some((l) => l.id === next.layoutId))
      next.layoutId = defaultLayout(next.players, 'portrait').id;
    setPrefs(next);
    try {
      localStorage.setItem(PREFS, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const begin = () => {
    if (game) discard();
    const format: Format = prefs.kind === 'commander' ? 'commander' : prefs.other.format;
    start(makeConfig(format, prefs.kind === 'commander' ? undefined : prefs.other.sub, prefs.players, prefs.layoutId));
    nav('/play');
  };

  return (
    <Page title="New game">
    <section className="new-game-card rounded-[28px] p-4 ring-1 ring-white/[.07]">
      <Label>Format</Label>
      <Choice
        value={prefs.kind}
        onChange={(kind) => update({ kind })}
        options={[
          { v: 'commander', title: 'Commander', sub: 'EDH' },
          { v: 'other', title: 'Other', sub: prefs.kind === 'other' ? prefs.other.sub : 'Constructed, draft, more' },
        ]}
      />
      {prefs.kind === 'other' && (
        <div className="mt-3 flex flex-col gap-2.5">
          {GROUPS.map((g) => (
            <div key={g.format}>
              <div className="mb-1.5 px-1 text-xs text-dim">{g.title}</div>
              <div className="flex flex-wrap gap-1.5">
                {SUB_FORMATS[g.format].map((s) => {
                  const on = prefs.other.format === g.format && prefs.other.sub === s.name;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update({ other: { format: g.format, sub: s.name } })}
                      className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                        on ? 'bg-bone font-semibold text-felt' : 'bg-white/[.06] text-bone/85 hover:bg-white/10'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Label className="mt-5">Players</Label>
      <Choice
        value={pickCount ? 'other' : 'common'}
        onChange={(v) => {
          if (v === 'common') {
            setPickCount(false);
            update({ players: commonCount });
          } else {
            setPickCount(true);
            if (prefs.players === commonCount) update({ players: commonCount === 4 ? 3 : 4 });
          }
        }}
        options={[
          { v: 'common', title: `${commonCount} players`, sub: commonCount === 4 ? 'The usual pod' : 'Head to head' },
          { v: 'other', title: 'Other', sub: pickCount ? `${prefs.players} players` : '2 to 6 players' },
        ]}
      />
      {pickCount && (
        <div className="mt-3 flex justify-center gap-2">
          {[2, 3, 4, 5, 6]
            .filter((n) => n !== commonCount)
            .map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={prefs.players === n}
                onClick={() => update({ players: n })}
                className={`h-12 w-12 rounded-full font-cond text-2xl font-bold transition ${
                  prefs.players === n ? 'bg-bone text-felt' : 'bg-white/[.06] text-bone/85 hover:bg-white/10'
                }`}
              >
                {n}
              </button>
            ))}
        </div>
      )}

      {layouts.length > 1 && (
        <>
          <Label className="mt-5">Seating</Label>
          <SeatPills layouts={layouts} value={prefs.layoutId} onChange={(layoutId) => update({ layoutId })} />
        </>
      )}

      <ConfirmBtn
        variant="primary"
        skip={!game}
        onConfirm={begin}
        confirmLabel="Tap again to drop the unfinished game"
        className="mt-5 w-full !rounded-2xl py-4 font-cond text-3xl font-bold shadow-[0_10px_30px_-10px_rgba(255,163,26,.6)]"
      >
        Start game
      </ConfirmBtn>
    </section>
    </Page>
  );
}

function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mb-2 px-1 text-xs font-medium text-dim ${className}`}>{children}</div>;
}

/** Two big side-by-side choices. */
function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; title: string; sub: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.v)}
            className={`rounded-2xl px-4 py-3 text-left transition active:scale-[.98] ${
              on ? 'bg-brass text-felt shadow-[0_8px_24px_-12px_rgba(255,163,26,.8)]' : 'bg-white/[.05] text-bone hover:bg-white/[.08]'
            }`}
          >
            <span className="block font-cond text-2xl font-bold leading-tight">{o.title}</span>
            <span className={`block truncate text-xs ${on ? 'text-felt/70' : 'text-dim'}`}>{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Seating as plain pills; press and hold one to see where everyone sits. */
function SeatPills({ layouts, value, onChange }: { layouts: Layout[]; value: string; onChange: (id: string) => void }) {
  const [peek, setPeek] = useState<Layout | null>(null);
  return (
    <div className="relative">
      <div className="flex rounded-full bg-white/[.05] p-1 ring-1 ring-white/[.05]" role="radiogroup" aria-label="Seating">
        {layouts.map((l) => (
          <SeatPill key={l.id} layout={l} on={l.id === value} onPick={() => onChange(l.id)} onPeek={setPeek} />
        ))}
      </div>
      <p className="mt-1.5 text-center text-[11px] text-dim">Press and hold to see the seats</p>
      {peek && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-2xl bg-felt p-2 shadow-2xl ring-1 ring-white/10">
          <SeatMap layout={peek} selected onClick={() => {}} />
        </div>
      )}
    </div>
  );
}

function SeatPill({ layout, on, onPick, onPeek }: { layout: Layout; on: boolean; onPick: () => void; onPeek: (l: Layout | null) => void }) {
  const press = usePress(onPick, () => onPeek(layout), 380, 1e9);
  const end = (f: () => void) => () => {
    f();
    onPeek(null);
  };
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      {...press}
      onPointerUp={end(press.onPointerUp)}
      onPointerLeave={end(press.onPointerLeave)}
      onPointerCancel={end(press.onPointerCancel)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick()}
      className={`flex-1 select-none rounded-full px-2 py-2 text-sm transition ${on ? 'bg-bone font-semibold text-felt shadow' : 'text-dim hover:text-bone'}`}
      style={{ WebkitTouchCallout: 'none' }}
    >
      {layout.label}
    </button>
  );
}
