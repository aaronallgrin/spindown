import { useRouteError } from 'react-router-dom';
import { D20 } from '../ui';

/** Shown when a page fails to load or crashes. A live game is safe: it's saved on the phone. */
export default function RouteError() {
  const err = useRouteError() as { message?: string } | undefined;
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <D20 value="1" size={72} />
      <h1 className="font-cond text-3xl font-bold">Natural 1</h1>
      <p className="text-dim">
        This page hit a snag. Any game in progress is still saved on this phone.
        {err?.message ? <span className="mt-2 block text-xs opacity-70">{err.message}</span> : null}
      </p>
      <div className="mt-2 flex w-full gap-2">
        <a href="#/" className="flex-1 rounded-xl bg-brass py-3 font-semibold text-felt">
          Home
        </a>
        <button onClick={() => window.location.reload()} className="flex-1 rounded-xl bg-white/[.06] py-3">
          Reload
        </button>
      </div>
    </div>
  );
}
