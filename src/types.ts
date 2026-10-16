export type Format = 'commander' | 'constructed' | 'other';
export type Mana = 'W' | 'U' | 'B' | 'R' | 'G';
export const MANA: Mana[] = ['W', 'U', 'B', 'R', 'G'];
export type Orientation = 'portrait' | 'landscape';
export type Bracket = 1 | 2 | 3 | 4 | 5;

export const BRACKETS: { n: Bracket; name: string }[] = [
  { n: 1, name: 'Exhibition' },
  { n: 2, name: 'Core' },
  { n: 3, name: 'Upgraded' },
  { n: 4, name: 'Optimized' },
  { n: 5, name: 'cEDH' },
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
  startingLife: number;
  orientation: Orientation;
  layoutId: string;
  /** index = seat, seats numbered clockwise around the table */
  players: PlayerSetup[];
  /** commander damage also subtracts life */
  cmdrDamageLosesLife: boolean;
}

export type OutCause = 'life' | 'commander' | 'poison' | 'concede' | 'other';

export interface LivePlayer {
  seat: number;
  life: number;
  poison: number;
  /** key `${fromSeat}:${0|1}` (1 = partner) */
  cmdr: Record<string, number>;
  out?: { round: number; turn: number; cause: OutCause; at: number };
  /** prompt already dismissed for current lethal state */
  lethalDismissed?: boolean;
}

export type EventKind = 'life' | 'poison' | 'cmdr' | 'monarch' | 'turn' | 'out' | 'first';

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
}

export type Phase = 'choosingFirst' | 'playing' | 'over';

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
  wasMonarchAtEnd: boolean;
}

export interface GameRecord {
  id: string;
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
