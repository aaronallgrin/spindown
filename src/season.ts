/** Seasonal touches for Home: what falls behind the buttons. */
export type Season = "winter" | "spring" | "summer" | "fall";

export function seasonOf(d: Date): Season {
  const m = d.getMonth(); // 0 = Jan
  return m === 11 || m < 2
    ? "winter"
    : m < 5
      ? "spring"
      : m < 8
        ? "summer"
        : "fall";
}

/** Particle look per season. Summer stays clean. */
export const FALLING: Record<
  Season,
  {
    count: number;
    colors: string[];
    size: [number, number];
    leaf: boolean;
  } | null
> = {
  winter: { count: 36, colors: ["#ffffff"], size: [2, 4], leaf: false },
  spring: {
    count: 12,
    colors: ["#f4c6d6", "#ffffff"],
    size: [4, 6],
    leaf: true,
  },
  summer: null,
  fall: {
    count: 14,
    colors: ["#c0602a", "#ffa31a", "#8a3b1c"],
    size: [6, 9],
    leaf: true,
  },
};
