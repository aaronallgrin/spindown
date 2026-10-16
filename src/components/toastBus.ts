/** Lets the table send a quiet message to one player's panel. */

const PREF = 'spindown.funMessages';
export const funOn = () => {
  try {
    return localStorage.getItem(PREF) !== 'off';
  } catch {
    return true;
  }
};
export const setFun = (on: boolean) => {
  try {
    localStorage.setItem(PREF, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
};

// keep it quiet: one message on the table at a time, and not often per player
let tableLast = 0;
const seatLast = new Map<number, number>();
export function mayWhisper(seat: number) {
  const now = Date.now();
  if (!funOn() || now - tableLast < 10_000 || now - (seatLast.get(seat) ?? 0) < 30_000) return false;
  tableLast = now;
  seatLast.set(seat, now);
  return true;
}
type Fn = (text: string) => void;
const subs = new Map<number, Set<Fn>>();

export function onToast(seat: number, fn: Fn) {
  const s = subs.get(seat) ?? new Set();
  s.add(fn);
  subs.set(seat, s);
  return () => {
    s.delete(fn);
  };
}

export function toast(seat: number, text: string) {
  subs.get(seat)?.forEach((f) => f(text));
}
