import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from '../nav';
import { builtInSync, decodeInvite, getSync, setSync, syncNow, testConnection } from '../sync';
import { Page } from '../ui';

/** Opened from the QR code on another device's Sync screen. */
export default function Join() {
  const { code = '' } = useParams();
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      // old invite links still work: the app is already connected
      if (builtInSync) {
        syncNow();
        return setState('done');
      }
      const c = decodeInvite(code);
      if (!c) {
        setState('error');
        return setMsg('This invite link is damaged. Scan the QR code again.');
      }
      const already = getSync();
      if (already && already.url === c.url && already.key === c.key) return setState('done');
      const problem = await testConnection(c);
      if (problem) {
        setState('error');
        return setMsg(problem);
      }
      setSync(c);
      await syncNow();
      setState('done');
    })();
  }, [code]);

  return (
    <Page title="Join your group">
      {state === 'working' && <p className="text-dim">Connecting this device</p>}
      {state === 'error' && <p className="rounded-xl bg-blood/15 p-4">{msg}</p>}
      {state === 'done' && (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl bg-felt-2 p-4">
            This device is connected. Your group's games are syncing here, and anything saved here goes to everyone.
          </p>
          <Link to="/stats" className="rounded-lg bg-brass px-4 py-3 text-center font-semibold text-felt">
            See the stats
          </Link>
          <Link to="/" className="text-center text-dim hover:text-bone">
            Home
          </Link>
        </div>
      )}
    </Page>
  );
}
