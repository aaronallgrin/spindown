import type { ComponentType } from 'react';

const RELOADED = 'spindown.chunkReload';

/**
 * A page loaded on first visit, as a data-router `lazy` route: the router fetches the
 * page before it switches, so the page transition has the new page to animate to.
 * After a deploy, a phone that kept the app open can ask for a page file the new build
 * no longer has; reload once to pick up the new build.
 */
export function lazyRoute<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return () =>
    load()
      .then((m) => {
        sessionStorage.removeItem(RELOADED);
        return { Component: pick(m) };
      })
      .catch((e) => {
        if (navigator.onLine && !sessionStorage.getItem(RELOADED)) {
          sessionStorage.setItem(RELOADED, '1');
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw e;
      });
}
