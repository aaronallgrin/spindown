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
 * Soonest first. Prereleases are trimmed to the 3 closest stores, each store's earliest session,
 * so a prerelease weekend doesn't fill the list with a dozen sessions.
 */
export const rankEvents = (list: MagicEvent[]) => {
  const stores = new Set<string>();
  const byDate = (a: MagicEvent, b: MagicEvent) => a.start.localeCompare(b.start);
  const pre = list
    .filter(isPrerelease)
    .sort(byDate)
    .filter((e) => !stores.has(e.store) && stores.add(e.store))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, 3);
  return [...pre, ...list.filter((e) => !isPrerelease(e))].sort(byDate);
};

export async function nearbyEvents(zip: string, miles: number): Promise<MagicEvent[]> {
  const r = await cloud(`functions/v1/events?zip=${zip}&miles=${miles}`);
  // the filter also covers an events function deployed before it took `miles`
  return rankEvents(((await r.json()).events ?? []).filter((e: MagicEvent) => e.miles <= miles));
}

/** "Thu, Nov 20 · 6:30 PM" in the store's own time zone. */
export const when = (e: MagicEvent) =>
  new Date(e.start).toLocaleString(undefined, { timeZone: e.tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(/, (?=\d+:)/, ' · ');

export const eventUrl = (e: MagicEvent) => `https://locator.wizards.com/en/event/${e.id}`;
