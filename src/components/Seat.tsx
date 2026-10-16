import { useEffect, useRef, useState } from 'react';
import { CMDR_LETHAL, POISON_LETHAL, lethalCause, type Action } from '../game';
import type { Rot } from '../layouts';
import type { LiveGame } from '../types';
import { ColorStripe, causeLabel, manaVar, sortMana } from '../ui';
import { Crown, Skull } from './icons';
import { usePress } from './usePress';

interface Props {
  game: LiveGame;
  seat: number;
  rot: Rot;
  area: string;
  headerPad?: { side: 'left' | 'right' | 'both'; px: number } | null;
  dispatch: (a: Action) => void;
}

export default function Seat({ game, seat, rot, area, headerPad, dispatch }: Props) {
  const p = game.players[seat];
  const setup = game.config.players[seat];
  const [panel, setPanel] = useState(false);
  const delta = useDelta(p.life);
  const isCmdr = game.config.format === 'commander';
  const lethal = game.phase === 'playing' ? lethalCause(game, p) : null;
  const cmdrMax = Math.max(0, ...Object.values(p.cmdr));
  const art = setup.commander?.artCrop;
  const colors = sortMana(setup.colors);
  const extraName = game.config.extraCounter?.trim();

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
          {art && <div className="art" style={{ backgroundImage: `url(${art})` }} />}
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
              <div className="truncate font-semibold" style={{ fontSize: 'clamp(13px, 8cqh, 26px)' }}>
                {setup.name}
              </div>
              <div className="truncate text-bone/70" style={{ fontSize: 'clamp(10px, 5.2cqh, 16px)' }}>
                {setup.commander?.name ?? setup.deckName ?? ''}
                {setup.hasPartner && setup.partner ? ` + ${setup.partner.name}` : ''}
              </div>
            </div>
          </div>

          {/* life with tap halves */}
          <div className="absolute inset-0 flex">
            <button aria-label={`${setup.name} lose 1 life`} className="flex-1" {...minus}>
              <span className="absolute left-[6cqw] top-1/2 -translate-y-1/2 font-cond text-bone/35" style={{ fontSize: 'clamp(20px, 14cqh, 52px)' }}>
                −
              </span>
            </button>
            <button aria-label={`${setup.name} gain 1 life`} className="flex-1" {...plus}>
              <span className="absolute right-[6cqw] top-1/2 -translate-y-1/2 font-cond text-bone/35" style={{ fontSize: 'clamp(20px, 14cqh, 52px)' }}>
                +
              </span>
            </button>
          </div>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative">
              <div className={`life-num ${p.life <= 0 ? 'text-blood' : ''}`}>{p.life}</div>
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
              onClick={() => setPanel(true)}
              className="flex items-baseline gap-[0.9em] rounded-full bg-black/50 px-[0.9em] py-[0.35em] backdrop-blur-sm"
              aria-label="Counters"
            >
              <Count label="Poison" value={p.poison} hot={p.poison > 0} />
              {isCmdr && <Count label="Cmdr" value={cmdrMax} hot={cmdrMax > 0} />}
              {extraName && <Count label={extraName} value={p.extra ?? 0} hot={(p.extra ?? 0) > 0} />}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => dispatch({ t: 'monarch', seat })}
              aria-pressed={game.monarchSeat === seat}
              aria-label="Monarch"
              className={`rounded-full p-1.5 ${game.monarchSeat === seat ? 'bg-brass-2 text-felt' : 'bg-black/45 text-bone/50'}`}
            >
              <Crown size="1.3em" />
            </button>
          </div>

          {panel && <CounterPanel game={game} seat={seat} dispatch={dispatch} close={() => setPanel(false)} />}

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
                  <span className="block font-sans text-[0.45em] font-medium text-dim">or tap the die for a random pick</span>
                </span>
              )}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center grayscale">
              <Skull size="22cqh" className="text-bone/60" />
              <div className="font-cond font-bold" style={{ fontSize: 'clamp(16px, 10cqh, 34px)' }}>
                Out in round {p.out.round}
              </div>
              <div className="text-bone/60" style={{ fontSize: 'clamp(11px, 5.5cqh, 16px)' }}>
                {causeLabel[p.out.cause]}
              </div>
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

function Count({ label, value, hot }: { label: string; value: number; hot: boolean }) {
  return (
    <span className="flex items-baseline gap-[0.3em] whitespace-nowrap">
      <span className="text-[0.75em] text-bone/70">{label}</span>
      <span className={`font-cond text-[1.15em] font-bold tabular-nums ${hot ? 'text-brass-2' : ''}`}>{value}</span>
    </span>
  );
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

function CounterPanel({
  game,
  seat,
  dispatch,
  close,
}: {
  game: LiveGame;
  seat: number;
  dispatch: (a: Action) => void;
  close: () => void;
}) {
  const p = game.players[seat];
  const isCmdr = game.config.format === 'commander';
  const sources: { from: number; partner: 0 | 1; label: string; who: string; colors: string[] }[] = [];
  if (isCmdr) {
    game.config.players.forEach((op, i) => {
      if (i === seat) return;
      const c = op.colors.length ? sortMana(op.colors).map((m) => manaVar[m]) : [manaVar.C];
      sources.push({ from: i, partner: 0, who: op.name, label: op.commander?.name ?? 'Commander', colors: c });
      if (op.hasPartner) sources.push({ from: i, partner: 1, who: op.name, label: op.partner?.name ?? 'Partner', colors: c });
    });
  }
  const extraName = game.config.extraCounter?.trim();
  const tiles = sources.length + 1 + (extraName ? 1 : 0);
  const cols = tiles <= 2 ? tiles : tiles <= 6 ? 3 : 4;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-felt/95 p-[2.5cqh]" style={{ fontSize: 'clamp(10px, 5cqh, 16px)' }}>
      <div className="grid flex-1 gap-[1.5cqh]" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        <Tile
          label="Poison"
          who={`${POISON_LETHAL} is lethal`}
          value={p.poison}
          lethal={p.poison >= POISON_LETHAL}
          stripe={[manaVar.G]}
          onPlus={() => dispatch({ t: 'poison', seat, d: 1 })}
          onMinus={() => dispatch({ t: 'poison', seat, d: -1 })}
        />
        {extraName && (
          <Tile
            label={extraName}
            who="Misplays"
            value={p.extra ?? 0}
            lethal={false}
            stripe={['var(--color-brass)']}
            onPlus={() => dispatch({ t: 'extra', seat, d: 1 })}
            onMinus={() => dispatch({ t: 'extra', seat, d: -1 })}
          />
        )}
        {sources.map((s) => {
          const v = p.cmdr[`${s.from}:${s.partner}`] ?? 0;
          return (
            <Tile
              key={`${s.from}:${s.partner}`}
              label={s.label}
              who={`Cmdr damage from ${s.who}`}
              value={v}
              lethal={v >= CMDR_LETHAL}
              stripe={s.colors}
              onPlus={() => dispatch({ t: 'cmdr', seat, from: s.from, partner: s.partner, d: 1 })}
              onMinus={() => dispatch({ t: 'cmdr', seat, from: s.from, partner: s.partner, d: -1 })}
            />
          );
        })}
      </div>
      <div className="mt-[2cqh] flex gap-2">
        {!p.out && game.phase === 'playing' && (
          <button
            className="rounded-lg bg-felt-3 px-3 py-[1.6cqh] text-bone/80"
            onClick={() => {
              dispatch({ t: 'out', seat, cause: 'concede' });
              close();
            }}
          >
            Concede
          </button>
        )}
        <button className="flex-1 rounded-lg bg-brass px-3 py-[1.6cqh] font-semibold text-felt" onClick={close}>
          Done
        </button>
      </div>
    </div>
  );
}

function Tile({
  label,
  who,
  value,
  lethal,
  stripe,
  onPlus,
  onMinus,
}: {
  label: string;
  who: string;
  value: number;
  lethal: boolean;
  stripe: string[];
  onPlus: () => void;
  onMinus: () => void;
}) {
  return (
    <div className={`relative flex min-h-0 overflow-hidden rounded-lg bg-felt-3 ${lethal ? 'ring-2 ring-blood' : ''}`}>
      <div className="absolute inset-x-0 top-0 flex h-[3px]">
        {stripe.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <button onClick={onPlus} className="flex min-w-0 flex-1 flex-col items-center justify-center px-1 pt-1" aria-label={`Add ${label}`}>
        <span className="w-full truncate text-center font-semibold leading-tight">{label}</span>
        <span className="w-full truncate text-center text-[0.8em] text-dim">{who}</span>
        <span className={`font-cond font-bold leading-none tabular-nums ${lethal ? 'text-blood' : ''}`} style={{ fontSize: '2.6em' }}>
          {value}
        </span>
      </button>
      <button onClick={onMinus} className="w-[30%] max-w-12 border-l border-line/60 font-cond text-[1.6em] text-dim" aria-label={`Remove ${label}`}>
        −
      </button>
    </div>
  );
}
