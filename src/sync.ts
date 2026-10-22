import { db } from './db';
import type { GameRecord } from './types';
import { GROUP_CLOUD } from './cloud';

/**
 * Two-way sync of saved games with a Supabase table (see the setup SQL in README).
 * The phone keeps working offline; sync runs when it can.
 * The group's connection is built in (see cloud.ts); deletes are soft (deleted = true).
 */

const CFG = 'spindown.sync';
const PENDING_DELETES = 'spindown.pendingDeletes';

export interface SyncConfig {
  url: string;
  key: string;
  lastPull?: string;
  lastSync?: number;
}

/** True when the app ships with the group's connection, so there's nothing to set up. */
export const builtInSync = !!GROUP_CLOUD;

const readSaved = (): SyncConfig | null => {
  try {
    return JSON.parse(localStorage.getItem(CFG) || 'null');
  } catch {
    return null;
  }
};

export const getSync = (): SyncConfig | null => {
  const saved = readSaved();
  // the built-in connection always wins; the phone only keeps its sync progress
  if (GROUP_CLOUD) return { lastPull: saved?.lastPull, lastSync: saved?.lastSync, ...GROUP_CLOUD };
  return saved;
};
export const setSync = (c: SyncConfig | null) => {
  try {
    if (c) localStorage.setItem(CFG, JSON.stringify(c));
    else localStorage.removeItem(CFG);
  } catch {
    /* ignore */
  }
  notify();
};

const listeners = new Set<() => void>();
export const onSyncChange = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
const notify = () => listeners.forEach((f) => f());

export let syncState: { busy: boolean; error: string } = { busy: false, error: '' };
const setState = (s: Partial<typeof syncState>) => {
  syncState = { ...syncState, ...s };
  notify();
};

function headers(c: SyncConfig, extra: Record<string, string> = {}) {
  return { apikey: c.key, Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json', ...extra };
}
const base = (c: SyncConfig) => `${c.url.replace(/\/+$/, '')}/rest/v1/games`;

/** Check the URL and key reach the games table. */
export async function testConnection(c: SyncConfig): Promise<string | null> {
  try {
    const r = await fetch(`${base(c)}?select=id&limit=1`, { headers: headers(c) });
    if (r.ok) return null;
    const body = await r.text();
    if (r.status === 401 || r.status === 403) return 'The key was refused. Check you copied the anon (public) key.';
    if (r.status === 404 || body.includes('does not exist')) return 'Connected, but the games table is missing. Run the setup SQL.';
    return `Supabase answered ${r.status}: ${body.slice(0, 140)}`;
  } catch {
    return 'Could not reach that URL. Check it looks like https://xxxx.supabase.co and that you are online.';
  }
}

export function pendingDeletes(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_DELETES) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function queueDelete(id: string) {
  const list = pendingDeletes();
  if (list.includes(id)) return;
  try {
    localStorage.setItem(PENDING_DELETES, JSON.stringify([...list, id]));
  } catch {
    /* ignore */
  }
}

/** Drop the ids that reached the cloud, keeping any queued since. */
export function clearDeletes(sent: string[]) {
  try {
    localStorage.setItem(PENDING_DELETES, JSON.stringify(pendingDeletes().filter((d) => !sent.includes(d))));
  } catch {
    /* ignore */
  }
}

let running: Promise<void> | null = null;

/** Push unsynced games and deletions, then pull anything newer from the cloud. */
export function syncNow(): Promise<void> {
  const c = getSync();
  if (!c || !navigator.onLine) return Promise.resolve();
  running ??= (async () => {
    setState({ busy: true, error: '' });
    try {
      // push games saved on this phone
      const local = await db.games.where('synced').equals(0).toArray();
      if (local.length) {
        const rows = local.map((g) => ({ id: g.id, data: { ...g, synced: undefined }, deleted: false, updated_at: new Date().toISOString() }));
        const r = await fetch(base(c), {
          method: 'POST',
          headers: headers(c, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(rows),
        });
        if (!r.ok) throw new Error(`Upload failed (${r.status}): ${(await r.text()).slice(0, 140)}`);
        await db.games.bulkUpdate(local.map((g) => ({ key: g.id, changes: { synced: 1 as const } })));
      }

      // push deletions
      const dels = pendingDeletes();
      if (dels.length) {
        const r = await fetch(`${base(c)}?id=in.(${dels.map((d) => `"${d}"`).join(',')})`, {
          method: 'PATCH',
          headers: headers(c, { Prefer: 'return=minimal' }),
          body: JSON.stringify({ deleted: true, updated_at: new Date().toISOString() }),
        });
        if (!r.ok) throw new Error(`Delete failed (${r.status})`);
        // only clear what was sent: a game deleted while this request was out stays queued
        clearDeletes(dels);
      }

      // pull everything changed since last time; if this phone has no games (new phone, or the
      // browser cleared its storage) start from scratch so the whole history comes back
      const empty = (await db.games.count()) === 0;
      if (empty) c.lastPull = undefined;
      // gte, not gt: a batch upload stamps every row with the same time, and a page can end
      // partway through such a batch; re-reading the boundary rows is harmless (bulkPut)
      const since = c.lastPull ? `&updated_at=gte.${encodeURIComponent(c.lastPull)}` : '';
      let newest = c.lastPull;
      for (let offset = 0; ; offset += 500) {
        const r = await fetch(`${base(c)}?select=id,data,deleted,updated_at&order=updated_at.asc,id.asc${since}&limit=500&offset=${offset}`, {
          headers: headers(c),
        });
        if (!r.ok) throw new Error(`Download failed (${r.status}): ${(await r.text()).slice(0, 140)}`);
        const rows: { id: string; data: GameRecord; deleted: boolean; updated_at: string }[] = await r.json();
        const keep = rows.filter((x) => !x.deleted).map((x) => ({ ...x.data, synced: 1 as const }));
        const gone = rows.filter((x) => x.deleted).map((x) => x.id);
        if (keep.length) await db.games.bulkPut(keep);
        if (gone.length) await db.games.bulkDelete(gone);
        if (rows.length) newest = rows[rows.length - 1].updated_at;
        if (rows.length < 500) break;
      }
      setSync({ ...getSync()!, lastPull: newest, lastSync: Date.now() });
      setState({ busy: false });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Sync on start, when the phone comes back online, and every few minutes while open. */
export function startAutoSync() {
  // ask the browser not to clear this app's storage when the phone is low on space
  navigator.storage?.persist?.().catch(() => {});
  syncNow();
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow());
  window.setInterval(() => document.visibilityState === 'visible' && syncNow(), 5 * 60 * 1000);
}

// ---- invite another device with a link / QR code ----

const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export const encodeInvite = (c: SyncConfig) => b64url(JSON.stringify({ u: c.url, k: c.key }));

export function inviteLink(c: SyncConfig) {
  return `${location.origin}${location.pathname}#/join/${encodeInvite(c)}`;
}

export function decodeInvite(code: string): SyncConfig | null {
  try {
    const o = JSON.parse(unb64url(code));
    if (typeof o.u === 'string' && /^https:\/\//.test(o.u) && typeof o.k === 'string') return { url: o.u, key: o.k };
  } catch {
    /* fall through */
  }
  return null;
}
