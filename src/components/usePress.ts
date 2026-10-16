import { useRef } from 'react';

/**
 * Tap fires `onTap`; holding fires `onHold` after a delay, then repeats.
 * Used for life buttons: tap ±1, hold ±10 repeating.
 */
export function usePress(onTap: () => void, onHold?: () => void, delay = 450, repeat = 550) {
  const t = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const active = useRef(false);

  const clear = () => {
    window.clearTimeout(t.current);
    window.clearInterval(t.current);
    t.current = undefined;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      active.current = true;
      held.current = false;
      clear();
      if (onHold) {
        t.current = window.setTimeout(() => {
          held.current = true;
          onHold();
          t.current = window.setInterval(onHold, repeat);
        }, delay);
      }
    },
    onPointerUp: () => {
      if (!active.current) return;
      active.current = false;
      clear();
      if (!held.current) onTap();
    },
    onPointerLeave: () => {
      active.current = false;
      clear();
    },
    onPointerCancel: () => {
      active.current = false;
      clear();
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
