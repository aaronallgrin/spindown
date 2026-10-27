import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Navigate } from 'react-router-dom';
import { useNavigate } from '../nav';
import { alive, seated, toRecord, type Action } from '../game';
import TrophyList from '../components/Trophies';
import type { LiveGame } from '../types';
import SeatEditor from '../components/SeatEditor';
import { funOn, setFun, toast } from '../components/toastBus';
import { setTips, tipsFor } from '../components/tips';
import { HATCH, THREAT, TIM_CLEAN, ZENKAI, fmtSecs, rageQuit, threatSeat, timCleanWin, trophies } from '../eggs';
import { getLayout, seatLetter, type Layout } from '../layouts';
import { useStore } from '../store';
import Seat, { SeatSheet, type SheetKind } from '../components/Seat';
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

/** Pin the page while the table is up so a browser tab can't scroll under the seats. */
function useTableLock() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('table-lock');
    window.scrollTo(0, 0);
    return () => html.classList.remove('table-lock');
  }, []);
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

type Sheet = { seat: number; kind: SheetKind };

export default function Play() {
  const { game, dispatch, undo, canUndo, saveAndClose, discard, start } = useStore();
  const nav = useNavigate();
  const areaRef = useRef<HTMLDivElement>(null);
  const vp = useBox(areaRef, !!game);
  const [menu, setMenu] = useState<null | 'main' | 'end'>(null);
  const [editing, setEditing] = useState<number | null>(null);
  // one player's counters, life keypad or Dandân events open at a time, over the whole table
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [banner, setBanner] = useState(false);
  // tips show for the first few games on this phone; the menu switch overrides that
  const autoTips = useMemo(() => (game ? tipsFor(game.id) : false), [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tipsChoice, setTipsChoice] = useState<boolean | null>(null);
  const tipsOn = tipsChoice ?? autoTips;
  const tip = useRoundTip(game, tipsOn);
  useWakeLock();
  useTableLock();
  useOutNotes(game, dispatch);

  // once the last seat is filled, go straight to picking who goes first
  const allSeated = !!game && game.phase === 'seating' && seated(game);
  useEffect(() => {
    if (allSeated && editing == null) dispatch({ t: 'ready' });
  }, [allSeated, editing, dispatch]);
  // and say so for a moment, without needing a tap
  const choosing = game?.phase === 'choosingFirst';
  useEffect(() => {
    if (choosing) setBanner(true);
  }, [choosing]);
  useEffect(() => {
    if (game?.phase !== 'playing') setSheet(null);
  }, [game?.phase]);

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
            sheet={sheet?.seat === p.seat ? sheet.kind : null}
            setSheet={(kind) => setSheet(kind ? { seat: p.seat, kind } : null)}
            dispatch={dispatch}
            coach={tipsOn && game.phase === 'playing' && !spunYet}
          />
        ))}

        {sheet && (
          <SeatSheet
            game={game}
            seat={sheet.seat}
            rot={layout.rot[sheet.seat]}
            kind={sheet.kind}
            setSheet={(kind) => setSheet(kind ? { seat: sheet.seat, kind } : null)}
            dispatch={dispatch}
          />
        )}

        {banner && game.phase === 'choosingFirst' && (
          <div
            className="first-banner pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-2xl bg-brass px-5 py-3 text-center font-cond text-xl font-bold leading-tight text-felt shadow-2xl"
            onAnimationEnd={() => setBanner(false)}
          >
            Everyone's in
            <span className="block font-sans text-sm font-semibold">Pick who goes first</span>
          </div>
        )}

        {game.phase !== 'over' && (
          <SpinDie
            value={game.phase === 'playing' ? game.round : ''}
            size={d20Size}
            facing={facing}
            hint={game.phase === 'playing' && !spunYet && !tip.open ? 'Tap for round 2 · hold for menu' : undefined}
            label={
              game.phase === 'seating'
                ? 'Game menu'
                : game.phase === 'choosingFirst'
                ? 'Roll a d20'
                : `Round ${game.round}. Tap for the next round, double-tap to go back one, hold for the menu.`
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
            onTap={() => setMenu('main')}
            onHold={() => setMenu('main')}
            spinnable={game.phase === 'playing'}
            dice={game.phase === 'choosingFirst'}
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
            <div className="relative max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-felt-2 p-5 shadow-2xl">
              <EndedByConcede game={game} />
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
                <div className="flex gap-2">
                  <Btn variant="primary" className="flex-1" onClick={() => finish(true)}>
                    Rematch
                  </Btn>
                  <Btn className="flex-1" onClick={() => finish(false)}>
                    Save game
                  </Btn>
                </div>
                <div className="-mt-1 text-center text-xs text-dim">Both save this game. Rematch keeps the same players and decks.</div>
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

        {game.phase === 'over' &&
          game.winnerSeat != null &&
          funOn() &&
          timCleanWin(game.config.players[game.winnerSeat].name, game.players[game.winnerSeat]?.extra) && (
            <TimEgg key={game.endedAt} seat={game.winnerSeat} dispatch={dispatch} />
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
          // while seating, the phone is held upright to type in names and commanders;
          // once the game is on, open facing the player who tapped, like their panel
          rot={game.phase === 'seating' ? 0 : (layout.rot[editing] + (turned ? 90 : 0)) % 360}
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
 * that tapping it moves the round on, and that this is the first player's job.
 * It fades on its own, on a tap, or as soon as the round moves on.
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
          {name} went first, so the count is theirs: tap the d20 at the start of each of their turns. Double-tap it to go back a round.
        </span>
        <span className="mt-1 block text-sm leading-snug text-bone/90">Hold the d20 any time for the menu and Undo.</span>
      </button>
    </div>
  );
}

/** Tim won with no * counters. Two text bubbles slide in over the summary; tap to close. */
function TimEgg({ seat, dispatch }: { seat: number; dispatch: (a: Action) => void }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    dispatch({ t: 'egg', seat, egg: TIM_CLEAN.id });
    const t = setTimeout(() => setOpen(false), 6500);
    return () => clearTimeout(t);
  }, [seat, dispatch]);
  if (!open) return null;
  return (
    <button
      type="button"
      aria-label="I will take this as a win with no asterisks. Hell yeah. Tap to close."
      onClick={() => setOpen(false)}
      className="tim-egg absolute inset-0 z-40 flex flex-col justify-center gap-3 bg-black/70 px-5"
    >
      <img src={`${import.meta.env.BASE_URL}eggs/tim-1.png`} alt="" className="bubble-l w-[78%] max-w-sm self-start" />
      <img src={`${import.meta.env.BASE_URL}eggs/tim-2.png`} alt="" className="bubble-r w-[22.5%] max-w-[6.9rem] self-end" />
    </button>
  );
}

/** Quiet lines when someone goes out: a rage quit on a concession, and Chris being The Threat. */
function useOutNotes(game: LiveGame | null, dispatch: (a: Action) => void) {
  // only react to knockouts that happen while this screen is open, not ones already in a resumed game
  const seen = useRef(game?.events.length ?? 0);
  useEffect(() => {
    if (!game) return;
    const fresh = game.events.slice(seen.current);
    seen.current = game.events.length; // shrinks on undo, so a redone knockout counts again
    if (!fresh.length || !funOn()) return;
    for (const e of fresh) {
      if (e.kind !== 'out') continue;
      if (e.cause === 'concede') toast(e.seat, rageQuit());
      const threat = threatSeat(
        { events: game.events, format: game.config.format, playerCount: game.players.length },
        (seat) => game.config.players[seat]?.name,
      );
      if (threat === e.seat) {
        dispatch({ t: 'egg', seat: e.seat, egg: THREAT.id });
        toast(e.seat, THREAT.text);
      }
    }
  }, [game?.events.length]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The concession that ended the game, flashed on the summary since it covers the table. */
function EndedByConcede({ game }: { game: LiveGame }) {
  const [text] = useState(() => {
    const last = [...game.events].reverse().find((e) => e.kind === 'out');
    if (!funOn() || last?.cause !== 'concede' || Date.now() - last.at > 5000) return null;
    return `${game.config.players[last.seat]?.name}: ${rageQuit()}`;
  });
  if (!text) return null;
  return <div className="whisper pointer-events-none absolute right-5 top-5 max-w-[60%] truncate text-sm italic text-brass">{text}</div>;
}
