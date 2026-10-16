import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useStore } from '../store';
import { defaultLayout, getLayout, layoutsFor, seatPosition, type Layout } from '../layouts';
import { BRACKETS, type Format, type GameConfig, type Mana, type Orientation, type PlayerSetup } from '../types';
import CommanderPicker from '../components/CommanderPicker';
import ConfirmBtn from '../components/ConfirmBtn';
import { Btn, ManaPicker, Page, Pips, Segmented, sortMana } from '../ui';

const blank = (): PlayerSetup => ({ name: '', hasPartner: false, colors: [] });
const lifeFor = (f: Format) => (f === 'commander' ? 40 : 20);

function defaults(): GameConfig {
  return {
    format: 'commander',
    startingLife: 40,
    orientation: 'portrait',
    layoutId: 'p4-sides',
    players: [blank(), blank(), blank(), blank()],
    cmdrDamageLosesLife: true,
    extraCounter: '*',
  };
}

const deckKey = (p: PlayerSetup) =>
  [p.commander?.name ?? '', p.hasPartner ? p.partner?.name ?? '' : '', p.deckName ?? '', p.theme ?? ''].join('|').toLowerCase();

export default function Setup() {
  const { lastConfig, start, game, discard } = useStore();
  const nav = useNavigate();
  const [cfg, setCfg] = useState<GameConfig>(() => defaults());
  const layout = getLayout(cfg.layoutId);
  const games = useLiveQuery(() => db.games.orderBy('startedAt').reverse().toArray(), []);

  // names seen before, and each name's past decks for one-tap reuse
  const memory = useMemo(() => {
    const names = new Map<string, string>();
    const decks = new Map<string, Map<string, { setup: PlayerSetup; format: Format }>>();
    const themes = new Set<string>();
    for (const g of games ?? []) {
      g.config.players.forEach((p) => {
        const name = p.name.trim();
        if (!name) return;
        const k = name.toLowerCase();
        if (!names.has(k)) names.set(k, name);
        if (p.theme) themes.add(p.theme);
        const m = decks.get(k) ?? new Map();
        const dk = deckKey(p);
        if (dk.replaceAll('|', '') && !m.has(dk)) m.set(dk, { setup: p, format: g.config.format });
        decks.set(k, m);
      });
    }
    return { names: [...names.values()], decks, themes: [...themes] };
  }, [games]);

  const set = (patch: Partial<GameConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const setPlayer = (i: number, patch: Partial<PlayerSetup>) =>
    setCfg((c) => ({ ...c, players: c.players.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  const setCount = (n: number) =>
    setCfg((c) => {
      const players = Array.from({ length: n }, (_, i) => c.players[i] ?? blank());
      return { ...c, players, layoutId: defaultLayout(n, c.orientation).id };
    });
  const setOrientation = (o: Orientation) =>
    set({ orientation: o, layoutId: defaultLayout(cfg.players.length, o).id });
  const setFormat = (f: Format) => set({ format: f, startingLife: lifeFor(f) });

  const swap = (i: number) =>
    setCfg((c) => {
      const j = (i + 1) % c.players.length;
      const players = [...c.players];
      [players[i], players[j]] = [players[j], players[i]];
      return { ...c, players };
    });

  const begin = () => {
    if (game) discard();
    const cleaned: GameConfig = {
      ...cfg,
      players: cfg.players.map((p, i) => ({
        ...p,
        name: p.name.trim() || `Seat ${i + 1}`,
        partner: p.hasPartner ? p.partner : undefined,
      })),
    };
    start(cleaned);
    nav('/play');
  };

  const isCmdr = cfg.format === 'commander';

  return (
    <Page title="New game">
      <datalist id="names">
        {memory.names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="themes">
        {memory.themes.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {lastConfig && (
        <Btn className="mb-5 w-full" onClick={() => setCfg({ ...lastConfig, extraCounter: lastConfig.extraCounter ?? '*' })}>
          Same table as last game
        </Btn>
      )}

      <section className="mb-6 flex flex-col gap-3">
        <Segmented
          label="Format"
          value={cfg.format}
          onChange={setFormat}
          options={[
            { v: 'commander', label: 'Commander' },
            { v: 'constructed', label: 'Constructed' },
            { v: 'other', label: 'Other' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Stepper label="Players" value={cfg.players.length} min={2} max={6} onChange={setCount} />
          <Stepper
            label="Starting life"
            value={cfg.startingLife}
            min={1}
            max={999}
            step={cfg.startingLife >= 20 ? 5 : 1}
            onChange={(v) => set({ startingLife: v })}
          />
        </div>
        <Segmented
          label="Phone orientation"
          value={cfg.orientation}
          onChange={setOrientation}
          options={[
            { v: 'portrait', label: 'Portrait' },
            { v: 'landscape', label: 'Landscape' },
          ]}
        />
        <div>
          <div className="mb-2 text-sm text-dim">Seating, numbered clockwise</div>
          <div className="flex flex-wrap gap-3">
            {layoutsFor(cfg.players.length, cfg.orientation).map((l) => (
              <LayoutThumb key={l.id} layout={l} selected={l.id === cfg.layoutId} onClick={() => set({ layoutId: l.id })} />
            ))}
          </div>
        </div>
        {isCmdr && (
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={cfg.cmdrDamageLosesLife}
              onChange={(e) => set({ cmdrDamageLosesLife: e.target.checked })}
              className="h-5 w-5 accent-[var(--color-brass)]"
            />
            Commander damage also takes life
          </label>
        )}
        <label className="flex items-center gap-3 text-sm">
          <span className="shrink-0">Misplay counter</span>
          <input
            id="extra-counter"
            value={cfg.extraCounter ?? ''}
            onChange={(e) => set({ extraCounter: e.target.value })}
            placeholder="Leave blank to hide it"
            maxLength={12}
            className="min-w-0 flex-1 rounded-lg bg-felt-3 px-3 py-2 placeholder:text-dim/70"
          />
        </label>
      </section>

      <section className="flex flex-col gap-4">
        {cfg.players.map((p, i) => {
          const past = [...(memory.decks.get(p.name.trim().toLowerCase())?.values() ?? [])]
            .filter((d) => (isCmdr ? d.format === 'commander' : d.format !== 'commander'))
            .slice(0, 6);
          return (
            <div key={i} className="rounded-xl bg-felt-2 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brass font-cond font-bold text-felt">{i + 1}</span>
                <span className="text-sm text-dim">{seatPosition(layout, i)}</span>
                <button
                  type="button"
                  onClick={() => swap(i)}
                  className="ml-auto rounded px-2 py-1 text-sm text-dim hover:bg-felt-3 hover:text-bone"
                >
                  Swap with seat {((i + 1) % cfg.players.length) + 1}
                </button>
              </div>

              <input
                list="names"
                value={p.name}
                onChange={(e) => setPlayer(i, { name: e.target.value })}
                placeholder="Player name"
                className="mb-3 w-full rounded-lg bg-felt-3 px-3 py-2.5 text-lg font-semibold placeholder:font-normal placeholder:text-dim/70"
                autoComplete="off"
              />

              {past.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {past.map(({ setup }) => (
                    <button
                      key={deckKey(setup)}
                      type="button"
                      onClick={() => setPlayer(i, { ...setup, name: p.name })}
                      className="flex items-center gap-2 rounded-full bg-felt-3 px-3 py-1 text-sm hover:bg-line"
                    >
                      <Pips colors={setup.colors} size={9} />
                      {setup.commander?.name ?? setup.deckName ?? setup.theme}
                      {setup.hasPartner && setup.partner ? ` + ${setup.partner.name}` : ''}
                    </button>
                  ))}
                </div>
              )}

              {isCmdr ? (
                <div className="flex flex-col gap-3">
                  <CommanderPicker
                    value={p.commander}
                    onChange={(c) =>
                      setPlayer(i, {
                        commander: c,
                        colors: unionColors(c?.colorIdentity, p.hasPartner ? p.partner?.colorIdentity : undefined),
                      })
                    }
                  />
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={p.hasPartner}
                      onChange={(e) =>
                        setPlayer(i, {
                          hasPartner: e.target.checked,
                          colors: unionColors(p.commander?.colorIdentity, e.target.checked ? p.partner?.colorIdentity : undefined),
                        })
                      }
                      className="h-5 w-5 accent-[var(--color-brass)]"
                    />
                    Partner or second commander
                  </label>
                  {p.hasPartner && (
                    <CommanderPicker
                      value={p.partner}
                      placeholder="Search partner or background"
                      onChange={(c) =>
                        setPlayer(i, { partner: c, colors: unionColors(p.commander?.colorIdentity, c?.colorIdentity) })
                      }
                    />
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <ManaPicker value={p.colors} onChange={(colors) => setPlayer(i, { colors })} />
                  </div>
                  <div>
                    <div className="mb-1.5 text-sm text-dim">Bracket</div>
                    <Segmented
                      label="Bracket"
                      value={p.bracket ?? 0}
                      onChange={(b) => setPlayer(i, { bracket: b ? (b as PlayerSetup['bracket']) : undefined })}
                      options={BRACKETS.map((b) => ({
                        v: b.n,
                        label: (
                          <span className="flex flex-col leading-tight">
                            <span className="font-cond text-lg font-bold">{b.n}</span>
                            <span className="text-[10px]">{b.name}</span>
                          </span>
                        ),
                      }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <input
                    value={p.deckName ?? ''}
                    onChange={(e) => setPlayer(i, { deckName: e.target.value })}
                    placeholder="Deck name"
                    className="w-full rounded-lg bg-felt-3 px-3 py-2.5 placeholder:text-dim/70"
                  />
                  <input
                    list="themes"
                    value={p.theme ?? ''}
                    onChange={(e) => setPlayer(i, { theme: e.target.value })}
                    placeholder="Theme, like aggro, tokens, control"
                    className="w-full rounded-lg bg-felt-3 px-3 py-2.5 placeholder:text-dim/70"
                  />
                  <ManaPicker value={p.colors} onChange={(colors) => setPlayer(i, { colors })} />
                </div>
              )}
            </div>
          );
        })}
      </section>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-felt via-felt/95 to-transparent px-4 pb-4 pt-8">
        <ConfirmBtn
          variant="primary"
          skip={!game}
          onConfirm={begin}
          confirmLabel="Tap again to drop the unfinished game"
          className="mx-auto block w-full max-w-2xl py-4 font-cond text-2xl"
        >
          Start game
        </ConfirmBtn>
      </div>
    </Page>
  );
}

function unionColors(a?: Mana[], b?: Mana[]): Mana[] {
  return sortMana([...new Set([...(a ?? []), ...(b ?? [])])]);
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-lg bg-felt-2 px-3 py-2">
      <div className="text-xs text-dim">{label}</div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(min, value - step))}
          className="h-9 w-9 rounded-md text-2xl text-dim hover:bg-felt-3 hover:text-bone"
        >
          −
        </button>
        <span className="font-cond text-3xl font-bold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          onClick={() => onChange(Math.min(max, value + step))}
          className="h-9 w-9 rounded-md text-2xl text-dim hover:bg-felt-3 hover:text-bone"
        >
          +
        </button>
      </div>
    </div>
  );
}

function LayoutThumb({ layout, selected, onClick }: { layout: Layout; selected: boolean; onClick: () => void }) {
  const portrait = layout.orientation === 'portrait';
  const arrow: Record<number, string> = { 0: '↓', 90: '←', 180: '↑', 270: '→' };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition ${selected ? 'bg-felt-3 ring-2 ring-brass' : 'bg-felt-2 hover:bg-felt-3'}`}
    >
      <div
        className="grid gap-[3px] rounded-md bg-black/40 p-[3px]"
        style={{
          width: portrait ? 56 : 92,
          height: portrait ? 92 : 56,
          gridTemplateAreas: layout.areas.map((r) => `"${r}"`).join(' '),
        }}
      >
        {layout.rot.map((r, i) => (
          <div
            key={i}
            className="grid place-items-center rounded-[3px] bg-felt-3 font-cond text-xs font-bold leading-none"
            style={{ gridArea: String.fromCharCode(97 + i) }}
          >
            <span>
              {i + 1}
              <span className="ml-px text-[9px] text-dim">{arrow[r]}</span>
            </span>
          </div>
        ))}
      </div>
      <span className="text-[11px] text-dim">{layout.label}</span>
    </button>
  );
}
