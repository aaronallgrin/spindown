// Sends Spindown's push notifications. The app says what happened ("kind");
// the words live here, so nobody can use this to send the group arbitrary text.
//
// Setup (once): Supabase → Edge Functions → Deploy a new function → Via Editor,
// name it "notify", paste this file, and turn OFF "Verify JWT" (the app's key isn't a JWT).
// Then Edge Functions → Secrets: VAPID_PRIVATE_KEY = the private key Claude gave you.
import { buildPushHTTPRequest } from 'npm:@pushforge/builder@2';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
};

type Sub = { endpoint: string; name: string; sub: { endpoint: string; keys: { p256dh: string; auth: string } } };
type Msg = { title: string; body: string; url?: string };

const db = (path: string, init: RequestInit = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' } });

// who gets it, and what it says. New kinds go here (Secret Santa draw, Unboxing Day…)
async function plan(kind: string, key: string, ex: string): Promise<{ to: Sub[]; msg: (s: Sub) => Msg } | null> {
  if (kind === 'test') {
    const to: Sub[] = await (await db(`push_subs?player_key=eq.${encodeURIComponent(key)}`)).json();
    return { to, msg: (s) => ({ title: 'Spindown', body: `You're set, ${s.name}. This phone will hear about game stuff.` }) };
  }
  if (kind.startsWith('santa-')) return santa(kind, ex);
  return null;
}

// ---------- Pauper Secret Santa ----------
// Each message goes out once: the flags in santa_settings remember what was sent.

const SANTA = { title: 'Pauper Secret Santa' };
const HOST = 'Aaron'; // matches HOST in src/santa.ts
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

async function santa(kind: string, ex: string): Promise<{ to: Sub[]; msg: (s: Sub) => Msg } | null> {
  const [st] = await (await db(`santa_settings?exchange=eq.${encodeURIComponent(ex)}`)).json();
  if (!st) return null;
  const mark = (patch: Record<string, unknown>) =>
    db(`santa_settings?exchange=eq.${encodeURIComponent(ex)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  const none = { to: [], msg: () => ({ title: '', body: '' }) };

  if (kind === 'santa-signup') {
    // tell the host who just joined; only for a sign-up from the last 2 minutes, so it can't be replayed
    const rows: { name: string; created_at: string }[] = await (
      await db(`santa_signups?exchange=eq.${encodeURIComponent(ex)}&select=name,created_at&order=created_at.desc`)
    ).json();
    const last = rows[0];
    if (!last || Date.now() - Date.parse(last.created_at) > 120_000) return none;
    const to: Sub[] = await (await db(`push_subs?name=ilike.${encodeURIComponent(HOST)}`)).json();
    return { to, msg: () => ({ ...SANTA, body: `${last.name} signed up. ${rows.length} in so far.`, url: './#/santa' }) };
  }
  if (kind === 'santa-drawn') {
    const drawn = await (await db('rpc/santa_drawn', { method: 'POST', body: JSON.stringify({ p_exchange: ex }) })).json();
    if (!drawn || st.drawn_notified) return none;
    await mark({ drawn_notified: true });
    return { to: await santaPhones(ex), msg: () => ({ ...SANTA, body: "Names are drawn. Go see who you're building for.", url: './#/santa/reveal' }) };
  }
  if (kind === 'santa-date') {
    if (!st.unboxing || st.unboxing === st.date_notified) return none;
    await mark({ date_notified: st.unboxing, reminder_notified: false });
    return { to: await santaPhones(ex), msg: () => ({ ...SANTA, body: `Unboxing Day is ${day(st.unboxing)}. $20 cap, deck box included.`, url: './#/santa' }) };
  }
  if (kind === 'santa-reminder') {
    // run daily by .github/workflows/santa-reminder.yml
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const days = st.unboxing ? Math.round((Date.parse(st.unboxing) - Date.parse(today)) / 86400000) : -1;
    if (days < 1 || days > 3 || st.reminder_notified) return none;
    await mark({ reminder_notified: true });
    const when = days === 1 ? 'tomorrow' : `in ${days} days`;
    return { to: await santaPhones(ex), msg: () => ({ ...SANTA, body: `Unboxing Day is ${when}. Wrap it, tag it, bring it.`, url: './#/santa' }) };
  }
  return null;
}

/** Every phone that signed up for this exchange and turned notifications on. */
async function santaPhones(ex: string): Promise<Sub[]> {
  const rows: { player_key: string }[] = await (await db(`santa_signups?exchange=eq.${encodeURIComponent(ex)}&select=player_key`)).json();
  if (!rows.length) return [];
  return (await db(`push_subs?player_key=in.(${rows.map((r) => encodeURIComponent(r.player_key)).join(',')})`)).json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  try {
    const { kind, key, exchange } = await req.json();
    // quick setup check: can this function see the hidden Secret Santa data?
    if (kind === 'health') return json({ serviceRole: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') });
    const p = await plan(String(kind), String(key ?? ''), String(exchange ?? '2026'));
    if (!p) return json({ error: 'unknown kind' }, 400);
    const privateJWK = JSON.parse(Deno.env.get('VAPID_PRIVATE_KEY')!);
    let sent = 0, removed = 0;
    for (const s of p.to) {
      const { endpoint, headers, body } = await buildPushHTTPRequest({
        privateJWK,
        subscription: s.sub,
        message: { payload: p.msg(s), adminContact: 'mailto:aaronallgrin@users.noreply.github.com' },
      });
      const r = await fetch(endpoint, { method: 'POST', headers, body });
      if (r.ok) sent++;
      else if (r.status === 404 || r.status === 410) {
        // phone unsubscribed or reinstalled; forget it
        await db(`push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' });
        removed++;
      } else console.error('push failed', r.status, await r.text());
    }
    return json({ sent, removed });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
