import type {
  EventKind,
  Format,
  GameConfig,
  GameEvent,
  GameRecord,
  LiveGame,
  LivePlayer,
  OutCause,
  PlayerResult,
  PlayerSetup,
} from './types';

export const POISON_LETHAL = 10;
export const CMDR_LETHAL = 21;

export const blankSeat = (): PlayerSetup => ({ name: '', hasPartner: false, colors: [] });

/** House rules: portrait table, commander damage takes life, the * misplay counter. */
export function makeConfig(format: Format, players: number, layoutId: string): GameConfig {
  return {
    format,
    startingLife: format === 'commander' ? 40 : 20,
    orientation: 'portrait',
    layoutId,
    players: Array.from({ length: players }, blankSeat),
    cmdrDamageLosesLife: true,
    extraCounter: '*',
  };
}

export const seated = (g: LiveGame) => g.config.players.every((p) => p.name.trim());

export function newGame(config: GameConfig): LiveGame {
  const filled = config.players.every((p) => p.name.trim());
  return {
    id: crypto.randomUUID(),
    config,
    startedAt: Date.now(),
    phase: filled ? 'choosingFirst' : 'seating',
    pickedSeat: null,
    firstSeat: null,
    activeSeat: null,
    round: 0,
    turn: 0,
    monarchSeat: null,
    winnerSeat: null,
    events: [],
    players: config.players.map((_, seat) => ({
      seat,
      life: config.startingLife,
      poison: 0,
      cmdr: {},
      extra: 0,
    })),
  };
}

export type Action =
  | { t: 'life'; seat: number; d: number }
  | { t: 'poison'; seat: number; d: number }
  | { t: 'cmdr'; seat: number; from: number; partner: 0 | 1; d: number }
  | { t: 'monarch'; seat: number }
  | { t: 'seatInfo'; seat: number; setup: PlayerSetup }
  | { t: 'ready' }
  | { t: 'pick'; seat: number }
  | { t: 'random' }
  | { t: 'extra'; seat: number; d: number }
  | { t: 'round'; d: 1 | -1 }
  | { t: 'out'; seat: number; cause: OutCause }
  | { t: 'dismiss'; seat: number }
  | { t: 'end'; winner: number | null };

export const alive = (g: LiveGame) => g.players.filter((p) => !p.out);

export function lethalCause(g: LiveGame, p: LivePlayer): OutCause | null {
  if (p.out) return null;
  if (g.config.format === 'commander') {
    if (Object.values(p.cmdr).some((v) => v >= CMDR_LETHAL)) return 'commander';
  }
  if (p.poison >= POISON_LETHAL) return 'poison';
  if (p.life <= 0) return 'life';
  return null;
}

/** Seats in turn order, starting with whoever went first, going clockwise. */
export function turnOrder(g: LiveGame): number[] {
  const n = g.players.length;
  const f = g.firstSeat ?? 0;
  return Array.from({ length: n }, (_, i) => (f + i) % n);
}

function log(g: LiveGame, e: Omit<GameEvent, 'at' | 'round' | 'turn'>): GameEvent[] {
  const at = Date.now();
  const last = g.events[g.events.length - 1];
  const merges: EventKind[] = ['life', 'poison', 'cmdr', 'extra'];
  if (
    last &&
    merges.includes(e.kind) &&
    last.kind === e.kind &&
    last.seat === e.seat &&
    last.from === e.from &&
    last.partner === e.partner &&
    last.turn === g.turn &&
    at - last.at < 4000 &&
    Math.sign(last.delta ?? 0) === Math.sign(e.delta ?? 0)
  ) {
    const merged = { ...last, at, delta: (last.delta ?? 0) + (e.delta ?? 0) };
    return [...g.events.slice(0, -1), merged];
  }
  return [...g.events, { ...e, at, round: g.round, turn: g.turn }];
}

function patch(g: LiveGame, seat: number, f: (p: LivePlayer) => LivePlayer): LiveGame {
  return {
    ...g,
    players: g.players.map((p) => {
      if (p.seat !== seat) return p;
      const next = f(p);
      // forget a dismissed lethal prompt once the player is no longer at lethal
      if (next.lethalDismissed && !lethalCause(g, next)) next.lethalDismissed = false;
      return next;
    }),
  };
}

function finishIfOver(g: LiveGame): LiveGame {
  if (g.phase !== 'playing') return g;
  const left = alive(g);
  if (left.length <= 1) {
    return {
      ...g,
      phase: 'over',
      endedAt: Date.now(),
      winnerSeat: left[0]?.seat ?? null,
      draw: left.length === 0,
    };
  }
  return g;
}

export function reduce(g: LiveGame, a: Action): LiveGame {
  switch (a.t) {
    case 'life': {
      const n = patch(g, a.seat, (p) => ({ ...p, life: p.life + a.d }));
      return { ...n, events: log(g, { kind: 'life', seat: a.seat, delta: a.d }) };
    }
    case 'poison': {
      const n = patch(g, a.seat, (p) => ({ ...p, poison: Math.max(0, p.poison + a.d) }));
      const real = n.players[a.seat].poison - g.players[a.seat].poison;
      if (!real) return g;
      return { ...n, events: log(g, { kind: 'poison', seat: a.seat, delta: real }) };
    }
    case 'cmdr': {
      const key = `${a.from}:${a.partner}`;
      const cur = g.players[a.seat].cmdr[key] ?? 0;
      const nextVal = Math.max(0, cur + a.d);
      const real = nextVal - cur;
      if (!real) return g;
      const loseLife = g.config.cmdrDamageLosesLife;
      const n = patch(g, a.seat, (p) => ({
        ...p,
        cmdr: { ...p.cmdr, [key]: nextVal },
        life: loseLife ? p.life - real : p.life,
      }));
      return {
        ...n,
        events: log(g, { kind: 'cmdr', seat: a.seat, from: a.from, partner: a.partner, delta: real }),
      };
    }
    case 'monarch': {
      const seat = g.monarchSeat === a.seat ? null : a.seat;
      return {
        ...g,
        monarchSeat: seat,
        events: [...g.events, { at: Date.now(), round: g.round, turn: g.turn, seat: seat ?? -1, kind: 'monarch' }],
      };
    }
    case 'seatInfo': {
      if (g.phase !== 'seating' && g.phase !== 'choosingFirst') return g;
      const players = g.config.players.map((p, i) => (i === a.seat ? a.setup : p));
      return { ...g, config: { ...g.config, players } };
    }
    case 'ready':
      if (g.phase !== 'seating' || !seated(g)) return g;
      return { ...g, phase: 'choosingFirst', pickedSeat: null };
    case 'pick': {
      if (g.phase !== 'choosingFirst') return g;
      if (g.pickedSeat !== a.seat) return { ...g, pickedSeat: a.seat };
      return {
        ...g,
        phase: 'playing',
        pickedSeat: null,
        firstSeat: a.seat,
        activeSeat: a.seat,
        round: 1,
        turn: 1,
        startedAt: Date.now(),
        events: [{ at: Date.now(), round: 1, turn: 1, seat: a.seat, kind: 'first' }],
      };
    }
    case 'random': {
      if (g.phase !== 'choosingFirst') return g;
      const seat = Math.floor(Math.random() * g.players.length);
      return { ...g, pickedSeat: seat };
    }
    case 'extra': {
      const n = patch(g, a.seat, (p) => ({ ...p, extra: Math.max(0, (p.extra ?? 0) + a.d) }));
      const real = (n.players[a.seat].extra ?? 0) - (g.players[a.seat].extra ?? 0);
      if (!real) return g;
      return { ...n, events: log(g, { kind: 'extra', seat: a.seat, delta: real }) };
    }
    case 'round': {
      if (g.phase !== 'playing') return g;
      const round = Math.max(1, g.round + a.d);
      if (round === g.round) return g;
      return {
        ...g,
        round,
        turn: round,
        events: [...g.events, { at: Date.now(), round, turn: round, seat: -1, kind: 'turn', delta: a.d }],
      };
    }
    case 'out': {
      if (g.players[a.seat].out) return g;
      const n = patch(g, a.seat, (p) => ({
        ...p,
        out: { round: g.round, turn: g.turn, cause: a.cause, at: Date.now() },
      }));
      const withLog = {
        ...n,
        monarchSeat: g.monarchSeat === a.seat ? null : g.monarchSeat,
        events: [...g.events, { at: Date.now(), round: g.round, turn: g.turn, seat: a.seat, kind: 'out' as const, cause: a.cause }],
      };
      return finishIfOver(withLog);
    }
    case 'dismiss':
      return patch(g, a.seat, (p) => ({ ...p, lethalDismissed: true }));
    case 'end':
      return {
        ...g,
        phase: 'over',
        endedAt: Date.now(),
        winnerSeat: a.winner,
        draw: a.winner == null,
      };
  }
}

export function toRecord(g: LiveGame): GameRecord {
  const order = turnOrder(g);
  const ended = g.endedAt ?? Date.now();
  const players: PlayerResult[] = g.players.map((p) => {
    const s = g.config.players[p.seat];
    const result: PlayerResult['result'] = g.draw
      ? p.out
        ? 'loss'
        : 'draw'
      : g.winnerSeat === p.seat
        ? 'win'
        : 'loss';
    return {
      seat: p.seat,
      turnOrder: order.indexOf(p.seat) + 1,
      name: s.name.trim() || `Seat ${p.seat + 1}`,
      commander: s.commander?.name,
      partner: s.hasPartner ? s.partner?.name : undefined,
      colors: s.colors,
      bracket: g.config.format === 'commander' ? s.bracket : undefined,
      deckName: s.deckName?.trim() || undefined,
      theme: s.theme?.trim() || undefined,
      result,
      outRound: p.out?.round ?? (result === 'loss' ? g.round : undefined),
      outCause: p.out?.cause,
      finalLife: p.life,
      finalPoison: p.poison,
      cmdrDamageTaken: Object.values(p.cmdr).reduce((a, b) => a + b, 0),
      finalExtra: g.config.extraCounter ? (p.extra ?? 0) : undefined,
      wasMonarchAtEnd: g.monarchSeat === p.seat,
    };
  });
  const winner = players.find((p) => p.result === 'win');
  return {
    id: g.id,
    format: g.config.format,
    startingLife: g.config.startingLife,
    playerCount: g.players.length,
    startedAt: g.startedAt,
    endedAt: ended,
    durationMin: Math.round((ended - g.startedAt) / 60000),
    rounds: g.round,
    winnerName: winner?.name ?? null,
    players,
    events: g.events,
    config: g.config,
    synced: 0,
  };
}
