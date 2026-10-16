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
  L('p4-sides', 'Two each side', 'portrait', ['a b', 'd c'], [90, 270, 270, 90]),
  L('p4-ends', 'One per side', 'portrait', ['a a', 'd b', 'c c'], [180, 270, 0, 90]),
  L('p5', 'Two, two, one end', 'portrait', ['a b', 'e c', 'd d'], [90, 270, 270, 0, 90]),
  L('p6', 'Three each side', 'portrait', ['a b', 'f c', 'e d'], [90, 270, 270, 270, 90, 90]),
];

export const layoutsFor = (players: number, orientation: Orientation) =>
  LAYOUTS.filter((l) => l.players === players && l.orientation === orientation);

export const getLayout = (id: string) => LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[2];

export const defaultLayout = (players: number, orientation: Orientation) =>
  layoutsFor(players, orientation)[0];

export const seatLetter = (seat: number) => String.fromCharCode(97 + seat);

/** Where a seat sits, in plain words, for the setup screen. */
export function seatPosition(layout: Layout, seat: number): string {
  const ch = seatLetter(seat);
  const rows = layout.areas.map((r) => r.split(' '));
  const h = rows.length;
  const w = rows[0].length;
  let rs: number[] = [];
  let cs: number[] = [];
  rows.forEach((r, ri) =>
    r.forEach((c, ci) => {
      if (c === ch) {
        rs.push(ri);
        cs.push(ci);
      }
    }),
  );
  const rm = (Math.min(...rs) + Math.max(...rs)) / 2;
  const cm = (Math.min(...cs) + Math.max(...cs)) / 2;
  const v = rm < (h - 1) / 2 - 0.01 ? 'Top' : rm > (h - 1) / 2 + 0.01 ? 'Bottom' : 'Middle';
  const hz = cm < (w - 1) / 2 - 0.01 ? 'left' : cm > (w - 1) / 2 + 0.01 ? 'right' : '';
  if (v === 'Middle') return hz ? hz[0].toUpperCase() + hz.slice(1) + ' middle' : 'Middle';
  return hz ? `${v} ${hz}` : `${v} end`;
}
