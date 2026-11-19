import { useState, type ReactNode } from 'react';
import { useNavigate } from '../nav';
import { useStore } from '../store';
import { makeConfig, quickName } from '../game';
import { defaultLayout, layoutsFor } from '../layouts';
import { LEAGUE } from '../santa';
import { PAUPER_EDH, SUB_FORMATS, type Format } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import ConfirmBtn from '../components/ConfirmBtn';
import { Page } from '../ui';

const PREFS = 'spindown.newGame.v2';
type Prefs = {
  /** Commander, or one of the other formats */
  kind: 'commander' | 'other';
  other: { format: Exclude<Format, 'commander'>; sub: string };
  players: number;
  layoutId: string;
  /** Commander only: Pauper Commander instead of regular */
  pauper?: boolean;
  /** league or event the next games count toward; stays until cleared */
  league?: string;
};

const DEFAULTS: Prefs = { kind: 'commander', other: { format: 'constructed', sub: 'Standard' }, players: 4, layoutId: 'p4-sides' };

const loadPrefs = (): Prefs => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || 'null');
    if (p && layoutsFor(p.players, 'portrait').some((l) => l.id === p.layoutId)) return { ...DEFAULTS, ...p };
    // no full setup saved yet, but keep a league/Pauper pre-set (Secret Santa's "Start a league game")
    if (p) return { ...DEFAULTS, pauper: p.pauper, league: p.league };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
};

const GROUPS: { format: Exclude<Format, 'commander'>; title: string }[] = [
  { format: 'constructed', title: 'Constructed' },
  { format: 'other', title: 'Casual and limited' },
];

/** Format and players, then start the life counter. */
export default function NewGame() {
  const { game, start, discard } = useStore();
  const nav = useNavigate();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const commonCount = prefs.kind === 'commander' ? 4 : 2;
  const [pickCount, setPickCount] = useState(prefs.players !== commonCount);
  const pastLeagues = useLiveQuery(async () => [...new Set((await db.games.toArray()).map((g) => g.config.league).filter(Boolean))], []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    if (patch.kind && patch.kind !== prefs.kind) {
      next.players = patch.kind === 'commander' ? 4 : 2;
      setPickCount(false);
    }
    next.layoutId = defaultLayout(next.players, 'portrait').id; // seating isn't a choice any more
    setPrefs(next);
    try {
      localStorage.setItem(PREFS, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const begin = (quick = false) => {
    if (game) discard();
    const format: Format = prefs.kind === 'commander' ? 'commander' : prefs.other.format;
    const sub = prefs.kind === 'commander' ? (prefs.pauper ? PAUPER_EDH : undefined) : prefs.other.sub;
    const config = makeConfig(format, sub, prefs.players, defaultLayout(prefs.players, 'portrait').id);
    if (prefs.league?.trim()) config.league = prefs.league.trim();
    // quick start: no names yet, everyone gets asked at the end
    if (quick) config.players = config.players.map((p, i) => ({ ...p, name: quickName(i) }));
    start(config);
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
          { v: 'commander', title: 'Commander', sub: prefs.pauper ? 'Pauper' : 'EDH' },
          { v: 'other', title: 'Other', sub: prefs.kind === 'other' ? prefs.other.sub : 'Constructed, draft, more' },
        ]}
      />
      {prefs.kind === 'commander' && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[
            { pauper: false, name: 'Regular' },
            { pauper: true, name: 'Pauper' },
          ].map((o) => (
            <button
              key={o.name}
              type="button"
              aria-pressed={!!prefs.pauper === o.pauper}
              onClick={() => update({ pauper: o.pauper })}
              className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                !!prefs.pauper === o.pauper ? 'bg-brass font-semibold text-felt' : 'bg-white/[.06] text-bone/85 hover:bg-white/10'
              }`}
            >
              {o.name}
            </button>
          ))}
          <span className="px-1 text-xs text-dim">{prefs.pauper ? '30 life, 16 commander damage' : '40 life, 21 commander damage'}</span>
        </div>
      )}
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
                        on ? 'bg-brass font-semibold text-felt' : 'bg-white/[.06] text-bone/85 hover:bg-white/10'
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
                  prefs.players === n ? 'bg-brass font-semibold text-felt' : 'bg-white/[.06] text-bone/85 hover:bg-white/10'
                }`}
              >
                {n}
              </button>
            ))}
        </div>
      )}

      <Label className="mt-5">League or event (optional)</Label>
      <div className="flex gap-2">
        <input
          value={prefs.league ?? ''}
          onChange={(e) => update({ league: e.target.value })}
          list="past-leagues"
          maxLength={40}
          placeholder="Type a league or event name"
          className="min-w-0 flex-1 rounded-xl bg-white/[.06] px-3.5 py-2.5 text-bone placeholder:text-dim"
        />
        {prefs.league && (
          <button type="button" onClick={() => update({ league: '' })} className="rounded-xl bg-white/[.06] px-3 text-sm text-dim">
            Clear
          </button>
        )}
      </div>
      {prefs.league !== LEAGUE && (
        <button
          type="button"
          onClick={() => update({ kind: 'commander', pauper: true, league: LEAGUE })}
          className="mt-2 rounded-full bg-white/[.06] px-3.5 py-1.5 text-sm text-bone/85 transition hover:bg-white/10"
        >
          🎁 {LEAGUE}
        </button>
      )}
      <datalist id="past-leagues">{pastLeagues?.map((l) => <option key={l} value={l} />)}</datalist>

      <ConfirmBtn
        variant="primary"
        skip={!game}
        onConfirm={() => begin()}
        confirmLabel="Tap again to drop the unfinished game"
        className="mt-5 w-full !rounded-2xl py-4 font-cond text-3xl font-bold"
      >
        Start game
      </ConfirmBtn>
      <ConfirmBtn
        variant="quiet"
        skip={!game}
        onConfirm={() => begin(true)}
        confirmLabel="Tap again to drop the unfinished game"
        className="mt-2 w-full !rounded-2xl py-3"
      >
        <span className="block font-semibold">Quick start</span>
        <span className="block text-xs text-dim">Just count life. Add names at the end.</span>
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
              on ? 'bg-brass text-felt' : 'bg-white/[.05] text-bone hover:bg-white/[.08]'
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
