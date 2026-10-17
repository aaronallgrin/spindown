/**
 * Coaching tips on the table. They show for the first few games played on
 * this phone, then stop on their own. The game menu can turn them back on
 * (or off) for good.
 */

const PREF = 'spindown.tips'; // 'on' | 'off' once someone chooses; unset = automatic
const SEEN = 'spindown.tipGames'; // ids of games that showed tips while automatic
const AUTO_GAMES = 3;

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const put = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

/** Whether this game should show tips. Counts the game toward the first few. */
export function tipsFor(gameId: string): boolean {
  const pref = get(PREF);
  if (pref === 'off') return false;
  if (pref === 'on') return true;
  let seen: string[] = [];
  try {
    seen = JSON.parse(get(SEEN) || '[]');
  } catch {
    /* start over */
  }
  if (seen.includes(gameId)) return true;
  if (seen.length >= AUTO_GAMES) return false;
  put(SEEN, JSON.stringify([...seen, gameId]));
  return true;
}

export function setTips(on: boolean) {
  put(PREF, on ? 'on' : 'off');
}
