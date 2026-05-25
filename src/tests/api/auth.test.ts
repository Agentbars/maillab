import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  folder: {
    createMany: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const mockBcrypt = {
  hash: vi.fn(),
  compare: vi.fn(),
}
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

const mockGetServerSession = vi.fn()
vi.mock('next-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth')>()
  return { ...actual, getServerSession: mockGetServerSession }
})

const { POST: registerPOST } = await import('@/app/api/auth/register/route')
const { GET: meGET } = await import('@/app/api/auth/me/route')
const { authorizeCredentials } = await import('@/lib/auth')

function makeRegisterRequest(body: object) {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeMeRequest() {
  return new Request('http://localhost/api/auth/me', { method: 'GET' })
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 on invalid email format (not @maillab.local)', async () => {
    const res = await registerPOST(makeRegisterRequest({
      email: 'alice@gmail.com',
      password: 'password123',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toMatchObject({ field: 'email' })
  })

  it('returns 400 on password too short (< 8 chars)', async () => {
    const res = await registerPOST(makeRegisterRequest({
      email: 'alice@maillab.local',
      password: 'short',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toMatchObject({ field: 'password' })
  })

  it('returns 409 on duplicate email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-id', email: 'alice@maillab.local' })
    mockBcrypt.hash.mockResolvedValue('hashed-password')

    const res = await registerPOST(makeRegisterRequest({
      email: 'alice@maillab.local',
      password: 'password123',
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'email_taken' })
  })

  it('returns 201 and creates user + 4 root folders on valid registration', async () => {
    mockBcrypt.hash.mockResolvedValue('hashed-password')
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 'new-user-id', email: 'alice@maillab.local' })
    mockPrisma.folder.createMany.mockResolvedValue({ count: 4 })

    const res = await registerPOST(makeRegisterRequest({
      email: 'alice@maillab.local',
      password: 'password123',
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ id: 'new-user-id', email: 'alice@maillab.local' })

    expect(mockPrisma.folder.createMany).toHaveBeenCalledOnce()
    const call = mockPrisma.folder.createMany.mock.calls[0][0] as { data: { name: string }[] }
    expect(call.data).toHaveLength(4)
    const names = call.data.map((f) => f.name)
    expect(names).toContain('Inbox attachments')
    expect(names).toContain('Long-term')
    expect(names).toContain('Other')
    expect(names).toContain('Trash')
  })
})

describe('NextAuth credentials authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns null on wrong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid', email: 'alice@maillab.local', passwordHash: 'hashed' })
    mockBcrypt.compare.mockResolvedValue(false)

    const promise = authorizeCredentials({ email: 'alice@maillab.local', password: 'wrongpassword' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await promise).toBeNull()
  })

  it('returns user object on correct credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid', email: 'alice@maillab.local', passwordHash: 'hashed' })
    mockBcrypt.compare.mockResolvedValue(true)

    const promise = authorizeCredentials({ email: 'alice@maillab.local', password: 'correctpassword' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await promise).toMatchObject({ id: 'uid', email: 'alice@maillab.local' })
  })

  it('waits at least 5 seconds even when user does not exist', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const promise = authorizeCredentials({ email: 'ghost@maillab.local', password: 'x' })
    let settled = false
    promise.then(() => { settled = true })

    await vi.advanceTimersByTimeAsync(4_999)
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(await promise).toBeNull()
  })

  it('waits at least 5 seconds on successful login', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid', email: 'alice@maillab.local', passwordHash: 'hashed' })
    mockBcrypt.compare.mockResolvedValue(true)

    const promise = authorizeCredentials({ email: 'alice@maillab.local', password: 'correctpassword' })
    let settled = false
    promise.then(() => { settled = true })

    await vi.advanceTimersByTimeAsync(4_999)
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(await promise).toMatchObject({ id: 'uid' })
  })

  it('resolves within 10 seconds at the upper bound', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999999)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid', email: 'alice@maillab.local', passwordHash: 'hashed' })
    mockBcrypt.compare.mockResolvedValue(true)

    const promise = authorizeCredentials({ email: 'alice@maillab.local', password: 'correctpassword' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await promise).not.toBeNull()
  })
})

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without session', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await meGET(makeMeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 200 with user data when session exists', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'uid', email: 'alice@maillab.local' } })
    const res = await meGET(makeMeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ id: 'uid', email: 'alice@maillab.local' })
  })
})
