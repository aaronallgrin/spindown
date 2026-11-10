import { useEffect, useRef, useState } from 'react';
import { playerName, setPlayerName } from '../polls';
import { pushState, saveName, sendTest, turnOff, turnOn, type PushState } from '../push';
import { usePlayerMemory } from './usePlayerMemory';

/** Footer button + sheet: who this phone belongs to, and its notifications. */
export default function PhoneSheet() {
  const sheet = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(playerName());
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const { names } = usePlayerMemory();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);

  const pick = (n: string) => {
    setName(n);
    setPlayerName(n);
    if (state === 'on') saveName(n).catch(() => {});
  };
  // every button here talks to the network; show what went wrong instead of failing quietly
  const run = (f: () => Promise<unknown>, done: string) => async () => {
    setBusy(true);
    setNote('');
    try {
      await f();
      setNote(done);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'That didn’t work.');
    }
    setState(await pushState().catch(() => 'unsupported' as const));
    setBusy(false);
  };

  return (
    <>
      <button type="button" onClick={() => sheet.current?.showModal()} className="rounded-md px-2 py-1 active:text-brass">
        {name ? `This phone is ${name}` : 'Whose phone is this?'}
      </button>
      <dialog ref={sheet} className="sheet" aria-labelledby="phone-title" onClick={(e) => e.target === sheet.current && sheet.current.close()}>
        <div className="px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" aria-hidden />
          <h2 id="phone-title" className="font-cond text-3xl font-bold">
            This <span className="rounded-lg bg-brass px-1.5 text-felt">phone</span>
          </h2>
          <p className="mt-1 text-sm text-dim">Tap your name. Polls and notifications use it.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...new Set([...(name ? [name] : []), ...names])].slice(0, 16).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={n === name}
                onClick={() => pick(n)}
                className={`rounded-full px-3.5 py-1.5 text-[15px] transition ${n === name ? 'bg-brass font-semibold text-felt' : 'bg-white/[.06] text-bone/85'}`}
              >
                {n}
              </button>
            ))}
            {!adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="rounded-full px-3.5 py-1.5 text-[15px] text-brass ring-1 ring-brass/50 ring-inset"
              >
                + New name
              </button>
            )}
          </div>
          {adding && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                pick(draft.trim());
                setDraft('');
                setAdding(false);
              }}
            >
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={24}
                placeholder="Your name"
                aria-label="Your name"
                className="min-w-0 flex-1 rounded-xl bg-white/[.06] px-3 py-2.5 text-bone placeholder:text-dim"
              />
              <button type="submit" disabled={!draft.trim()} className="rounded-xl bg-brass px-4 font-semibold text-felt disabled:opacity-40">
                Save
              </button>
            </form>
          )}

          <p className="mt-6 mb-2 text-xs font-semibold tracking-wider text-dim uppercase">Notifications</p>
          {state === 'install-first' && (
            <p className="text-[15px] text-bone/90">Add Spindown to your Home Screen first (Share, then Add to Home Screen), then open it from there.</p>
          )}
          {state === 'unsupported' && <p className="text-[15px] text-bone/90">This browser can’t do notifications.</p>}
          {state === 'blocked' && (
            <p className="text-[15px] text-bone/90">They’re blocked. Turn them back on in your phone’s Settings, Notifications, Spindown.</p>
          )}
          {state === 'off' && (
            <button
              type="button"
              disabled={busy || !name}
              onClick={run(() => turnOn(name), 'On. Try a test.')}
              className="w-full rounded-xl bg-brass py-3 font-semibold text-felt transition active:scale-[.98] disabled:opacity-40"
            >
              {name ? 'Turn on notifications' : 'Pick your name first'}
            </button>
          )}
          {state === 'on' && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={run(sendTest, 'Sent. Should land in a few seconds.')} className="rounded-xl bg-brass py-3 font-semibold text-felt disabled:opacity-40">
                Send me a test
              </button>
              <button type="button" disabled={busy} onClick={run(turnOff, 'Off.')} className="rounded-xl bg-white/[.06] py-3 font-semibold disabled:opacity-40">
                Turn off
              </button>
            </div>
          )}
          {note && <p className="mt-2 text-sm text-dim">{note}</p>}

          <button type="button" onClick={() => sheet.current?.close()} className="mt-7 w-full rounded-xl bg-white/[.06] py-3 font-semibold transition active:scale-[.98]">
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
