// INTENTIONAL FLAKY BEHAVIOR — the /api/health endpoint is the substrate for
// the AQA Course "TestResults analyzation" task. Do not "fix" the flakiness.
// See specs/10-health.md for the design rationale.

/**
 * Probability bands per specs/10-health.md §2. Tunable.
 *
 *   [0.00, FAST_200_THRESHOLD)        → fast200   (default 80%)
 *   [FAST_200_THRESHOLD, SLOW_200_THRESHOLD) → slow200 (default 15%)
 *   [SLOW_200_THRESHOLD, 1.00]        → fast503   (default 5%)
 */
export const FAST_200_THRESHOLD = 0.80
export const SLOW_200_THRESHOLD = 0.95

/** Slow-branch delay window in milliseconds, used as `MIN + rand * SPAN`. */
export const SLOW_DELAY_MIN_MS = 4000
export const SLOW_DELAY_MAX_MS = 6000

export type HealthBehavior = 'fast200' | 'slow200' | 'fast503'

/**
 * Pure picker — given a 0..1 random number, returns which response branch to
 * take. Extracted so it is unit-testable against deterministic input.
 */
export function pickHealthBehavior(rand: number): HealthBehavior {
  if (rand < FAST_200_THRESHOLD) return 'fast200'
  if (rand < SLOW_200_THRESHOLD) return 'slow200'
  return 'fast503'
}
