import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Format, PlayerSetup } from '../types';

export const deckKey = (p: PlayerSetup) =>
  [p.commander?.name ?? '', p.hasPartner ? p.partner?.name ?? '' : '', p.deckName ?? '', p.theme ?? '']
    .join('|')
    .toLowerCase();

/** Names seen in past games, and each name's past decks for one-tap reuse. */
export function usePlayerMemory() {
  const games = useLiveQuery(() => db.games.orderBy('startedAt').reverse().toArray(), []);
  return useMemo(() => {
    const names = new Map<string, string>();
    const decks = new Map<string, Map<string, { setup: PlayerSetup; format: Format }>>();
    const themes = new Set<string>();
    // set and cube names typed before, per format (Cube, Draft…), newest first
    const deckNames = new Map<string, string[]>();
    for (const g of games ?? []) {
      g.config.players.forEach((p) => {
        const name = p.name.trim();
        if (!name) return;
        const k = name.toLowerCase();
        if (!names.has(k)) names.set(k, name);
        if (p.theme) themes.add(p.theme);
        const sf = g.config.subFormat;
        if (sf && p.deckName) {
          const l = deckNames.get(sf) ?? [];
          if (!l.some((x) => x.toLowerCase() === p.deckName!.toLowerCase())) l.push(p.deckName);
          deckNames.set(sf, l);
        }
        const m = decks.get(k) ?? new Map();
        const dk = deckKey(p);
        if (dk.replaceAll('|', '') && !m.has(dk)) m.set(dk, { setup: p, format: g.config.format });
        decks.set(k, m);
      });
    }
    return { names: [...names.values()], decks, themes: [...themes], deckNames };
  }, [games]);
}
