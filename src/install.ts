/** Is Spindown running from its Home Screen icon, and is this a phone? */
export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.matchMedia?.('(display-mode: fullscreen)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;

export const isIPhone = () => /iP(hone|od)/.test(navigator.userAgent);
export const isPhone = () => isIPhone() || /Android/.test(navigator.userAgent);

/**
 * Phones must use the installed app. Poll and join links still open in the browser,
 * because iPhone always opens links there, even with the app installed.
 */
export const mustInstall = (hash = location.hash) => isPhone() && !isInstalled() && !/^#\/(poll|join)\//.test(hash);
