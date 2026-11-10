import { useEffect, useState } from 'react';
import { isIPhone } from '../install';

type InstallPrompt = Event & { prompt: () => Promise<void> };

/** Shown instead of the app when a phone opens Spindown in a browser tab. */
export default function InstallFirst() {
  // Android Chrome offers a one-tap install; iPhone has no such thing, so it gets the steps
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  const steps = isIPhone()
    ? [
        <>Tap the <b>Share</b> button (the square with the arrow pointing up)</>,
        <>Scroll down and tap <b>Add to Home Screen</b></>,
        <>Tap <b>Add</b></>,
        <>Open Spindown from the new icon on your Home Screen</>,
      ]
    : [
        <>Tap the <b>⋮</b> menu at the top right</>,
        <>Tap <b>Install app</b> or <b>Add to Home screen</b></>,
        <>Open Spindown from the new icon on your Home Screen</>,
      ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <img src="./icon-192.png" alt="" className="mb-5 h-20 w-20 rounded-2xl" />
      <h1 className="font-cond text-4xl font-bold">Add Spindown to your Home Screen</h1>
      <p className="mt-2 text-dim">It works like a real app from there. In a browser tab it can lose your games.</p>

      {prompt ? (
        <button
          onClick={() => prompt.prompt()}
          className="mt-6 rounded-2xl bg-brass px-5 py-4 font-cond text-2xl font-bold text-felt active:scale-[.98]"
        >
          Install Spindown
        </button>
      ) : (
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-felt-2 px-4 py-3">
              <span className="font-cond text-xl font-bold text-brass">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6 text-sm text-dim">
        Don’t see those buttons? You might be inside Messages, Instagram or another app. Open this link in {isIPhone() ? 'Safari' : 'Chrome'} first.
      </p>
    </main>
  );
}
