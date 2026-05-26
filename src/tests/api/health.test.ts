import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { GET } = await import('@/app/api/health/route')

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns 200 with { status, uptime, version } on the fast-200 branch', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1) // < 0.80 → fast200
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(typeof body.uptime).toBe('number')
    expect(Number.isInteger(body.uptime)).toBe(true)
    expect(typeof body.version).toBe('string')
    expect(body.version.length).toBeGreaterThan(0)
  })

  it('returns 503 with { error } on the fast-503 branch', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.97) // ≥ 0.95 → fast503
    const res = await GET()
    expect(res.status).toBe(503)
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/)
    const body = await res.json()
    expect(body).toEqual({ error: 'Service unavailable' })
  })

  it('returns 200 on the slow-200 branch (delays before responding)', async () => {
    // First Math.random() picks the branch (0.85 → slow200); second pick
    // controls the delay magnitude within [SLOW_DELAY_MIN_MS, SLOW_DELAY_MAX_MS].
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0.85).mockReturnValueOnce(0.5)

    const promise = GET()
    // Advance fake timers past the 6s upper bound so the setTimeout fires.
    await vi.advanceTimersByTimeAsync(6500)
    const res = await promise

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
