import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cmdrLethal, POISON_LETHAL, lethalCause, type Action } from '../game';
import { getLayout, seatLetter, turnAreas, type Rot } from '../layouts';
import { DANDAN_MARKS, isDandan, type LiveGame } from '../types';
import { ColorStripe, causeLabel, manaVar, sortMana } from '../ui';
import { Crown, Poison, Skull, Sword } from './icons';
import { usePress } from './usePress';
import { buzz } from '../haptics';
import { mayWhisper, onToast } from './toastBus';
import { cmdrEgg, lifeEgg, poisonEgg, shame, type Egg } from '../eggs';

export type SheetKind = 'panel' | 'events';

interface Props {
  game: LiveGame;
  seat: number;
  rot: Rot;
  area: string;
  headerPad?: { side: 'left' | 'right' | 'both'; px: number } | null;
  onEdit: () => void;
  /** this player's open full-screen sheet, if any (the table draws it, see SeatSheet) */
  sheet: SheetKind | null;
  setSheet: (s: SheetKind | null) => void;
  dispatch: (a: Action) => void;
  /** show the new-player hints on this panel */
  coach?: boolean;
}

export default function Seat({ game, seat, rot, area, headerPad, onEdit, sheet, setSheet, dispatch, coach }: Props) {
  const p = game.players[seat];
  const setup = game.config.players[seat];
  const panel = sheet != null;
  const delta = useDelta(p.life);
  const isCmdr = game.config.format === 'commander';
  const lethal = game.phase === 'playing' ? lethalCause(game, p) : null;
  const cmdrMax = Math.max(0, ...Object.values(p.cmdr));
  const art = setup.commander?.artCrop;
  const colors = sortMana(setup.colors);
  const extraName = game.config.extraCounter?.trim();
  const dandan = isDandan(game.config);
  const marks = dandan ? game.events.filter((e) => e.seat === seat && DANDAN_MARKS.some((m) => m.kind === e.kind)).length : 0;
  // hints fade once this player has used their panel
  const used = useUsed(coach, `${p.life}|${p.poison}|${JSON.stringify(p.cmdr)}|${panel}`);
  const showCoach = coach && !used && !p.out && !lethal;
  // one hit from lethal: the edge of the panel pulses red
  const danger =
    game.phase === 'playing' &&
    !p.out &&
    !lethal &&
    (p.poison >= POISON_LETHAL - 2 ||
      (isCmdr && cmdrMax >= cmdrLethal(game.config) - 5) ||
      p.life <= Math.max(3, Math.ceil(game.config.startingLife / 8)));
  const shown = useRolling(p.life);
  const flash = useFlash(p.life);

  // quiet easter-egg line
  const [whisper, setWhisper] = useState<{ text: string; key: number } | null>(null);
  const say = (text: string) => setWhisper({ text, key: Date.now() });
  useEffect(() => onToast(seat, say), [seat]);
  useEffect(() => {
    if (!whisper) return;
    const t = window.setTimeout(() => setWhisper(null), 4300);
    return () => window.clearTimeout(t);
  }, [whisper]);

  const live = useRef(game);
  live.current = game;
  const canEgg = () => live.current.phase === 'playing' && !live.current.players[seat].out;
  const fire = (egg: Egg | null) => {
    if (!egg || !canEgg()) return;
    if (live.current.events.some((e) => e.kind === 'egg' && e.seat === seat && e.egg === egg.id)) return;
    if (!mayWhisper(seat)) return;
    dispatch({ t: 'egg', seat, egg: egg.id });
    say(egg.text);
  };
  useSettled(p.life, (before, after) => {
    const others = live.current.players.filter((x) => x.seat !== seat && !x.out);
    fire(lifeEgg(before, after, others.every((x) => x.life <= after)));
  });
  useSettled(p.poison, (_, after) => fire(poisonEgg(after)));
  useSettled(JSON.stringify(p.cmdr), (before, after) => {
    const b = JSON.parse(before) as Record<string, number>;
    const a = JSON.parse(after) as Record<string, number>;
    for (const k of Object.keys(a)) {
      const egg = cmdrEgg(b[k] ?? 0, a[k]);
      if (egg) return fire(egg);
    }
  });

  const shamedRound = useRef(-1);
  useSettled(p.extra ?? 0, (before, after) => {
    // at most one shaming per player per round
    if (after > before && canEgg() && shamedRound.current !== live.current.round && mayWhisper(seat)) {
      shamedRound.current = live.current.round;
      say(shame());
    }
  });
  const star = usePress(
    () => (buzz(), dispatch({ t: 'extra', seat, d: 1 })),
    () => dispatch({ t: 'extra', seat, d: -1 }),
    500,
    1e9,
  );
  // hold your name to fix your deck mid-game (a forgotten commander)
  const nameHold = usePress(() => {}, game.phase === 'playing' ? onEdit : undefined, 600, 1e9);

  const minus = usePress(
    () => dispatch({ t: 'life', seat, d: -1 }),
    () => dispatch({ t: 'life', seat, d: -10 }),
  );
  const plus = usePress(
    () => dispatch({ t: 'life', seat, d: 1 }),
    () => dispatch({ t: 'life', seat, d: 10 }),
  );

  const bg = art
    ? undefined
    : `linear-gradient(135deg, ${(colors.length ? colors : ['C' as const])
        .map((c) => `color-mix(in srgb, ${manaVar[c]} 38%, #111)`)
        .join(', ')})`;

  return (
    <div className="seat" style={{ gridArea: area }}>
      <div className={`face r${rot}`}>
        <div className="face-inner overflow-hidden" style={{ background: bg ?? '#111' }}>
          {art && <div className="art" style={{ backgroundImage: `url("${art}")` }} />}
          <div
            className="absolute inset-0"
            style={{
              background: art
                ? 'linear-gradient(to bottom, rgb(0 0 0 / .55), rgb(0 0 0 / .35) 45%, rgb(0 0 0 / .7))'
                : 'linear-gradient(to bottom, rgb(0 0 0 / .25), rgb(0 0 0 / .45))',
            }}
          />
          <ColorStripe colors={colors} className="absolute inset-x-0 bottom-0 h-[5px]" />

          {/* header: name + commander, far edge from player */}
          <div
            className="absolute inset-x-0 top-0 flex items-start gap-2 px-[4cqw] pt-[3cqh]"
            style={{
              paddingLeft: headerPad && headerPad.side !== 'right' ? headerPad.px : undefined,
              paddingRight: headerPad && headerPad.side !== 'left' ? headerPad.px : undefined,
            }}
          >
            <div className="min-w-0 flex-1">
              <button
                type="button"
                {...nameHold}
                aria-label={`${setup.name}. Hold to change your commander or deck`}
                className="relative z-10 block max-w-full text-left"
              >
              <div className="truncate font-semibold" style={{ fontSize: 'clamp(13px, 8cqh, 26px)' }}>
                {setup.name}
              </div>
              {whisper ? (
                // easter eggs borrow the commander line for a few seconds
                <div
                  key={whisper.key}
                  className="whisper line-clamp-2 italic leading-snug text-brass"
                  style={{ fontSize: 'clamp(10px, 5.2cqh, 16px)' }}
                >
                  {whisper.text}
                </div>
              ) : (
                <div className="truncate text-bone/70" style={{ fontSize: 'clamp(10px, 5.2cqh, 16px)' }}>
                  {setup.commander?.name ?? setup.deckName ?? ''}
                  {setup.hasPartner && setup.partner ? ` + ${setup.partner.name}` : ''}
                </div>
              )}
              </button>
            </div>
            {game.monarchSeat === seat && !p.out && (
              <span className="crown-in shrink-0 text-brass" title="Monarch" aria-label="Monarch" style={{ marginTop: '0.4cqh' }}>
                <Crown size="11cqh" />
              </span>
            )}
          </div>

          {/* life with tap halves */}
          {flash && <div key={flash.key} className={`life-flash ${flash.gain ? 'gain' : 'loss'}`} aria-hidden />}
          {danger && <div className="danger-edge" aria-hidden />}

          <div className="absolute inset-0 flex">
            <button aria-label={`${setup.name} lose 1 life`} className="half half-l flex-1" {...minus}>
              <span className="glyph absolute left-[6cqw] top-1/2 -translate-y-1/2 font-cond text-bone/35" style={{ fontSize: 'clamp(20px, 14cqh, 52px)' }}>
                −
              </span>
            </button>
            <button aria-label={`${setup.name} gain 1 life`} className="half half-r flex-1" {...plus}>
              <span className="glyph absolute right-[6cqw] top-1/2 -translate-y-1/2 font-cond text-bone/35" style={{ fontSize: 'clamp(20px, 14cqh, 52px)' }}>
                +
              </span>
            </button>
          </div>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative">
              <div className={`life-num ${p.life <= 0 ? 'text-blood' : ''} ${p.out ? 'invisible' : ''}`} aria-live="polite">
                {shown}
              </div>
              {delta !== 0 && (
                <div
                  key={delta}
                  className={`delta absolute -right-[2ch] -top-[1.2em] ${delta > 0 ? 'text-mana-g' : 'text-blood'}`}
                  style={{ filter: 'brightness(1.4)' }}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </div>
              )}
            </div>
          </div>

          {/* footer: counters near the player */}
          <div className="absolute inset-x-0 bottom-[5px] flex items-center gap-[2cqw] px-[3cqw] pb-[2.5cqh]" style={{ fontSize: 'clamp(12px, 6.4cqh, 20px)' }}>
            <button
              onClick={() => setSheet('panel')}
              className="relative flex min-h-[2.6em] items-center gap-[0.7em] rounded-full bg-black/60 px-[1.1em] py-[0.55em] transition active:scale-95"
              aria-label={[
                'Counters',
                p.poison ? `${p.poison} poison` : '',
                isCmdr && cmdrMax ? `${cmdrMax} commander damage from one commander` : '',
              ]
                .filter(Boolean)
                .join(', ')}
            >
              <span className="text-[0.85em] text-bone/80">Counters</span>
              {/* what's on this player shows right on the button, so nobody has to open it to check */}
              {p.poison > 0 && (
                    <Badge tone={p.poison >= POISON_LETHAL - 2 ? 'hot' : 'poison'}>
                      <Poison size="1.05em" />
                      {p.poison}
                    </Badge>
                  )}
                  {isCmdr && cmdrMax > 0 && (
                    <Badge tone={cmdrMax >= cmdrLethal(game.config) - 5 ? 'hot' : 'cmdr'}>
                      <Sword size="1.05em" />
                      {cmdrMax}
                    </Badge>
                  )}
            </button>
            {dandan && (
              <button
                onClick={() => setSheet('events')}
                className="flex min-h-[2.6em] items-center gap-[0.5em] rounded-full bg-black/60 px-[1.1em] py-[0.55em] transition active:scale-95"
                aria-label={`Dandân events, ${marks} logged`}
              >
                <span className="text-[0.85em] text-bone/80">Events</span>
                {marks > 0 && <Badge tone="cmdr">{marks}</Badge>}
              </button>
            )}
            <div className="flex-1" />
            {extraName && (
              <button
                {...star}
                aria-label={`${extraName} counter, ${p.extra ?? 0}. Tap to add one, hold to take one back`}
                className={`flex h-[2.6em] min-w-[2.6em] items-center justify-center gap-[0.15em] rounded-full px-[0.6em] font-cond font-bold ${
                  (p.extra ?? 0) > 0 ? 'bg-brass text-felt' : 'bg-black/60 text-bone/80'
                }`}
              >
                <span className="text-[1.5em] leading-none" style={{ marginTop: '0.25em' }}>
                  {extraName}
                </span>
                <span className="text-[1.15em] tabular-nums">{p.extra ?? 0}</span>
              </button>
            )}
          </div>

          {showCoach && <Coach isCmdr={isCmdr} />}

          {game.phase === 'seating' && (
            <button
              onClick={onEdit}
              className={`absolute inset-0 flex flex-col items-center justify-center gap-[1.5cqh] px-4 text-center ${
                setup.name ? 'bg-black/90' : 'bg-felt-2'
              }`}
            >
              {setup.name ? (
                <>
                  <span className="font-cond font-bold" style={{ fontSize: 'clamp(18px, 12cqh, 44px)' }}>
                    {setup.name}
                  </span>
                  <span className="max-w-full truncate text-bone/80" style={{ fontSize: 'clamp(11px, 6cqh, 18px)' }}>
                    {setup.commander?.name ?? setup.deckName ?? ''}
                    {setup.hasPartner && setup.partner ? ` + ${setup.partner.name}` : ''}
                  </span>
                  <span className="text-dim" style={{ fontSize: 'clamp(10px, 5cqh, 15px)' }}>
                    Tap to change
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="grid aspect-square place-items-center rounded-full bg-brass font-cond font-bold text-felt"
                    style={{ width: 'clamp(28px, 16cqh, 56px)', fontSize: 'clamp(16px, 10cqh, 34px)' }}
                  >
                    +
                  </span>
                  <span className="font-cond font-bold" style={{ fontSize: 'clamp(16px, 10cqh, 36px)' }}>
                    Tap to sit here
                  </span>
                </>
              )}
            </button>
          )}

          {game.phase === 'choosingFirst' && (
            <button
              className={`absolute inset-0 grid place-items-center text-center font-cond font-bold transition ${
                game.pickedSeat === seat ? 'bg-brass/90 text-felt' : 'bg-black/80 text-bone'
              }`}
              style={{ fontSize: 'clamp(16px, 11cqh, 40px)' }}
              onClick={() => dispatch({ t: 'pick', seat })}
            >
              {game.pickedSeat === seat ? (
                <span>
                  Going first
                  <span className="block font-sans text-[0.5em] font-semibold">Tap again to confirm</span>
                </span>
              ) : (
                <span>
                  Tap to go first
                </span>
              )}
            </button>
          )}
          {game.phase === 'choosingFirst' && (
            // the seat can still be fixed after everyone sat down
            <button
              onClick={onEdit}
              className="absolute bottom-[4cqh] left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-[0.9em] py-[0.3em] text-bone/70"
              style={{ fontSize: 'clamp(10px, 5cqh, 15px)' }}
            >
              Change seat
            </button>
          )}

          {lethal && !p.lethalDismissed && !panel && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3cqh] bg-black/75 px-4 text-center">
              <div className="font-cond font-bold" style={{ fontSize: 'clamp(16px, 10cqh, 36px)' }}>
                Out to {causeLabel[lethal].toLowerCase()}?
              </div>
              <div className="flex gap-3" style={{ fontSize: 'clamp(13px, 6.5cqh, 20px)' }}>
                <button className="rounded-lg bg-blood px-4 py-2 font-semibold" onClick={() => dispatch({ t: 'out', seat, cause: lethal })}>
                  Eliminate
                </button>
                <button className="rounded-lg bg-felt-3 px-4 py-2" onClick={() => dispatch({ t: 'dismiss', seat })}>
                  Not yet
                </button>
              </div>
            </div>
          )}

          {p.out && (
            <div className="out-veil absolute inset-0 flex flex-col items-center justify-center text-center">
              <Skull size="22cqh" className="text-bone/60" />
              <div className="font-cond font-bold" style={{ fontSize: 'clamp(16px, 10cqh, 34px)' }}>
                Out in round {p.out.round}
              </div>
              <div className="text-bone/60" style={{ fontSize: 'clamp(11px, 5.5cqh, 16px)' }}>
                {causeLabel[p.out.cause]}
              </div>
              {p.out.cause !== 'opponentWon' && (
                <button
                  className="mt-[3cqh] rounded-full border border-bone/30 px-4 py-1.5 text-bone/80"
                  style={{ fontSize: 'clamp(11px, 5.5cqh, 16px)' }}
                  onClick={() => dispatch({ t: 'revive', seat })}
                >
                  Take back
                </button>
              )}
            </div>
          )}
          {p.out && whisper && (
            // the out overlay hides the header, so knockout lines show here instead
            <div
              key={whisper.key}
              className="whisper pointer-events-none absolute inset-x-0 bottom-[6cqh] px-[4cqw] text-center italic leading-snug text-brass"
              style={{ fontSize: 'clamp(11px, 5.5cqh, 16px)' }}
            >
              {whisper.text}
            </div>
          )}

          {game.phase === 'over' && game.winnerSeat === seat && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-brass/25 text-center">
              <Crown size="20cqh" className="text-brass-2" />
              <div className="font-cond font-bold text-brass-2" style={{ fontSize: 'clamp(18px, 12cqh, 44px)' }}>
                Winner
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A player's counters, life keypad or Dandân events, filling the whole table and facing that player. */
export function SeatSheet({
  game,
  seat,
  rot,
  kind,
  setSheet,
  dispatch,
}: {
  game: LiveGame;
  seat: number;
  rot: Rot;
  kind: SheetKind;
  setSheet: (s: SheetKind | null) => void;
  dispatch: (a: Action) => void;
}) {
  const close = () => setSheet(null);
  return (
    // inline, since the unlayered .seat rule would beat Tailwind's position classes
    <div className="seat" style={{ position: 'absolute', inset: 0, zIndex: 35 }}>
      <div className={`face r${rot}`}>
        <div className="face-inner flex flex-col bg-felt">
          <div className="flex items-center gap-3 px-[2.5cqh] pt-[2cqh]" style={{ fontSize: 'clamp(13px, 3.2cqh, 20px)' }}>
            <button
              onClick={close}
              className="flex min-h-[2.6em] items-center rounded-full bg-felt-3 px-[1.1em] font-semibold text-bone/90 active:bg-line"
            >
              ‹ Back
            </button>
            <span className="min-w-0 truncate font-cond text-[1.3em] font-bold">{game.config.players[seat].name}</span>
          </div>
          <div className="relative min-h-0 flex-1">
            {kind === 'events' ? (
              <EventsPanel game={game} seat={seat} dispatch={dispatch} close={close} />
            ) : (
              <CounterPanel game={game} seat={seat} rot={rot} dispatch={dispatch} close={close} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dandân's three game-deciding plays, counted for this player. */
function EventsPanel({ game, seat, dispatch, close }: { game: LiveGame; seat: number; dispatch: (a: Action) => void; close: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col p-[2.5cqh]" style={{ fontSize: 'clamp(12px, 3.2cqh, 20px)' }}>
      <div className="grid min-h-0 flex-1 grid-rows-3 gap-[1.5cqh]">
        {DANDAN_MARKS.map((m) => (
          <Tile
            key={m.kind}
            label={m.label}
            who={m.who}
            value={game.events.filter((e) => e.kind === m.kind && e.seat === seat).length}
            lethal={false}
            stripe={[manaVar.U]}
            onPlus={() => dispatch({ t: 'mark', seat, kind: m.kind, d: 1 })}
            onMinus={() => dispatch({ t: 'mark', seat, kind: m.kind, d: -1 })}
          />
        ))}
      </div>
      <button className="mt-[1.5cqh] h-[11cqh] min-h-11 shrink-0 rounded-xl bg-brass text-[1.15em] font-semibold text-felt active:bg-brass-2" onClick={close}>
        Done
      </button>
    </div>
  );
}

/** true once `sig` changes while `on`; resets when `on` goes off */
function useUsed(on: boolean | undefined, sig: string) {
  const start = useRef<string | null>(null);
  const [used, setUsed] = useState(false);
  useEffect(() => {
    if (!on) {
      start.current = null;
      setUsed(false);
      return;
    }
    if (start.current == null) start.current = sig;
    else if (sig !== start.current) setUsed(true);
  }, [on, sig]);
  return used;
}

/**
 * One hint per panel the first few games, near the player's own edge (clear of the die).
 * Goes away once they use their panel.
 */
function Coach({ isCmdr }: { isCmdr: boolean }) {
  return (
    <div
      className="coach-in pointer-events-none absolute inset-x-0 bottom-[17cqh] flex justify-center px-[3cqw]"
      style={{ fontSize: 'clamp(9px, 4.6cqh, 14px)' }}
    >
      <span className="max-w-full rounded-full bg-black/70 px-[0.9em] py-[0.25em] text-center font-semibold leading-snug text-brass">
        Tap a side ±1 · hold ±10 · Counters for {isCmdr ? 'damage' : 'poison'}
      </span>
    </div>
  );
}

function Badge({ tone, children }: { tone: 'poison' | 'cmdr' | 'hot'; children: ReactNode }) {
  const color = tone === 'hot' ? 'text-blood' : tone === 'poison' ? 'text-mana-g' : 'text-bone/90';
  return (
    <span className={`flex items-center gap-[0.25em] font-cond font-bold leading-none tabular-nums ${color}`} style={{ fontSize: '1.15em' }}>
      {children}
    </span>
  );
}

/** Shown life counts toward the real total instead of jumping, a few steps a frame for big swings. */
function useRolling(target: number) {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (cur.current === target) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      cur.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const tick = () => {
      const gap = target - cur.current;
      if (!gap) return;
      cur.current += Math.sign(gap) * Math.max(1, Math.ceil(Math.abs(gap) / 6));
      setShown(cur.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

/** A quick red or green wash over the panel each time life changes. */
function useFlash(life: number) {
  const prev = useRef(life);
  const [flash, setFlash] = useState<{ key: number; gain: boolean } | null>(null);
  useEffect(() => {
    const diff = life - prev.current;
    prev.current = life;
    if (!diff) return;
    setFlash({ key: Date.now(), gain: diff > 0 });
    const t = window.setTimeout(() => setFlash(null), 600);
    return () => window.clearTimeout(t);
  }, [life]);
  return flash;
}

/** Calls back with the value before and after once it stops changing for a moment. */
function useSettled<T>(value: T, cb: (before: T, after: T) => void, ms = 1200) {
  const prev = useRef(value);
  const start = useRef<{ v: T } | null>(null);
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (value === prev.current) return;
    start.current ??= { v: prev.current };
    prev.current = value;
    const t = window.setTimeout(() => {
      const b = start.current!.v;
      start.current = null;
      if (b !== value) cbRef.current(b, value);
    }, ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
}

/** Running total of recent life changes, cleared after a pause. */
function useDelta(life: number) {
  const prev = useRef(life);
  const [d, setD] = useState(0);
  useEffect(() => {
    const diff = life - prev.current;
    prev.current = life;
    if (!diff) return;
    setD((x) => x + diff);
    const t = window.setTimeout(() => setD(0), 2500);
    return () => window.clearTimeout(t);
  }, [life]);
  return d;
}

/** Commander damage sources for this player: opponents first, then your own commander (it can hit you too, e.g. when stolen). */
function cmdrSources(game: LiveGame, seat: number) {
  const order = [...game.config.players.keys()].filter((i) => i !== seat).concat(seat);
  return order.flatMap((i) => {
    const op = game.config.players[i];
    const who = i === seat ? 'Your own commander' : `from ${op.name}`;
    const colors = op.colors.length ? sortMana(op.colors).map((m) => manaVar[m]) : [manaVar.C];
    const one = (partner: 0 | 1, card: typeof op.commander) => ({
      from: i,
      partner,
      who,
      colors,
      label: card?.name ?? (partner ? 'Partner' : 'Commander'),
      art: card?.artCrop,
    });
    return op.hasPartner ? [one(0, op.commander), one(1, op.partner)] : [one(0, op.commander)];
  });
}

/**
 * Counters: in Commander, one panel per commander, each sitting where its player sits at the
 * table (a partner pair splits its panel in half). Poison, * and monarch stay small along the bottom.
 */
function CounterPanel({ game, seat, rot, dispatch, close }: { game: LiveGame; seat: number; rot: Rot; dispatch: (a: Action) => void; close: () => void }) {
  const p = game.players[seat];
  const extraName = game.config.extraCounter?.trim();
  const isCmdr = game.config.format === 'commander';
  const areas = turnAreas(getLayout(game.config.layoutId).areas, rot);
  const sources = cmdrSources(game, seat);
  const king = game.monarchSeat === seat;
  const poison = { label: 'Poison', value: p.poison, lethal: p.poison >= POISON_LETHAL, onPlus: () => dispatch({ t: 'poison', seat, d: 1 }), onMinus: () => dispatch({ t: 'poison', seat, d: -1 }) };
  const star = extraName && { label: extraName, value: p.extra ?? 0, lethal: false, onPlus: () => dispatch({ t: 'extra', seat, d: 1 }), onMinus: () => dispatch({ t: 'extra', seat, d: -1 }) };

  return (
    <div className="absolute inset-0 z-10 flex flex-col gap-[1.5cqh] p-[2.5cqh]" style={{ fontSize: 'clamp(13px, 3.6cqh, 22px)' }}>
      {isCmdr ? (
        <div
          className="grid min-h-0 flex-1 gap-[1.5cqh]"
          style={{
            gridTemplateAreas: areas.map((r) => `"${r.join(' ')}"`).join(' '),
            gridTemplateColumns: `repeat(${areas[0].length}, 1fr)`,
            gridTemplateRows: `repeat(${areas.length}, 1fr)`,
          }}
        >
          {game.config.players.map((_, i) => (
            <div key={i} className={`grid min-h-0 auto-cols-fr grid-flow-col gap-[1cqh] rounded-xl ${i === seat ? 'ring-2 ring-brass/70' : ''}`} style={{ gridArea: seatLetter(i) }}>
              {sources
                .filter((s) => s.from === i)
                .map((s) => {
                  const v = p.cmdr[`${s.from}:${s.partner}`] ?? 0;
                  return (
                    <Tile
                      key={s.partner}
                      label={s.label}
                      who={s.who}
                      value={v}
                      lethal={v >= cmdrLethal(game.config)}
                      stripe={s.colors}
                      art={s.art}
                      onPlus={() => dispatch({ t: 'cmdr', seat, from: s.from, partner: s.partner, d: 1 })}
                      onMinus={() => dispatch({ t: 'cmdr', seat, from: s.from, partner: s.partner, d: -1 })}
                    />
                  );
                })}
            </div>
          ))}
        </div>
      ) : (
        // other formats have no commanders, so poison and * get the room
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-[1.5cqh]">
          <Tile {...poison} who={`${POISON_LETHAL} is lethal`} stripe={[manaVar.G]} />
          {star && <Tile {...star} who="Misplays" stripe={[manaVar.R]} />}
        </div>
      )}
      <div className="flex h-[11cqh] min-h-11 shrink-0 items-stretch gap-[1.2cqh]">
        {isCmdr && <Mini {...poison} />}
        {isCmdr && star && <Mini {...star} />}
        <button
          onClick={() => (buzz(), dispatch({ t: 'monarch', seat }))}
          aria-pressed={king}
          aria-label={king ? 'Monarch. Tap to take the crown off' : 'Tap to become the monarch'}
          className={`flex items-center gap-[0.4em] rounded-full px-[0.9em] text-[0.85em] ${king ? 'bg-brass text-felt' : 'bg-felt-3 text-bone/70'}`}
        >
          <Crown size="1.2em" /> Monarch
        </button>
        <div className="flex-1" />
        {!p.out && game.phase === 'playing' && (
          <>
            <TwoTap label="Win" className="bg-brass/20 px-[0.9em] text-[0.85em] text-brass" onConfirm={() => (dispatch({ t: 'win', seat }), close())} />
            <TwoTap label="Lose" className="bg-felt-3 px-[0.9em] text-[0.85em] text-bone/80" onConfirm={() => (dispatch({ t: 'out', seat, cause: 'lose' }), close())} />
            <TwoTap label="Concede" className="bg-felt-3 px-[0.9em] text-[0.85em] text-bone/80" onConfirm={() => (dispatch({ t: 'out', seat, cause: 'concede' }), close())} />
          </>
        )}
      </div>
    </div>
  );
}

/** A small − count + pill for the bottom strip. */
function Mini({ label, value, lethal, onPlus, onMinus }: { label: string; value: number; lethal: boolean; onPlus: () => void; onMinus: () => void }) {
  return (
    <div className={`flex items-center rounded-full bg-felt-3 ${lethal ? 'ring-2 ring-blood' : ''}`}>
      <button onClick={() => (buzz(), onMinus())} aria-label={`Remove ${label}`} className="h-full pl-[0.9em] pr-[0.5em] font-cond text-[1.3em] text-bone/50">
        −
      </button>
      <span className="whitespace-nowrap text-[0.85em] text-bone/80">
        {label} <b className={`font-cond text-[1.3em] tabular-nums ${lethal ? 'text-blood' : 'text-bone'}`}>{value}</b>
      </span>
      <button onClick={() => (buzz(), onPlus())} aria-label={`Add ${label}`} className="h-full pl-[0.5em] pr-[0.9em] font-cond text-[1.3em] text-bone/50">
        +
      </button>
    </div>
  );
}

/** Needs a second tap within a few seconds, so a stray tap can't end someone's game. */
function TwoTap({ label, className, onConfirm }: { label: string; className: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`h-full rounded-xl px-2 text-[1.1em] font-semibold ${armed ? 'bg-blood text-bone' : className}`}
      onClick={() => (buzz(), armed ? onConfirm() : setArmed(true))}
    >
      {armed ? `${label}?` : label}
    </button>
  );
}

/** A number with − on the left half and + on the right, the same as the life total on the table. */
function Tile({
  label,
  who,
  value,
  lethal,
  stripe,
  art,
  onPlus,
  onMinus,
}: {
  label: string;
  who: string;
  value: number;
  lethal: boolean;
  stripe: string[];
  art?: string;
  onPlus: () => void;
  onMinus: () => void;
}) {
  return (
    <div className={`relative flex min-h-0 overflow-hidden rounded-xl bg-felt-3 ${lethal ? 'ring-2 ring-blood' : ''}`}>
      {art && (
        <>
          <div className="art" style={{ backgroundImage: `url("${art}")` }} />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}
      <div className="absolute inset-x-0 top-0 flex h-[3px]">
        {stripe.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[2.2em] text-center">
        <span className="w-full truncate font-semibold leading-tight">{label}</span>
        <span className="w-full truncate text-[0.8em] text-bone/60">{who}</span>
        <span className={`font-cond font-bold leading-none tabular-nums ${lethal ? 'text-blood' : ''}`} style={{ fontSize: '2.8em' }}>
          {value}
        </span>
      </div>
      <button onClick={() => (buzz(), onMinus())} className="half flex-1" aria-label={`Remove ${label}`}>
        <span className="glyph absolute top-1/2 left-[0.5em] -translate-y-1/2 font-cond text-[1.8em] text-bone/40">−</span>
      </button>
      <button onClick={() => (buzz(), onPlus())} className="half flex-1" aria-label={`Add ${label}`}>
        <span className="glyph absolute top-1/2 right-[0.5em] -translate-y-1/2 font-cond text-[1.8em] text-bone/40">+</span>
      </button>
    </div>
  );
}
