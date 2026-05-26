import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  user: { findUnique: vi.fn(), update: vi.fn() },
}
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const mockGetServerSession = vi.fn()
vi.mock('next-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth')>()
  return { ...actual, getServerSession: mockGetServerSession }
})

const { GET, PUT } = await import('@/app/api/profile/route')

const SESSION = { user: { id: 'user-1', email: 'john@maillab.local' } }

const FULL_USER = {
  id: 'user-1',
  email: 'john@maillab.local',
  displayName: 'John Smith',
  phone: '+15551234567',
  signature: 'Sent from MailLab',
  timeZone: 'Europe/Moscow',
  notifications: 'important_only',
}

function makePut(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// NOTE: VALID_BODY intentionally uses an empty phone — Bug #2 mangles every
// non-empty phone (drops the leading `+`), so it cannot appear in a "clean"
// happy-path assertion. The bug-specific test below covers non-empty phone.
const VALID_BODY = {
  displayName: 'Jane Doe',
  phone: '',
  signature: 'hi',
  timeZone: 'UTC',
  notifications: 'all',
}

describe('GET /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' })
  })

  it('returns the user profile shape on 200', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(FULL_USER)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      displayName: 'John Smith',
      email: 'john@maillab.local',
      phone: '+15551234567',
      signature: 'Sent from MailLab',
      timeZone: 'Europe/Moscow',
      notifications: 'important_only',
    })
  })

  it('returns null phone/signature unchanged', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.user.findUnique.mockResolvedValue({
      ...FULL_USER,
      phone: null,
      signature: null,
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.phone).toBeNull()
    expect(json.signature).toBeNull()
  })
})

describe('PUT /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...FULL_USER,
      ...data,
    }))
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await PUT(makePut(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 200 and updated profile on valid body', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await PUT(makePut(VALID_BODY))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({
      displayName: 'Jane Doe',
      email: 'john@maillab.local',
      phone: null,
      timeZone: 'UTC',
      notifications: 'all',
    })
  })

  it('rejects empty displayName with "must not be empty"', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await PUT(makePut({ ...VALID_BODY, displayName: '   ' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.errors).toEqual({ displayName: 'must not be empty' })
  })

  it('rejects displayName > 50 chars with "max 50 characters"', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await PUT(makePut({ ...VALID_BODY, displayName: 'A'.repeat(51) }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.errors).toEqual({ displayName: 'max 50 characters' })
  })

  it('rejects unknown timeZone with "unknown time zone"', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await PUT(makePut({ ...VALID_BODY, timeZone: 'Atlantis/Capital' }))
    expect(res.status).toBe(400)
    expect((await res.json()).errors).toEqual({ timeZone: 'unknown time zone' })
  })

  it('accepts all required timeZone options', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const zones = ['UTC', 'Europe/Moscow', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Dubai']
    for (const tz of zones) {
      const res = await PUT(makePut({ ...VALID_BODY, timeZone: tz }))
      expect(res.status, `timezone ${tz}`).toBe(200)
    }
  })

  it('rejects unknown notifications with "invalid notification preference"', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await PUT(makePut({ ...VALID_BODY, notifications: 'sometimes' }))
    expect(res.status).toBe(400)
    expect((await res.json()).errors).toEqual({ notifications: 'invalid notification preference' })
  })

  it('accepts each of all/important_only/off for notifications', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    for (const v of ['all', 'important_only', 'off']) {
      const res = await PUT(makePut({ ...VALID_BODY, notifications: v }))
      expect(res.status, `notifications ${v}`).toBe(200)
    }
  })

  it('rejects phone that does not match /^\\+\\d{7,15}$/ with phone error', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await PUT(makePut({ ...VALID_BODY, phone: '12345' }))
    expect(res.status).toBe(400)
    expect((await res.json()).errors).toEqual({ phone: 'must start with + and a country code' })
  })

  it('accepts empty phone (optional field)', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await PUT(makePut({ ...VALID_BODY, phone: '' }))
    expect(res.status).toBe(200)
  })

  it('accepts long signature exactly at 500 chars', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await PUT(makePut({ ...VALID_BODY, signature: 'A'.repeat(500) }))
    expect(res.status).toBe(200)
  })

  // ---- Intentional bugs locked in by tests (see specs/08-profile.md §4 & §6) ----

  it('BUG #1: displayName with leading+trailing whitespace stores leading whitespace (trimEnd only)', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await PUT(makePut({ ...VALID_BODY, displayName: '  John  ' }))
    expect(res.status).toBe(200)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayName: '  John' }) }),
    )
  })

  it('BUG #2: phone "+1-555-1234567" succeeds with stored value "15551234567" (no +)', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await PUT(makePut({ ...VALID_BODY, phone: '+1-555-1234567' }))
    expect(res.status).toBe(200)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: '15551234567' }) }),
    )
  })

  it('BUG #3: signature length 501 is accepted; 502 is rejected', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res501 = await PUT(makePut({ ...VALID_BODY, signature: 'A'.repeat(501) }))
    expect(res501.status).toBe(200)
    const res502 = await PUT(makePut({ ...VALID_BODY, signature: 'A'.repeat(502) }))
    expect(res502.status).toBe(400)
    expect((await res502.json()).errors).toEqual({ signature: 'max 500 characters' })
  })

  it('does not allow updating email via PUT (email is read-only)', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    await PUT(makePut({ ...VALID_BODY, email: 'attacker@maillab.local' } as unknown as Record<string, unknown>))
    const updateCall = mockPrisma.user.update.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCall?.data).not.toHaveProperty('email')
  })
})
