import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getSync, onSyncChange, setSync, syncNow, syncState, testConnection } from '../sync';
import ConfirmBtn from '../components/ConfirmBtn';
import { Btn, Page } from '../ui';

function useSyncInfo() {
  const [, tick] = useState(0);
  useEffect(() => {
    const off = onSyncChange(() => tick((x) => x + 1));
    return () => {
      off();
    };
  }, []);
  return { cfg: getSync(), state: syncState };
}

export default function Sync() {
  const { cfg, state } = useSyncInfo();
  const total = useLiveQuery(() => db.games.count(), []);
  const waiting = useLiveQuery(() => db.games.where('synced').equals(0).count(), []);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [checking, setChecking] = useState(false);

  const connect = async () => {
    const c = { url: url.trim(), key: key.trim() };
    if (!/^https:\/\/.+/.test(c.url) || !c.key) return setMsg('Enter both the Project URL and the anon key.');
    setChecking(true);
    setMsg('');
    const problem = await testConnection(c);
    setChecking(false);
    if (problem) return setMsg(problem);
    setSync(c);
    setUrl('');
    setKey('');
    await syncNow();
  };

  return (
    <Page title="Cloud sync">
      {!cfg ? (
        <div className="flex flex-col gap-3">
          <p className="text-dim">
            Back up every saved game to your Supabase database, and see the same history and stats on any device you connect.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-dim">Project URL</span>
            <input
              id="sync-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://abcd1234.supabase.co"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              className="rounded-lg bg-felt-2 px-3 py-3 placeholder:text-dim"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-dim">Anon (public) key</span>
            <input
              id="sync-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJ… or sb_publishable_…"
              type="password"
              autoCapitalize="off"
              autoCorrect="off"
              className="rounded-lg bg-felt-2 px-3 py-3 placeholder:text-dim"
            />
          </label>
          {msg && <p className="rounded-lg bg-blood/15 p-3 text-sm">{msg}</p>}
          <Btn variant="primary" onClick={connect} disabled={checking} className="py-3.5">
            {checking ? 'Checking' : 'Connect'}
          </Btn>
          <p className="text-xs leading-relaxed text-dim">
            Both values are in Supabase under Project Settings, API. They stay on this device.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-felt-2 p-4">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${state.error ? 'bg-blood' : 'bg-mana-g'}`} />
              <span className="font-semibold">{state.busy ? 'Syncing' : state.error ? 'Sync problem' : 'Connected'}</span>
            </div>
            <div className="mt-1 truncate text-sm text-dim">{cfg.url.replace(/^https:\/\//, '')}</div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-dim">Games here</dt>
                <dd className="font-cond text-2xl font-bold">{total ?? '–'}</dd>
              </div>
              <div>
                <dt className="text-xs text-dim">Waiting to upload</dt>
                <dd className="font-cond text-2xl font-bold">{waiting ?? '–'}</dd>
              </div>
              <div>
                <dt className="text-xs text-dim">Last sync</dt>
                <dd className="font-semibold">
                  {cfg.lastSync ? new Date(cfg.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Never'}
                </dd>
              </div>
            </dl>
            {state.error && <p className="mt-3 rounded-lg bg-blood/15 p-3 text-sm">{state.error}</p>}
          </div>
          <Btn variant="primary" onClick={() => syncNow()} disabled={state.busy}>
            Sync now
          </Btn>
          <p className="text-sm text-dim">
            Games sync by themselves when you save one, when the app opens, and every few minutes while it's open. Offline games
            upload when the phone is back online.
          </p>
          <ConfirmBtn
            variant="quiet"
            onConfirm={() => setSync(null)}
            confirmLabel="Tap again to disconnect this device"
            className="mt-4"
          >
            Disconnect this device
          </ConfirmBtn>
        </div>
      )}
    </Page>
  );
}
