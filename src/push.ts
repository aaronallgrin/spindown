/**
 * Push notifications. The phone subscribes, the subscription is stored in Supabase
 * next to this phone's name, and supabase/functions/notify sends them.
 * iPhone: only works in the installed app (Add to Home Screen), iOS 16.4+.
 */
import { playerKey, pollsCfg } from './polls';

// public half of the notification key; the private half is a Supabase secret
const VAPID_PUBLIC = 'BOXuKP5fqlDvrFlMsbuEvvso-SPbLC__qLZYcISs4_j6G_5aMYPUwovRNCqEIBc_T6_bfPZKdIHTJcUf1C8i-lg';

export type PushState = 'unsupported' | 'install-first' | 'blocked' | 'off' | 'on';

const iOS = /iP(hone|ad|od)/.test(navigator.userAgent);
const standalone =
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.matchMedia?.('(display-mode: fullscreen)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;

export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window))
    return iOS && !standalone ? 'install-first' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

async function cloud(path: string, init: RequestInit & { prefer?: string } = {}) {
  const c = pollsCfg();
  if (!c) throw new Error('This phone isn’t connected to the group yet.');
  const headers: Record<string, string> = { apikey: c.key, Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json' };
  if (init.prefer) headers.Prefer = init.prefer;
  let r: Response;
  try {
    r = await fetch(`${c.url.replace(/\/+$/, '')}/${path}`, { ...init, headers });
  } catch {
    throw new Error('Can’t reach the group. Check you’re online.');
  }
  if (r.status === 404) throw new Error('Notifications aren’t set up in Supabase yet (push.sql and the notify function).');
  if (!r.ok) throw new Error(`Supabase answered ${r.status}: ${(await r.text()).slice(0, 140)}`);
  return r;
}

const keyBytes = (b64url: string) => Uint8Array.from(atob(b64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Must run from a tap: iPhone only shows the permission prompt for a user action. */
export async function turnOn(name: string) {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications weren’t allowed.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
  await saveName(name, sub);
}

/** Keep the stored name in step when someone renames this phone. */
export async function saveName(name: string, sub?: PushSubscription | null) {
  sub ??= await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (!sub) return;
  await cloud('rest/v1/push_subs?on_conflict=endpoint', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify({ endpoint: sub.endpoint, player_key: playerKey(), name, sub: sub.toJSON(), updated_at: new Date().toISOString() }),
  });
}

export async function turnOff() {
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (!sub) return;
  await cloud(`rest/v1/push_subs?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTest() {
  const r = await cloud('functions/v1/notify', { method: 'POST', body: JSON.stringify({ kind: 'test', key: playerKey() }) });
  const { sent } = await r.json();
  if (!sent) throw new Error('Nothing was sent. Try turning notifications off and on again.');
}
