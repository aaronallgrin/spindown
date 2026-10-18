import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { newGame, reduce, toRecord, type Action } from './game';
import { db } from './db';
import { syncNow } from './sync';
import type { GameConfig, LiveGame } from './types';

const CURRENT = 'spindown.current';
const LAST_CONFIG = 'spindown.lastConfig';

const load = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const save = (k: string, v: unknown) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

interface Store {
  game: LiveGame | null;
  dispatch: (a: Action) => void;
  undo: () => void;
  canUndo: boolean;
  start: (c: GameConfig) => void;
  /** save finished game to history and clear it */
  saveAndClose: () => Promise<string | null>;
  discard: () => void;
  lastConfig: GameConfig | null;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<LiveGame | null>(() => load<LiveGame>(CURRENT));
  const [lastConfig, setLastConfig] = useState<GameConfig | null>(() => load(LAST_CONFIG));
  const history = useRef<LiveGame[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // write the live game a moment after the last tap, not on every tap (a long game is
  // a big JSON string); flush right away if the app is hidden, closed or reloaded
  const pending = useRef<LiveGame | null | undefined>(undefined);
  useEffect(() => {
    pending.current = game;
    const flush = () => {
      if (pending.current === undefined) return;
      save(CURRENT, pending.current);
      pending.current = undefined;
    };
    const t = window.setTimeout(flush, 300);
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', flush);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', flush);
    };
  }, [game]);
  // starting, saving or discarding a game is written immediately
  const saveNow = (g: LiveGame | null) => {
    pending.current = undefined;
    save(CURRENT, g);
  };

  const dispatch = useCallback((a: Action) => {
    setGame((g) => {
      if (!g) return g;
      const n = reduce(g, a);
      // easter eggs are a side note, not something to undo
      if (n !== g && a.t !== 'egg') {
        history.current.push(g);
        if (history.current.length > 300) history.current.shift();
        setCanUndo(true);
      }
      return n;
    });
  }, []);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev) setGame(prev);
    setCanUndo(history.current.length > 0);
  }, []);

  const start = useCallback((c: GameConfig) => {
    history.current = [];
    setCanUndo(false);
    setLastConfig(c);
    save(LAST_CONFIG, c);
    const g = newGame(c);
    saveNow(g);
    setGame(g);
  }, []);

  const saveAndClose = useCallback(async () => {
    if (!game) return null;
    if (game.phase === 'over') {
      await db.games.put(toRecord(game));
      syncNow();
    }
    history.current = [];
    setCanUndo(false);
    saveNow(null);
    setGame(null);
    return game.phase === 'over' ? game.id : null;
  }, [game]);

  const discard = useCallback(() => {
    history.current = [];
    setCanUndo(false);
    saveNow(null);
    setGame(null);
  }, []);

  return (
    <Ctx.Provider value={{ game, dispatch, undo, canUndo, start, saveAndClose, discard, lastConfig }}>
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
};
