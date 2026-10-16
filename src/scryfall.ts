import type { CardRef, Mana } from './types';

const API = 'https://api.scryfall.com';
const CACHE_KEY = 'spindown.cards';

type Cache = Record<string, CardRef>;
const readCache = (): Cache => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};
const writeCache = (c: Cache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* storage full or blocked */
  }
};

/** Card names that can lead a Commander deck, matching the typed text. */
export async function searchCommanders(q: string, signal?: AbortSignal): Promise<string[]> {
  const t = q.trim();
  if (t.length < 2) return [];
  const query = `${t} is:commander game:paper`;
  const res = await fetch(
    `${API}/cards/search?order=edhrec&unique=cards&q=${encodeURIComponent(query)}`,
    { signal, headers: { Accept: 'application/json' } },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Scryfall ${res.status}`);
  const body = await res.json();
  const cache = readCache();
  const names: string[] = [];
  for (const c of body.data.slice(0, 12)) {
    const ref = toRef(c);
    cache[ref.name.toLowerCase()] = ref;
    names.push(ref.name);
  }
  writeCache(cache);
  return names;
}

export async function getCard(name: string): Promise<CardRef> {
  const cache = readCache();
  const hit = cache[name.toLowerCase()];
  if (hit) return hit;
  const res = await fetch(`${API}/cards/named?exact=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`No card named ${name}`);
  const ref = toRef(await res.json());
  cache[ref.name.toLowerCase()] = ref;
  writeCache(cache);
  return ref;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRef(c: any): CardRef {
  const art = c.image_uris?.art_crop ?? c.card_faces?.[0]?.image_uris?.art_crop;
  return {
    name: c.name,
    scryfallId: c.id,
    colorIdentity: (c.color_identity ?? []) as Mana[],
    artCrop: art,
  };
}
