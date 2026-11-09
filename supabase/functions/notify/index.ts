// Sends Spindown's push notifications. The app says what happened ("kind");
// the words live here, so nobody can use this to send the group arbitrary text.
//
// Setup (once): Supabase → Edge Functions → Deploy a new function → Via Editor,
// name it "notify", paste this file, and turn OFF "Verify JWT" (the app's key isn't a JWT).
// Then Edge Functions → Secrets: VAPID_PRIVATE_KEY = the private key Claude gave you.
import { buildPushHTTPRequest } from 'npm:@pushforge/builder@2';

const URL_ = Deno.env.get('SUPABASE_URL')!;
// the table is group-readable, so either key works
const KEY = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY'))!;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
};

type Sub = { endpoint: string; name: string; sub: { endpoint: string; keys: { p256dh: string; auth: string } } };
type Msg = { title: string; body: string; url?: string };

const db = (path: string, init: RequestInit = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' } });

// who gets it, and what it says. New kinds go here (Secret Santa draw, Unboxing Day…)
async function plan(kind: string, key: string): Promise<{ to: Sub[]; msg: (s: Sub) => Msg } | null> {
  if (kind === 'test') {
    const to: Sub[] = await (await db(`push_subs?player_key=eq.${encodeURIComponent(key)}`)).json();
    return { to, msg: (s) => ({ title: 'Spindown', body: `You're set, ${s.name}. This phone will hear about game stuff.` }) };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  try {
    const { kind, key } = await req.json();
    const p = await plan(String(kind), String(key ?? ''));
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
