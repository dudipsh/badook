// apps/api/src/scripts/demo-rounds/rng.ts
// Deterministic RNG (mulberry32) so reruns with the same seed produce
// identical documents — critical for reproducible demos and tests.

export type Rng = () => number;

export const createRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const intBetween = (rng: Rng, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

export const pick = <T>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

/** Realistic ILS prices — half-shekel steps. */
export const priceBetween = (rng: Rng, min: number, max: number): number =>
  Math.round((min + rng() * (max - min)) * 2) / 2;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Stable FNV-1a hash — used to pick a supplier's name for a product so the
 * same supplier always uses the same alias (no RNG, fully deterministic). */
export const hashString = (s: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};
