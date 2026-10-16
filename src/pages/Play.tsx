import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { alive } from '../game';
import { getLayout, seatLetter, type Layout } from '../layouts';
import { useStore } from '../store';
import Seat from '../components/Seat';
import { usePress } from '../components/usePress';
import ConfirmBtn from '../components/ConfirmBtn';
import { Btn, D20, Pips } from '../ui';

function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
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
  const vp = useViewport();
  const [menu, setMenu] = useState<null | 'main' | 'end'>(null);
  useWakeLock();

  const d20Press = usePress(
    () => (game?.phase === 'choosingFirst' ? dispatch({ t: 'random' }) : dispatch({ t: 'pass' })),
    () => setMenu('main'),
    550,
    1e9,
  );

  if (!game) return <Navigate to="/" replace />;

  const layout = getLayout(game.config.layoutId);
  const portrait = layout.orientation === 'portrait';
  const vpPortrait = vp.h >= vp.w;
  const turned = portrait !== vpPortrait;
  const long = Math.max(vp.w, vp.h);
  const short = Math.min(vp.w, vp.h);
  const w = portrait ? short : long;
  const h = portrait ? long : short;

  // the d20 turns to face whoever is taking their turn
  const activeRot = game.activeSeat != null ? layout.rot[game.activeSeat] : 0;
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
            dispatch={dispatch}
          />
        ))}

        {game.phase !== 'over' && (
          <button
            {...d20Press}
            aria-label={
              game.phase === 'choosingFirst' ? 'Pick a random first player' : `Round ${game.round}. Tap to pass the turn, hold for menu`
            }
            className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-[rotate] duration-300"
            style={{ rotate: `${activeRot}deg` }}
          >
            <D20 value={game.phase === 'choosingFirst' ? '?' : game.round} size={d20Size} />
          </button>
        )}

        {game.phase === 'over' && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-felt-2 p-5 shadow-2xl">
              <div className="mb-1 text-sm text-dim">
                {game.round} rounds, {Math.max(1, Math.round(((game.endedAt ?? Date.now()) - game.startedAt) / 60000))} min
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
                <Btn onClick={undo} disabled={!canUndo}>
                  Undo last change
                </Btn>
              </div>
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
                  </div>
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
