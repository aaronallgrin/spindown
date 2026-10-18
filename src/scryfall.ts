import type { CardRef, Mana } from './types';

const API = 'https://api.scryfall.com';
const CACHE_KEY = 'spindown.cards';

type Cache = Record<string, CardRef>;
/** most recently looked-up cards kept on the phone; older ones are dropped */
const MAX_CARDS = 300;
const MAX_IMAGES = 100;

/** keep only the newest `max` keys (objects keep insertion order) */
function trim<T>(c: Record<string, T>, max: number) {
  const keys = Object.keys(c);
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) delete c[k];
  return c;
}

// read from storage once, then kept in memory
let cards: Cache | null = null;
const readCache = (): Cache => {
  if (cards) return cards;
  try {
    cards = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') as Cache;
  } catch {
    cards = {};
  }
  return cards;
};
const writeCache = (c: Cache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(trim(c, MAX_CARDS)));
  } catch {
    /* storage full or blocked */
  }
};
/** add or refresh a card so it counts as recently used */
const remember = (c: Cache, ref: CardRef) => {
  const k = ref.name.toLowerCase();
  delete c[k];
  c[k] = ref;
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
    remember(cache, ref);
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
  remember(cache, ref);
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

export async function autocompleteCards(q: string, signal?: AbortSignal): Promise<string[]> {
  if (q.trim().length < 2) return [];
  const res = await fetch(`${API}/cards/autocomplete?q=${encodeURIComponent(q.trim())}`, { signal });
  if (!res.ok) throw new Error(`Scryfall ${res.status}`);
  return (await res.json()).data ?? [];
}

export interface CardRulings {
  name: string;
  manaCost?: string;
  typeLine?: string;
  oracle?: string;
  image?: string;
  scryfallUri?: string;
  rulings: { date: string; source: string; text: string }[];
}

export async function getRulings(name: string): Promise<CardRulings> {
  const res = await fetch(`${API}/cards/named?fuzzy=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`No card found for “${name}”.`);
  const c = await res.json();
  const faces = c.card_faces as { name: string; mana_cost?: string; type_line?: string; oracle_text?: string }[] | undefined;
  const r = await fetch(c.rulings_uri);
  const rulings = r.ok ? ((await r.json()).data ?? []) : [];
  return {
    name: c.name,
    manaCost: c.mana_cost ?? faces?.map((f) => f.mana_cost).filter(Boolean).join(' // '),
    typeLine: c.type_line,
    oracle: c.oracle_text ?? faces?.map((f) => `${f.name}\n${f.oracle_text ?? ''}`).join('\n\n'),
    image: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal,
    scryfallUri: c.scryfall_uri,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rulings: rulings.map((x: any) => ({ date: x.published_at, source: x.source, text: x.comment })),
  };
}

const IMG_CACHE = 'spindown.cardImages';

/** Full card images (both faces for double-faced cards) for a card name. */
export async function getCardImages(name: string): Promise<{ name: string; images: string[]; uri?: string }> {
  let cache: Record<string, { name: string; images: string[]; uri?: string }> = {};
  try {
    cache = JSON.parse(localStorage.getItem(IMG_CACHE) || '{}');
  } catch {
    /* ignore */
  }
  const key = name.toLowerCase();
  if (cache[key]) return cache[key];
  const front = name.split(' // ')[0];
  let res = await fetch(`${API}/cards/named?exact=${encodeURIComponent(front)}`);
  if (!res.ok) res = await fetch(`${API}/cards/named?fuzzy=${encodeURIComponent(front)}`);
  if (!res.ok) throw new Error(`No card found for “${name}”.`);
  const c = await res.json();
  const images: string[] = c.image_uris?.normal
    ? [c.image_uris.normal]
    : (c.card_faces ?? []).map((f: { image_uris?: { normal?: string } }) => f.image_uris?.normal).filter(Boolean);
  const out = { name: c.name as string, images, uri: c.scryfall_uri as string | undefined };
  delete cache[key];
  cache[key] = out;
  try {
    localStorage.setItem(IMG_CACHE, JSON.stringify(trim(cache, MAX_IMAGES)));
  } catch {
    /* ignore */
  }
  return out;
}
