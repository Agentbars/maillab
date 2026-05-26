import { describe, it, expect } from 'vitest'
import { pickHealthBehavior } from '@/lib/health'

// Branch boundaries per specs/10-health.md §2:
//   [0.00, 0.80) → fast200
//   [0.80, 0.95) → slow200
//   [0.95, 1.00] → fast503
describe('pickHealthBehavior', () => {
  it('returns fast200 at rand = 0', () => {
    expect(pickHealthBehavior(0)).toBe('fast200')
  })

  it('returns fast200 just below the 80% boundary', () => {
    expect(pickHealthBehavior(0.7999999)).toBe('fast200')
  })

  it('returns slow200 at rand = 0.80 (lower edge of 15% band)', () => {
    expect(pickHealthBehavior(0.8)).toBe('slow200')
  })

  it('returns slow200 just below the 95% boundary', () => {
    expect(pickHealthBehavior(0.9499999)).toBe('slow200')
  })

  it('returns fast503 at rand = 0.95 (lower edge of 5% band)', () => {
    expect(pickHealthBehavior(0.95)).toBe('fast503')
  })

  it('returns fast503 at rand = 0.999...', () => {
    expect(pickHealthBehavior(0.9999999)).toBe('fast503')
  })
})
