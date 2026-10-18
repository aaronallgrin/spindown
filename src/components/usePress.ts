import { useRef } from 'react';
import { buzz } from '../haptics';

const MIN_REPEAT = 170;

/**
 * Tap fires `onTap`; holding fires `onHold` after a delay, then repeats.
 * Used for life buttons: tap ±1, hold ±10 repeating, speeding up the longer it's held.
 */
export function usePress(onTap: () => void, onHold?: () => void, delay = 450, repeat = 550) {
  const t = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const active = useRef(false);

  const clear = () => {
    window.clearTimeout(t.current);
    t.current = undefined;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      active.current = true;
      held.current = false;
      clear();
      if (onHold) {
        // each repeat comes a little sooner, down to a floor, so 40 to 0 doesn't drag
        const fire = (wait: number) => {
          held.current = true;
          buzz();
          onHold();
          t.current = window.setTimeout(() => fire(Math.max(MIN_REPEAT, wait * 0.8)), wait);
        };
        t.current = window.setTimeout(() => fire(repeat), delay);
      }
    },
    onPointerUp: () => {
      if (!active.current) return;
      active.current = false;
      clear();
      if (!held.current) {
        buzz();
        onTap();
      }
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
