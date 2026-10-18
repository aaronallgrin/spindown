/** A short tick under the finger. Android only; iPhones have no web vibration, so this does nothing there. */
export function buzz(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed */
  }
}
