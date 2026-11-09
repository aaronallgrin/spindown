/** Seasonal and holiday touches for Home: what drifts down behind the buttons. */
export type Shape = 'dot' | 'leaf' | 'egg' | 'heart' | 'glow';
export type Look = { count: number; colors: string[]; size: [number, number]; shape: Shape; slow?: boolean };

export const THEMES = {
  winter: { count: 36, colors: ['#ffffff'], size: [2, 4], shape: 'dot' },
  spring: { count: 12, colors: ['#f4c6d6', '#ffffff'], size: [4, 6], shape: 'leaf' },
  summer: { count: 14, colors: ['#ffe27a'], size: [2, 4], shape: 'glow', slow: true }, // fireflies
  fall: { count: 14, colors: ['#c0602a', '#ffa31a', '#8a3b1c'], size: [6, 9], shape: 'leaf' },
  halloween: { count: 18, colors: ['#ff7a1a', '#9b59d0', '#7fd65a'], size: [2, 4], shape: 'glow', slow: true }, // embers
  july4: { count: 30, colors: ['#e0453a', '#ffffff', '#4a7fe0'], size: [2, 4], shape: 'glow' }, // sparks
  valentines: { count: 16, colors: ['#e8476b', '#f4a3b8'], size: [10, 16], shape: 'heart' },
  easter: { count: 12, colors: ['#f7d6e0', '#cfe8f7', '#fff3b0', '#d4f0c8', '#e3d4f5'], size: [7, 10], shape: 'egg' },
  passover: { count: 18, colors: ['#e8c26a', '#ffffff'], size: [2, 4], shape: 'glow' },
  hanukkah: { count: 24, colors: ['#5b8def', '#ffffff', '#e8c26a'], size: [2, 4], shape: 'glow' },
  christmas: { count: 36, colors: ['#ffffff', '#ffffff', '#d2492f', '#3f9b5a'], size: [2, 5], shape: 'dot' },
  kwanzaa: { count: 24, colors: ['#d2492f', '#3f9b5a', '#e8c26a'], size: [2, 4], shape: 'glow' },
} satisfies Record<string, Look>;
export type Theme = keyof typeof THEMES;

const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate(); // Mar 20 -> 320

// shortcut: equinox/solstice pinned to Mar 20, Jun 21, Sep 22; they drift a day some years, fine for decoration
export function seasonOf(d: Date): Theme {
  const n = md(d);
  return n >= 1201 || n < 320 ? 'winter' : n < 621 ? 'spring' : n < 922 ? 'summer' : 'fall';
}

/** Western Easter Sunday (anonymous Gregorian algorithm). */
export function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - Math.floor(b / 4) - g + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const t = h + l - 7 * m + 114;
  return new Date(y, Math.floor(t / 31) - 1, (t % 31) + 1);
}

// The browser knows the Hebrew calendar, so Passover and Hanukkah need no tables.
const hebrew = (() => {
  try {
    return new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'long', day: 'numeric' });
  } catch {
    return null;
  }
})();
/** True if `d` falls within 8 days starting on Hebrew `day month` (the daytime dates; the holiday starts the evening before). */
function eightDaysFrom(d: Date, month: string, day: number) {
  if (!hebrew) return false;
  for (let k = 0; k < 8; k++) {
    const p = hebrew.formatToParts(new Date(d.getFullYear(), d.getMonth(), d.getDate() - k));
    if (p.find((x) => x.type === 'month')?.value === month && Number(p.find((x) => x.type === 'day')?.value) === day) return true;
  }
  return false;
}

/** Every theme showing on this day: holidays win over the season, and overlapping holidays share the screen. */
export function themesOn(d: Date): Theme[] {
  const n = md(d);
  const e = easter(d.getFullYear());
  const on: Theme[] = [];
  if (n === 214) on.push('valentines');
  if (n === 704) on.push('july4');
  if (n === 1031) on.push('halloween');
  if (d.getMonth() === e.getMonth() && d.getDate() === e.getDate()) on.push('easter');
  if (eightDaysFrom(d, 'Nisan', 15)) on.push('passover');
  if (eightDaysFrom(d, 'Kislev', 25)) on.push('hanukkah');
  if (n === 1224 || n === 1225) on.push('christmas');
  if (n >= 1226 || n === 101) on.push('kwanzaa');
  return on.length ? on : [seasonOf(d)];
}
