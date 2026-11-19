// Magic events near a zip code, from the Wizards Store & Event Locator.
// Phones can't ask Wizards directly (their site blocks other websites), so this asks for them.
//
// Setup (once): Supabase → Edge Functions → Deploy a new function → Via Editor,
// name it "events", paste this file, and turn OFF "Verify JWT" (the app's key isn't a JWT).
//
// shortcut: this reads the data behind Wizards' own search page, which isn't an official API.
// If Wizards changes their site it can break; the app then shows "Couldn't load events".
import { decode } from 'npm:turbo-stream@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
};

const day = (d: Date) => d.toISOString().slice(0, 10);

// one search on Wizards' locator: up to 50 events with this tag (or any, if no tag), within `miles` miles, in the next `days` days
async function search(zip: string, miles: number, tag: string, days: number) {
  const now = new Date();
  const q = new URLSearchParams({
    searchType: 'magic-events',
    query: zip,
    distance: String(miles),
    page: '1',
    pageSize: '50',
    ...(tag && { tag }),
    startDate: day(now),
    endDate: day(new Date(now.getTime() + days * 864e5)),
  });
  const r = await fetch(`https://locator.wizards.com/en/search.data?${q}`);
  if (!r.ok || !r.body) throw new Error(`Wizards answered ${r.status}`);
  const d = await decode(r.body);
  await d.done;
  // deno-lint-ignore no-explicit-any
  const events: any[] = (d.value as any)['routes/($lang).search']?.data?.events?.advancedSearchEvents?.events ?? [];
  return events
    .filter((e) => !e.isOnline && e.status === 'SCHEDULED')
    .map((e) => ({
      id: e.id,
      title: e.title,
      format: e.eventFormat?.name ?? '',
      tags: e.tags ?? [],
      start: e.scheduledStartTime,
      tz: e.timeZone,
      miles: Math.round((e.distance / 1609.34) * 10) / 10,
      store: e.organization?.name ?? '',
      address: [e.organization?.address, e.organization?.city, e.organization?.state].filter(Boolean).join(', '),
      fee: e.entryFee?.amount ? e.entryFee.amount / 100 : 0,
    }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const zip = new URL(req.url).searchParams.get('zip') ?? '';
  // validate here: whatever comes in goes into a request to Wizards
  if (!/^\d{5}$/.test(zip)) return json({ error: 'Enter a 5-digit zip code.' }, 400);
  const miles = Number(new URL(req.url).searchParams.get('miles') ?? 25);
  if (!Number.isInteger(miles) || miles < 1 || miles > 100) return json({ error: 'Distance must be 1 to 100 miles.' }, 400);
  try {
    // prereleases are rarer, so look further ahead for them; everything else just this week
    const lists = await Promise.all([search(zip, miles, 'magic_prerelease', 90), search(zip, miles, 'commander', 14), search(zip, miles, '', 7)]);
    const seen = new Set<string>();
    return json({ events: lists.flat().filter((e) => !seen.has(e.id) && seen.add(e.id)) });
  } catch (e) {
    console.error(e);
    return json({ error: 'Couldn’t reach the Wizards event locator.' }, 502);
  }
});
