import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { alive, seated, toRecord, type Action } from '../game';
import TrophyList from '../components/Trophies';
import type { LiveGame } from '../types';
import SeatEditor from '../components/SeatEditor';
import { funOn, setFun, toast } from '../components/toastBus';
import { setTips, tipsFor } from '../components/tips';
import { HATCH, ZENKAI, fmtSecs, trophies } from '../eggs';
import { getLayout, seatLetter, type Layout } from '../layouts';
import { useStore } from '../store';
import Seat from '../components/Seat';
import SpinDie from '../components/SpinDie';
import ConfirmBtn from '../components/ConfirmBtn';
import { Btn, Pips } from '../ui';

/** Size of the table area: the screen minus the notch, status bar and home bar. */
function useBox(ref: RefObject<HTMLDivElement | null>, live: boolean) {
  const [v, setV] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setV({ w: el.clientWidth || window.innerWidth, h: el.clientHeight || window.innerHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener('orientationchange', read);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', read);
    };
  }, [ref, live]);
  return v;
}

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const get = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        /* not supported or denied */
      }
    };
    const vis = () => document.visibilityState === 'visible' && get();
    get();
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      lock?.release().catch(() => {});
    };
  }, []);
}

export default function Play() {
  const { game, dispatch, undo, canUndo, saveAndClose, discard, start } = useStore();
  const nav = useNavigate();
  const areaRef = useRef<HTMLDivElement>(null);
  const vp = useBox(areaRef, !!game);
  const [menu, setMenu] = useState<null | 'main' | 'end'>(null);
  const [editing, setEditing] = useState<number | null>(null);
  // tips show for the first few games on this phone; the menu switch overrides that
  const autoTips = useMemo(() => (game ? tipsFor(game.id) : false), [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tipsChoice, setTipsChoice] = useState<boolean | null>(null);
  const tipsOn = tipsChoice ?? autoTips;
  const tip = useRoundTip(game, tipsOn);
  useWakeLock();

  if (!game) return <Navigate to="/" replace />;

  const layout = getLayout(game.config.layoutId);
  const portrait = layout.orientation === 'portrait';
  const vpPortrait = vp.h >= vp.w;
  const turned = portrait !== vpPortrait;
  const long = Math.max(vp.w, vp.h);
  const short = Math.min(vp.w, vp.h);
  const w = portrait ? short : long;
  const h = portrait ? long : short;

  // the die reads upright for whoever went first, since they change the round
  const facing = game.firstSeat != null ? layout.rot[game.firstSeat] : 0;
  const spunYet = game.events.some((e) => e.kind === 'turn');
  const d20Size = Math.round(Math.min(w, h) * 0.2);

  const finish = async (rematch: boolean) => {
    const cfg = game.config;
    const id = game.id;
    if (!rematch) nav(`/history/${id}`, { replace: true });
    await saveAndClose();
    if (rematch) start(cfg);
  };
  const pads = centerPads(layout, w, h, d20Size);

  return (
    <div className="table-root">
      <div ref={areaRef} className="table-area">
      <div
        className="table"
        style={{
          width: w,
          height: h,
          rotate: turned ? '90deg' : '0deg',
          gridTemplateAreas: layout.areas.map((r) => `"${r}"`).join(' '),
          gridTemplateColumns: `repeat(${layout.areas[0].split(' ').length}, 1fr)`,
          gridTemplateRows: `repeat(${layout.areas.length}, 1fr)`,
        }}
      >
        {game.players.map((p) => (
          <Seat
            key={p.seat}
            game={game}
            seat={p.seat}
            rot={layout.rot[p.seat]}
            area={seatLetter(p.seat)}
            headerPad={pads[p.seat]}
            onEdit={() => setEditing(p.seat)}
            dispatch={dispatch}
            coach={tipsOn && game.phase === 'playing' && !spunYet}
          />
        ))}

        {game.phase === 'seating' && seated(game) && (
          <button
            onClick={() => dispatch({ t: 'ready' })}
            className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-brass px-5 py-3 font-cond text-xl font-bold leading-tight text-felt shadow-2xl"
          >
            Everyone's in
            <span className="block font-sans text-sm font-semibold">Pick who goes first</span>
          </button>
        )}

        {game.phase !== 'over' && !(game.phase === 'seating' && seated(game)) && (
          <SpinDie
            value={game.phase === 'playing' ? game.round : game.phase === 'choosingFirst' ? '?' : ''}
            size={d20Size}
            facing={facing}
            hint={game.phase === 'playing' && !spunYet && !tip.open ? 'Spin clockwise for round 2' : undefined}
            label={
              game.phase === 'seating'
                ? 'Game menu'
                : game.phase === 'choosingFirst'
                ? 'Pick a random first player'
                : `Round ${game.round}. Spin clockwise for the next round, counterclockwise to go back. Tap for menu.`
            }
            onSpin={(d) => {
              dispatch({ t: 'round', d });
              if (d < 0) return;
              const said = (seat: number, id: string) =>
                game.events.some((e) => e.kind === 'egg' && e.seat === seat && e.egg === id);
              // survived a full round at exactly 1 life
              if (!funOn()) return;
              for (const p of game.players)
                if (p.life === 1 && !p.out && !said(p.seat, ZENKAI.id)) {
                  dispatch({ t: 'egg', seat: p.seat, egg: ZENKAI.id });
                  toast(p.seat, ZENKAI.text);
                }
              if (game.round + 1 === 108 && game.firstSeat != null && !said(game.firstSeat, HATCH.id)) {
                dispatch({ t: 'egg', seat: game.firstSeat, egg: HATCH.id });
                game.players.forEach((p) => toast(p.seat, HATCH.text));
              }
            }}
            onTap={() => (game.phase === 'choosingFirst' ? dispatch({ t: 'random' }) : setMenu('main'))}
            spinnable={game.phase === 'playing'}
          />
        )}

        {tip.open && game.phase === 'playing' && !spunYet && game.firstSeat != null && (
          <RoundTip
            name={game.config.players[game.firstSeat].name}
            facing={facing}
            gap={Math.round(d20Size * 0.62)}
            // measured along the first player's own left-right, which is the table's height when they sit on a side
            width={Math.round((facing % 180 ? h : w) * 0.7)}
            onClose={tip.close}
          />
        )}

        {game.phase === 'over' && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-4">
            <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-felt-2 p-5 shadow-2xl">
              <div className="mb-1 text-sm text-dim">
                {game.round} {game.round === 1 ? "round" : "rounds"}, {Math.max(1, Math.round(((game.endedAt ?? Date.now()) - game.startedAt) / 60000))} min
              </div>
              <div className="mb-4 font-cond text-4xl font-bold">
                {game.winnerSeat != null ? `${game.config.players[game.winnerSeat].name} wins` : 'Draw'}
              </div>
              {game.winnerSeat != null && (
                <div className="-mt-3 mb-4 flex items-center gap-2 text-dim">
                  <Pips colors={game.config.players[game.winnerSeat].colors} />
                  {game.config.players[game.winnerSeat].commander?.name ?? game.config.players[game.winnerSeat].deckName}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Btn variant="primary" onClick={() => finish(false)}>
                  Save game
                </Btn>
                <Btn onClick={() => finish(true)}>Save and rematch</Btn>
                <TakeBack game={game} dispatch={dispatch} />
              </div>
              {(() => {
                const t = trophies(toRecord(game));
                return t.length ? (
                  <div className="mt-5 border-t border-line pt-4">
                    <TrophyList items={t} compact />
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        )}

        {menu && (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={() => setMenu(null)}>
            <div className="w-full max-w-sm rounded-2xl bg-felt-2 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {menu === 'main' ? (
                <div className="flex flex-col gap-2">
                  <div className="mb-2 font-cond text-2xl font-bold">
                    {game.phase === 'playing' ? `Round ${game.round}` : 'Game menu'}
                    {game.phase === 'playing' && (
                      <RoundClock since={roundStart(game)} />
                    )}
                  </div>
                  {game.phase === 'playing' && (
                    <div className="flex gap-2">
                      <Btn className="flex-1" disabled={game.round <= 1} onClick={() => dispatch({ t: 'round', d: -1 })}>
                        Round {Math.max(1, game.round - 1)}
                      </Btn>
                      <Btn className="flex-1" onClick={() => dispatch({ t: 'round', d: 1 })}>
                        Round {game.round + 1}
                      </Btn>
                    </div>
                  )}
                  <Btn
                    onClick={() => {
                      undo();
                      setMenu(null);
                    }}
                    disabled={!canUndo}
                  >
                    Undo last change
                  </Btn>
                  {game.phase === 'playing' && <Btn onClick={() => setMenu('end')}>End game now</Btn>}
                  <FunToggle />
                  <Btn
                    onClick={() => {
                      setTips(!tipsOn);
                      setTipsChoice(!tipsOn);
                    }}
                    className="flex items-center justify-between"
                  >
                    <span>Tips for new players</span>
                    <span className={tipsOn ? 'text-brass' : 'text-dim'}>{tipsOn ? 'On' : 'Off'}</span>
                  </Btn>
                  <Btn onClick={() => nav('/')}>Leave table, keep game</Btn>
                  <ConfirmBtn
                    variant="quiet"
                    confirmLabel="Tap again to discard without saving"
                    onConfirm={() => {
                      nav('/', { replace: true });
                      discard();
                    }}
                  >
                    Discard game
                  </ConfirmBtn>
                  <Btn onClick={() => setMenu(null)}>Close</Btn>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="mb-2 font-cond text-2xl font-bold">Who won?</div>
                  {alive(game).map((p) => (
                    <Btn
                      key={p.seat}
                      className="flex items-center gap-2 text-left"
                      onClick={() => {
                        dispatch({ t: 'end', winner: p.seat });
                        setMenu(null);
                      }}
                    >
                      <Pips colors={game.config.players[p.seat].colors} size={10} />
                      {game.config.players[p.seat].name}
                    </Btn>
                  ))}
                  <Btn
                    onClick={() => {
                      dispatch({ t: 'end', winner: null });
                      setMenu(null);
                    }}
                  >
                    Draw, nobody won
                  </Btn>
                  <Btn onClick={() => setMenu('main')}>Back</Btn>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
      {editing != null && (
        <SeatEditor
          seat={editing}
          // open facing the player who tapped, the same way their panel faces them
          rot={(layout.rot[editing] + (turned ? 90 : 0)) % 360}
          format={game.config.format}
          subFormat={game.config.subFormat}
          initial={game.config.players[editing]}
          takenNames={game.config.players.filter((_, i) => i !== editing).map((p) => p.name).filter(Boolean)}
          onClose={() => setEditing(null)}
          onSave={(setup) => {
            dispatch({ t: 'seatInfo', seat: editing, setup });
            setEditing(null);
          }}
        />
      )}

    </div>
  );
}

/**
 * The d20 sits at the table's centre. Work out, for each seat, whether that
 * centre touches the far edge of its panel (where the name is) and on which
 * side, so the name can be kept out from under the die.
 */
function centerPads(layout: Layout, w: number, h: number, d20: number) {
  const rows = layout.areas.map((r) => r.split(' '));
  const cw = w / rows[0].length;
  const ch = h / rows.length;
  return layout.rot.map((rot, seat) => {
    const letter = seatLetter(seat);
    const rs: number[] = [];
    const cs: number[] = [];
    rows.forEach((r, ri) => r.forEach((c, ci) => c === letter && (rs.push(ri), cs.push(ci))));
    const x0 = Math.min(...cs) * cw, x1 = (Math.max(...cs) + 1) * cw;
    const y0 = Math.min(...rs) * ch, y1 = (Math.max(...rs) + 1) * ch;
    const vx = w / 2 - (x0 + x1) / 2;
    const vy = h / 2 - (y0 + y1) / 2;
    const r = d20 / 2;
    if (Math.abs(vx) > (x1 - x0) / 2 + r || Math.abs(vy) > (y1 - y0) / 2 + r) return null;
    // screen vector into the panel's own frame
    const [fx, fy, faceW] =
      rot === 90 ? [vy, -vx, y1 - y0] : rot === 270 ? [-vy, vx, y1 - y0] : rot === 180 ? [-vx, -vy, x1 - x0] : [vx, vy, x1 - x0];
    if (fy > 0) return null;
    const rel = fx / (faceW / 2);
    const px = Math.round(r + 6);
    return { side: rel < -0.33 ? 'left' : rel > 0.33 ? 'right' : 'both', px } as const;
  });
}

/** Undo the knockout or win that ended the game and go back to playing. */
function TakeBack({ game, dispatch }: { game: LiveGame; dispatch: (a: Action) => void }) {
  const declared = game.players.some((p) => p.out?.cause === 'opponentWon');
  const last = [...game.players].filter((p) => p.out).sort((a, b) => b.out!.at - a.out!.at)[0];
  if (declared && game.winnerSeat != null) {
    return <Btn onClick={() => dispatch({ t: 'takeBackWin' })}>Take back {game.config.players[game.winnerSeat].name}'s win</Btn>;
  }
  if (last && game.endedAt && last.out!.at >= game.endedAt - 1000) {
    const name = game.config.players[last.seat].name;
    return (
      <Btn onClick={() => dispatch({ t: 'revive', seat: last.seat })}>
        Take back {name}'s knockout
      </Btn>
    );
  }
  return <Btn onClick={() => dispatch({ t: 'takeBackWin' })}>Keep playing</Btn>;
}

/** when the current round began */
function roundStart(g: LiveGame) {
  const e = [...g.events].reverse().find((x) => x.kind === 'turn' || x.kind === 'first');
  return e?.at ?? g.startedAt;
}

/** time spent in the current round, ticking while the menu is open */
function RoundClock({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="ml-2 font-sans text-sm font-normal text-dim">{fmtSecs(Math.max(0, now - since) / 1000)} this round</span>;
}

function FunToggle() {
  const [on, setOn] = useState(funOn);
  return (
    <Btn
      onClick={() => {
        setFun(!on);
        setOn(!on);
      }}
      className="flex items-center justify-between"
    >
      <span>Fun messages</span>
      <span className={on ? 'text-brass' : 'text-dim'}>{on ? 'On' : 'Off'}</span>
    </Btn>
  );
}

/**
 * Once the first player is picked, a see-through card under the die explains
 * that spinning it moves the round on, and that this is the first player's job.
 * It fades on its own, on a tap, or as soon as the die is spun.
 */
function useRoundTip(game: LiveGame | null, on: boolean) {
  const [open, setOpen] = useState(false);
  const live = on && game?.phase === 'playing' && game.round === 1 && !game.events.some((e) => e.kind === 'turn');
  const id = game?.id;
  useEffect(() => {
    if (!live) return;
    setOpen(true);
    const t = window.setTimeout(() => setOpen(false), 9000);
    return () => {
      window.clearTimeout(t);
      setOpen(false);
    };
  }, [live, id]);
  return { open, close: () => setOpen(false) };
}

function RoundTip({
  name,
  facing,
  gap,
  width,
  onClose,
}: {
  name: string;
  facing: number;
  gap: number;
  width: number;
  onClose: () => void;
}) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-0 w-0"
      style={{ rotate: `${facing}deg` }}
    >
      <button
        type="button"
        onClick={onClose}
        className="tip-in pointer-events-auto absolute left-0 -translate-x-1/2 rounded-2xl border border-brass/40 bg-black/65 px-4 py-3 text-left shadow-2xl backdrop-blur-sm"
        style={{ top: gap, width: Math.min(width, 440) }}
      >
        <span className="block font-cond text-lg font-bold leading-tight text-brass">Round counter</span>
        <span className="mt-1 block text-sm leading-snug text-bone/90">
          {name} went first, so the count is theirs: spin the d20 clockwise at the start of each of their turns.
        </span>
        <span className="mt-1 block text-sm leading-snug text-bone/90">Tap the d20 any time for the menu and Undo.</span>
      </button>
    </div>
  );
}
