/** Date of the build that is deployed, like 2026_10_15 (set in vite.config.ts) */
declare const __BUILD_DATE__: string;

declare module 'sql.js/dist/sql-wasm-browser.js' {
  import type initSqlJs from 'sql.js';
  const init: typeof initSqlJs;
  export default init;
}
