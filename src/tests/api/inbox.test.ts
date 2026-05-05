import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  message: { findMany: vi.fn(), findFirst: vi.fn() },
}
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const mockGetServerSession = vi.fn()
vi.mock('next-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth')>()
  return { ...actual, getServerSession: mockGetServerSession }
})

const { GET: inboxGET } = await import('@/app/api/inbox/route')
const { GET: messageGET } = await import('@/app/api/messages/[id]/route')

const SESSION = { user: { id: 'user-1', email: 'alice@maillab.local' } }

const MSG_FULL = {
  id: 'msg-1',
  fromEmail: 'bob@maillab.local',
  toEmail: 'alice@maillab.local',
  subject: 'Hello',
  body: 'World',
  hasAttachment: true,
  attachmentFilename: 'file.txt',
  attachmentSizeBytes: 42,
  createdAt: new Date('2026-01-02T00:00:00Z'),
}
const MSG_NO_ATTACH = {
  id: 'msg-2',
  fromEmail: 'bob@maillab.local',
  toEmail: 'alice@maillab.local',
  subject: 'Hey',
  body: '',
  hasAttachment: false,
  attachmentFilename: null,
  attachmentSizeBytes: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

function makeInboxRequest(since?: string) {
  const url = since
    ? `http://localhost/api/inbox?since=${encodeURIComponent(since)}`
    : 'http://localhost/api/inbox'
  return new Request(url)
}

function makeMessageRequest(id: string) {
  return new Request(`http://localhost/api/messages/${id}`)
}

describe('GET /api/inbox', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await inboxGET(makeInboxRequest())
    expect(res.status).toBe(401)
  })

  it('returns 200 with empty array when inbox is empty', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findMany.mockResolvedValue([])
    const res = await inboxGET(makeInboxRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns messages ordered newest first', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findMany.mockResolvedValue([MSG_FULL, MSG_NO_ATTACH])
    const res = await inboxGET(makeInboxRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string }[]
    expect(body[0].id).toBe('msg-1')
    expect(body[1].id).toBe('msg-2')
  })

  it('returns only id, from, subject, createdAt, hasAttachment fields', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findMany.mockResolvedValue([MSG_FULL])
    const res = await inboxGET(makeInboxRequest())
    const [msg] = await res.json() as Record<string, unknown>[]
    expect(msg).toMatchObject({
      id: 'msg-1',
      from: 'bob@maillab.local',
      subject: 'Hello',
      hasAttachment: true,
    })
    expect(msg).not.toHaveProperty('body')
    expect(msg).not.toHaveProperty('toEmail')
  })

  it('filters by since param — only messages newer than timestamp', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findMany.mockResolvedValue([MSG_FULL])

    const res = await inboxGET(makeInboxRequest('2026-01-01T12:00:00Z'))
    expect(res.status).toBe(200)

    const call = mockPrisma.message.findMany.mock.calls[0][0] as {
      where: { createdAt?: { gt: Date } }
    }
    expect(call.where.createdAt?.gt).toBeInstanceOf(Date)
    expect(call.where.createdAt?.gt.toISOString()).toBe('2026-01-01T12:00:00.000Z')
  })
})

describe('GET /api/messages/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await messageGET(makeMessageRequest('msg-1'), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when message belongs to another user', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(null)
    const res = await messageGET(makeMessageRequest('msg-1'), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with full message fields including attachment', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(MSG_FULL)
    const res = await messageGET(makeMessageRequest('msg-1'), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body).toMatchObject({
      id: 'msg-1',
      from: 'bob@maillab.local',
      to: 'alice@maillab.local',
      subject: 'Hello',
      body: 'World',
    })
    expect(body.attachment).toMatchObject({ filename: 'file.txt', sizeBytes: 42 })
  })

  it('returns attachment: null when message has no attachment', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(MSG_NO_ATTACH)
    const res = await messageGET(makeMessageRequest('msg-2'), { params: Promise.resolve({ id: 'msg-2' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.attachment).toBeNull()
  })
})
