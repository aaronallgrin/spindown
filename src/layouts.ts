import type { Orientation } from './types';

export type Rot = 0 | 90 | 180 | 270;

export interface Layout {
  id: string;
  label: string;
  players: number;
  orientation: Orientation;
  /** grid-template-areas rows, one letter per seat (a = seat 0 …), clockwise */
  areas: string[];
  rot: Rot[];
}

const L = (
  id: string,
  label: string,
  orientation: Orientation,
  areas: string[],
  rot: Rot[],
): Layout => ({ id, label, orientation, areas, rot, players: rot.length });

/**
 * Seats are listed clockwise as seen from above, with the top of the
 * screen pointing "north". Rotation turns each panel to face its player:
 * 90 = player on the left edge, 270 = right edge, 180 = top edge.
 */
export const LAYOUTS: Layout[] = [
  L('p2', 'Head to head', 'portrait', ['a', 'b'], [180, 0]),
  L('p3', 'One end, two sides', 'portrait', ['a a', 'c b'], [180, 270, 90]),
  L('p4-sides', 'Standard', 'portrait', ['a b', 'd c'], [90, 270, 270, 90]),
  L('p4-ends', 'Four sides', 'portrait', ['a a', 'd b', 'c c'], [180, 270, 0, 90]),
  L('p5', 'Two, two, one end', 'portrait', ['a b', 'e c', 'd d'], [90, 270, 270, 0, 90]),
  L('p6', 'Three each side', 'portrait', ['a b', 'f c', 'e d'], [90, 270, 270, 270, 90, 90]),
];

export const layoutsFor = (players: number, orientation: Orientation) =>
  LAYOUTS.filter((l) => l.players === players && l.orientation === orientation);

export const getLayout = (id: string) => LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[2];

export const defaultLayout = (players: number, orientation: Orientation) =>
  layoutsFor(players, orientation)[0];

export const seatLetter = (seat: number) => String.fromCharCode(97 + seat);

/** The seat grid as the player facing `rot` sees it: their own edge at the bottom, the table in the same places. */
export function turnAreas(areas: string[], rot: Rot): string[][] {
  const m = areas.map((r) => r.split(' '));
  const rows = m.length, cols = m[0].length;
  if (rot === 0) return m;
  if (rot === 180) return m.map((r) => [...r].reverse()).reverse();
  return Array.from({ length: cols }, (_, i) =>
    Array.from({ length: rows }, (_, j) => (rot === 90 ? m[j][cols - 1 - i] : m[rows - 1 - j][i])),
  );
}
