import { NextResponse } from 'next/server'
import {
  pickHealthBehavior,
  SLOW_DELAY_MIN_MS,
  SLOW_DELAY_MAX_MS,
} from '@/lib/health'

// INTENTIONAL FLAKY BEHAVIOR — this endpoint is the substrate for the AQA
// Course "TestResults analyzation" task. The 15% slow / 5% 503 distribution
// is by design and must NOT be "fixed". See specs/10-health.md.

const VERSION = '1.0.0'
const SERVER_START_MS = Date.now()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET(): Promise<NextResponse> {
  const behavior = pickHealthBehavior(Math.random())

  if (behavior === 'fast503') {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  if (behavior === 'slow200') {
    const span = SLOW_DELAY_MAX_MS - SLOW_DELAY_MIN_MS
    const delay = SLOW_DELAY_MIN_MS + Math.random() * span
    await sleep(delay)
  }

  return NextResponse.json({
    status: 'ok',
    uptime: Date.now() - SERVER_START_MS,
    version: VERSION,
  })
}
