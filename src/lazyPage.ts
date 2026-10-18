import { lazy, type ComponentType } from 'react';

const RELOADED = 'spindown.chunkReload';

/**
 * React.lazy for a page. After a deploy, a phone that kept the app open can ask
 * for a page file the new build no longer has; reload once to pick up the new build.
 */
export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load()
      .then((m) => {
        sessionStorage.removeItem(RELOADED);
        return m;
      })
      .catch((e) => {
        if (navigator.onLine && !sessionStorage.getItem(RELOADED)) {
          sessionStorage.setItem(RELOADED, '1');
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
        throw e;
      }),
  );
}
