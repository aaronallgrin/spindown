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

const DENIED =
  'Spindown isn’t allowed to see your location. On iPhone, Spindown isn’t listed by name: go to Settings → Privacy & Security → Location Services, turn it on, then set Safari Websites to While Using. Also check Settings → Apps → Safari → Location isn’t Deny. Or just type your zip.';
const LOST = 'Couldn’t find your location. Try again, or type your zip.';

/** This phone's zip code, from its location. OpenStreetMap turns the spot into an address. Errors are worded for the screen. */
export async function zipHere(): Promise<string> {
  if (!navigator.geolocation) throw new Error(LOST);
  const { coords } = await new Promise<GeolocationPosition>((ok, no) =>
    navigator.geolocation.getCurrentPosition(ok, (e) => no(new Error(e.code === e.PERMISSION_DENIED ? DENIED : LOST)), {
      timeout: 15000,
      maximumAge: 36e5,
    }),
  );
  const zip = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`)
    .then((r) => r.json())
    .then((j) => String(j.address?.postcode ?? '').slice(0, 5))
    .catch(() => '');
  if (!/^\d{5}$/.test(zip)) throw new Error('Couldn’t find a zip code for where you are. Type it in instead.');
  return zip;
}

export async function nearbyEvents(zip: string, miles: number): Promise<MagicEvent[]> {
  const r = await cloud(`functions/v1/events?zip=${zip}&miles=${miles}`);
  // the filter also covers an events function deployed before it took `miles`
  return rankEvents(((await r.json()).events ?? []).filter((e: MagicEvent) => e.miles <= miles));
}

/** "Thu, Nov 20 · 6:30 PM" in the store's own time zone. */
export const when = (e: MagicEvent) =>
  new Date(e.start).toLocaleString(undefined, { timeZone: e.tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(/, (?=\d+:)/, ' · ');

export const eventUrl = (e: MagicEvent) => `https://locator.wizards.com/en/event/${e.id}`;
