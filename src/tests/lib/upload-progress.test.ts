import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { simulateUploadProgress } = await import('@/lib/upload-progress')

describe('simulateUploadProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('emits monotonically increasing progress and completes', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // → min duration (3000ms)
    const ticks: number[] = []
    let done = false

    simulateUploadProgress({
      onTick: (p) => ticks.push(p),
      onDone: () => { done = true },
    })

    await vi.advanceTimersByTimeAsync(3_000)

    expect(done).toBe(true)
    expect(ticks.length).toBeGreaterThan(5)
    expect(ticks[0]).toBeGreaterThanOrEqual(0)
    expect(ticks[ticks.length - 1]).toBe(100)
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThanOrEqual(ticks[i - 1])
    }
  })

  it('takes at least 3 seconds at minimum boundary', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    let done = false
    simulateUploadProgress({ onTick: () => {}, onDone: () => { done = true } })

    await vi.advanceTimersByTimeAsync(2_999)
    expect(done).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })

  it('completes within 4 seconds at maximum boundary', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999999)
    let done = false
    simulateUploadProgress({ onTick: () => {}, onDone: () => { done = true } })

    await vi.advanceTimersByTimeAsync(4_000)
    expect(done).toBe(true)
  })

  it('cancel stops further ticks and prevents onDone', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    let done = false
    const ticks: number[] = []

    const cancel = simulateUploadProgress({
      onTick: (p) => ticks.push(p),
      onDone: () => { done = true },
    })

    await vi.advanceTimersByTimeAsync(500)
    const ticksAtCancel = ticks.length
    cancel()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(done).toBe(false)
    expect(ticks.length).toBe(ticksAtCancel)
  })
})
