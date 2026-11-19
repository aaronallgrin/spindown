import { cloud } from './push';

/** A Magic event near the phone's zip code, as the events function sends it. */
export type MagicEvent = {
  id: string;
  title: string;
  format: string;
  tags: string[];
  start: string;
  tz: string;
  miles: number;
  store: string;
  address: string;
  fee: number;
};

export const isPrerelease = (e: MagicEvent) => e.tags.includes('magic_prerelease') || /prerelease/i.test(e.title);
export const isCommander = (e: MagicEvent) => e.format === 'Commander' || e.tags.includes('commander');

/**
 * Prereleases first (only the 3 closest stores, each store's earliest session, so a prerelease
 * weekend doesn't bury tonight's Commander), then Commander, then the rest; closest first, then soonest.
 */
export const rankEvents = (list: MagicEvent[]) => {
  const order = (a: MagicEvent, b: MagicEvent) => a.miles - b.miles || a.start.localeCompare(b.start);
  const stores = new Set<string>();
  const pre = list
    .filter(isPrerelease)
    .sort((a, b) => a.start.localeCompare(b.start))
    .filter((e) => !stores.has(e.store) && stores.add(e.store))
    .sort(order)
    .slice(0, 3);
  const rest = list.filter((e) => !isPrerelease(e));
  return [...pre, ...rest.filter(isCommander).sort(order), ...rest.filter((e) => !isCommander(e)).sort(order)];
};

export async function nearbyEvents(zip: string): Promise<MagicEvent[]> {
  const r = await cloud(`functions/v1/events?zip=${zip}`);
  return rankEvents((await r.json()).events ?? []);
}

/** "Thu, Nov 20 · 6:30 PM" in the store's own time zone. */
export const when = (e: MagicEvent) =>
  new Date(e.start).toLocaleString(undefined, { timeZone: e.tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(/, (?=\d+:)/, ' · ');

export const eventUrl = (e: MagicEvent) => `https://locator.wizards.com/en/event/${e.id}`;
