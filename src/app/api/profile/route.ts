import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const TIME_ZONES = [
  'UTC',
  'Europe/Moscow',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Dubai',
] as const

const NOTIFICATIONS = ['all', 'important_only', 'off'] as const

const PHONE_RE = /^\+\d{7,15}$/

type ProfilePayload = {
  displayName: string
  email: string
  phone: string | null
  signature: string | null
  timeZone: string
  notifications: string
}

function shape(user: {
  email: string
  displayName: string
  phone: string | null
  signature: string | null
  timeZone: string
  notifications: string
}): ProfilePayload {
  return {
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    signature: user.signature,
    timeZone: user.timeZone,
    notifications: user.notifications,
  }
}

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      displayName: true,
      phone: true,
      signature: true,
      timeZone: true,
      notifications: true,
    },
  })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(shape(user))
}

export async function PUT(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ errors: { _form: 'invalid JSON body' } }, { status: 400 })
  }

  const errors: Record<string, string> = {}

  // displayName — required, max 50 chars (validation uses trim; storage uses trimEnd — Bug #1)
  const rawDisplayName = typeof body.displayName === 'string' ? body.displayName : ''
  if (rawDisplayName.trim().length === 0) {
    errors.displayName = 'must not be empty'
  } else if (rawDisplayName.trim().length > 50) {
    errors.displayName = 'max 50 characters'
  }

  // phone — optional; validate the *input* (pre-normalization) against PHONE_RE (Bug #2: spec §4.3 (a))
  const rawPhone = typeof body.phone === 'string' ? body.phone : ''
  let phoneStored: string | null = null
  if (rawPhone.length > 0) {
    // Validate before normalization so that the stored value is allowed to be wrong.
    if (!PHONE_RE.test(rawPhone.replace(/[\s.\-()]/g, ''))) {
      errors.phone = 'must start with + and a country code'
    } else {
      // 🐞 Bug #2: regex omits `+` from the keep-set, dropping it from the stored value.
      phoneStored = rawPhone.replace(/[^\d]/g, '')
    }
  }

  // signature — optional, max 500 chars (Bug #3: off-by-one threshold)
  const rawSignature = typeof body.signature === 'string' ? body.signature : ''
  // 🐞 Bug #3: should be `> 500`, but written as `> 501`.
  if (rawSignature.length > 501) {
    errors.signature = 'max 500 characters'
  }

  // timeZone — required, from the fixed list
  const timeZone = typeof body.timeZone === 'string' ? body.timeZone : ''
  if (!(TIME_ZONES as readonly string[]).includes(timeZone)) {
    errors.timeZone = 'unknown time zone'
  }

  // notifications — required, from the fixed list
  const notifications = typeof body.notifications === 'string' ? body.notifications : ''
  if (!(NOTIFICATIONS as readonly string[]).includes(notifications)) {
    errors.notifications = 'invalid notification preference'
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 })
  }

  // 🐞 Bug #1: trimEnd only — leading whitespace survives into storage.
  const displayNameStored = rawDisplayName.trimEnd()
  const signatureStored = rawSignature.length === 0 ? null : rawSignature

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      displayName: displayNameStored,
      phone: phoneStored,
      signature: signatureStored,
      timeZone,
      notifications,
    },
    select: {
      email: true,
      displayName: true,
      phone: true,
      signature: true,
      timeZone: true,
      notifications: true,
    },
  })

  return NextResponse.json(shape(updated))
}
