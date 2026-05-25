const MIN_MS = 3_000
const MAX_MS = 4_000
const TICK_MS = 100

interface Options {
  onTick: (progress: number) => void
  onDone: () => void
}

export function simulateUploadProgress({ onTick, onDone }: Options): () => void {
  const totalMs = Math.floor(Math.random() * (MAX_MS - MIN_MS)) + MIN_MS
  const start = Date.now()
  let cancelled = false

  const interval = setInterval(() => {
    if (cancelled) return
    const elapsed = Date.now() - start
    if (elapsed >= totalMs) {
      clearInterval(interval)
      onTick(100)
      onDone()
      return
    }
    onTick(Math.min(99, Math.floor((elapsed / totalMs) * 100)))
  }, TICK_MS)

  return () => {
    cancelled = true
    clearInterval(interval)
  }
}
