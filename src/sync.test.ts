import { beforeEach, describe, expect, it, vi } from 'vitest';

// a plain in-memory localStorage; sync only touches localStorage in these helpers
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.mock('./db', () => ({ db: {} }));

const { clearDeletes, pendingDeletes, queueDelete, decodeInvite, encodeInvite } = await import('./sync');

describe('delete queue', () => {
  beforeEach(() => store.clear());

  it('queues each game once', () => {
    queueDelete('a');
    queueDelete('a');
    queueDelete('b');
    expect(pendingDeletes()).toEqual(['a', 'b']);
  });

  it('keeps a delete queued while an earlier batch was uploading', () => {
    queueDelete('a');
    const sent = pendingDeletes();
    queueDelete('b'); // deleted while the request for 'a' was out
    clearDeletes(sent);
    expect(pendingDeletes()).toEqual(['b']);
  });

  it('shrugs off a damaged queue', () => {
    store.set('spindown.pendingDeletes', '{oops');
    expect(pendingDeletes()).toEqual([]);
    store.set('spindown.pendingDeletes', '"text"');
    expect(pendingDeletes()).toEqual([]);
  });
});

describe('invite codes', () => {
  it('round-trips a connection and rejects anything not https', () => {
    const c = { url: 'https://abc.supabase.co', key: 'sb_publishable_x' };
    expect(decodeInvite(encodeInvite(c))).toEqual(c);
    expect(decodeInvite(encodeInvite({ url: 'http://evil', key: 'k' }))).toBeNull();
    expect(decodeInvite('not-base64!')).toBeNull();
  });
});
