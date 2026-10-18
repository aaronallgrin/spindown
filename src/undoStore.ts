import type { GameEvent, LiveGame } from './types';

/**
 * Undo history saved next to the live game, so Undo still works after the app
 * reloads or the phone drops it from memory.
 *
 * Each earlier state's event log is a prefix of the next one's, apart from its
 * last event (taps in a row merge into the last event). So a snapshot keeps only
 * its log length and last event, and the full log is rebuilt from the state after it.
 */

/** how many steps back survive a reload (the in-memory history keeps more) */
export const SAVED_STEPS = 40;

interface Packed {
  id: string;
  steps: { g: Omit<LiveGame, 'events'>; n: number; last?: GameEvent }[];
}

export function packUndo(history: LiveGame[]): Packed | null {
  const recent = history.slice(-SAVED_STEPS);
  if (!recent.length) return null;
  return {
    id: recent[0].id,
    steps: recent.map(({ events, ...g }) => ({ g, n: events.length, last: events[events.length - 1] })),
  };
}

/** Rebuild the history that leads up to `current`, or [] if it doesn't fit. */
export function unpackUndo(p: Packed | null, current: LiveGame | null): LiveGame[] {
  if (!p || !current || p.id !== current.id || !Array.isArray(p.steps)) return [];
  const out: LiveGame[] = [];
  let next = current;
  for (let i = p.steps.length - 1; i >= 0; i--) {
    const { g, n, last } = p.steps[i];
    if (g.id !== current.id || n > next.events.length + 1) break;
    const events = n ? [...next.events.slice(0, n - 1), ...(last ? [last] : [])] : [];
    if (events.length !== n) break;
    next = { ...g, events } as LiveGame;
    out.unshift(next);
  }
  return out;
}
