export type Format = 'commander' | 'constructed' | 'other';

/** formats inside Constructed and Other, with starting life */
export const SUB_FORMATS: Record<Exclude<Format, 'commander'>, { name: string; life: number }[]> = {
  constructed: [
    { name: 'Standard', life: 20 },
    { name: 'Pioneer', life: 20 },
    { name: 'Modern', life: 20 },
    { name: 'Legacy', life: 20 },
    { name: 'Vintage', life: 20 },
    { name: 'Pauper', life: 20 },
  ],
  other: [
    { name: 'Draft', life: 20 },
    { name: 'Sealed', life: 20 },
    { name: 'Cube', life: 20 },
    { name: 'Brawl', life: 25 },
    { name: 'Oathbreaker', life: 20 },
    { name: 'Dandân', life: 20 },
    { name: 'Pai Gow', life: 20 },
    { name: 'Casual', life: 20 },
  ],
};
export type Mana = 'W' | 'U' | 'B' | 'R' | 'G';
export const MANA: Mana[] = ['W', 'U', 'B', 'R', 'G'];
export type Orientation = 'portrait' | 'landscape';
/** 0 = precon */
export type Bracket = 0 | 1 | 2 | 3 | 4 | 5;

export const BRACKETS: { n: Bracket; label: string; name: string }[] = [
  { n: 0, label: 'P', name: 'Precon' },
  { n: 1, label: '1', name: 'Exhibition' },
  { n: 2, label: '2', name: 'Core' },
  { n: 3, label: '3', name: 'Upgraded' },
  { n: 4, label: '4', name: 'Optimized' },
  { n: 5, label: '5', name: 'cEDH' },
];

export interface CardRef {
  name: string;
  scryfallId?: string;
  colorIdentity: Mana[];
  artCrop?: string;
}

export interface PlayerSetup {
  name: string;
  commander?: CardRef;
  hasPartner: boolean;
  partner?: CardRef;
  colors: Mana[];
  bracket?: Bracket;
  deckName?: string;
  theme?: string;
}

export interface GameConfig {
  format: Format;
  /** e.g. Modern, Draft; not used for Commander */
  subFormat?: string;
  startingLife: number;
  orientation: Orientation;
  layoutId: string;
  /** index = seat, seats numbered clockwise around the table */
  players: PlayerSetup[];
  /** commander damage also subtracts life */
  cmdrDamageLosesLife: boolean;
  /** name of the extra per-player counter; empty = not used */
  extraCounter?: string;
}

/** opponentWon = knocked out because another player declared a win */
export type OutCause = 'life' | 'commander' | 'poison' | 'concede' | 'lose' | 'opponentWon' | 'other';

export interface LivePlayer {
  seat: number;
  life: number;
  poison: number;
  /** key `${fromSeat}:${0|1}` (1 = partner) */
  cmdr: Record<string, number>;
  /** the named extra counter */
  extra?: number;
  out?: { round: number; turn: number; cause: OutCause; at: number };
  /** prompt already dismissed for current lethal state */
  lethalDismissed?: boolean;
}

export type EventKind = 'life' | 'poison' | 'cmdr' | 'extra' | 'monarch' | 'turn' | 'out' | 'win' | 'revive' | 'first' | 'egg';

export interface GameEvent {
  at: number;
  round: number;
  turn: number;
  seat: number;
  kind: EventKind;
  delta?: number;
  from?: number;
  partner?: 0 | 1;
  cause?: OutCause;
  /** easter egg id, for kind 'egg' */
  egg?: string;
}

export type Phase = 'seating' | 'choosingFirst' | 'playing' | 'over';

export interface LiveGame {
  id: string;
  config: GameConfig;
  startedAt: number;
  endedAt?: number;
  phase: Phase;
  /** pending pick while choosing first */
  pickedSeat: number | null;
  firstSeat: number | null;
  activeSeat: number | null;
  round: number;
  /** total turns taken, 1-based */
  turn: number;
  monarchSeat: number | null;
  players: LivePlayer[];
  events: GameEvent[];
  winnerSeat: number | null;
  /** true when ended as draw / no winner */
  draw?: boolean;
}

export interface PlayerResult {
  seat: number;
  turnOrder: number;
  name: string;
  commander?: string;
  partner?: string;
  colors: Mana[];
  bracket?: Bracket;
  deckName?: string;
  theme?: string;
  result: 'win' | 'loss' | 'draw';
  outRound?: number;
  outCause?: OutCause;
  finalLife: number;
  finalPoison: number;
  cmdrDamageTaken: number;
  finalExtra?: number;
  wasMonarchAtEnd: boolean;
}

export interface GameRecord {
  id: string;
  /** brought in from the old spreadsheet: no times, no life log */
  imported?: boolean;
  format: Format;
  startingLife: number;
  playerCount: number;
  startedAt: number;
  endedAt: number;
  durationMin: number;
  rounds: number;
  winnerName: string | null;
  players: PlayerResult[];
  events: GameEvent[];
  config: GameConfig;
  synced?: 0 | 1;
}
