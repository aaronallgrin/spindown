/**
 * Quiet auto-update. iPhones resume the Home Screen app instead of relaunching it, so a
 * new build can sit unused for days. Each time the app is opened, ask for a newer build;
 * once it has taken over, reload, but only on Home, so a game or a half-typed form is
 * never interrupted. Anywhere else, the reload waits until the player is back on Home.
 */
const onHome = () => ['', '#', '#/'].includes(location.hash);

export function startAutoUpdate() {
  const sw = navigator.serviceWorker;
  if (!sw?.controller) return; // first install: there's no old version to replace
  let ready = false;
  const reloadIfSafe = () => ready && onHome() && location.reload();
  sw.addEventListener('controllerchange', () => {
    ready = true;
    reloadIfSafe();
  });
  window.addEventListener('hashchange', reloadIfSafe);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sw.getRegistration().then((r) => r?.update()).catch(() => {});
  });
}
