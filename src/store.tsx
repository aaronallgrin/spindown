import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { newGame, reduce, toRecord, type Action } from './game';
import { db } from './db';
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

  useEffect(() => save(CURRENT, game), [game]);

  const dispatch = useCallback((a: Action) => {
    setGame((g) => {
      if (!g) return g;
      const n = reduce(g, a);
      if (n !== g) {
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
    setGame(newGame(c));
  }, []);

  const saveAndClose = useCallback(async () => {
    if (!game) return null;
    if (game.phase === 'over') await db.games.put(toRecord(game));
    history.current = [];
    setCanUndo(false);
    setGame(null);
    return game.phase === 'over' ? game.id : null;
  }, [game]);

  const discard = useCallback(() => {
    history.current = [];
    setCanUndo(false);
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
