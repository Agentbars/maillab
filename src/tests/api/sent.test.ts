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

const { GET: sentGET } = await import('@/app/api/sent/route')
const { GET: messageGET } = await import('@/app/api/messages/[id]/route')

const SESSION = { user: { id: 'user-1', email: 'alice@maillab.local' } }

const SENT_MSG = {
  id: 'msg-1',
  fromEmail: 'alice@maillab.local',
  toEmail: 'bob@maillab.local',
  subject: 'Hello Bob',
  body: 'Hi there',
  hasAttachment: false,
  attachmentFilename: null,
  attachmentSizeBytes: null,
  createdAt: new Date('2026-01-02T10:00:00Z'),
}

function makeGet(url: string) {
  return new Request(url)
}

describe('GET /api/sent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await sentGET(makeGet('http://localhost/api/sent'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with empty array when nothing sent', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findMany.mockResolvedValue([])
    const res = await sentGET(makeGet('http://localhost/api/sent'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns sent messages with to/subject/createdAt/hasAttachment fields', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findMany.mockResolvedValue([SENT_MSG])
    const res = await sentGET(makeGet('http://localhost/api/sent'))
    const [msg] = await res.json() as Record<string, unknown>[]
    expect(msg).toMatchObject({
      id: 'msg-1',
      to: 'bob@maillab.local',
      subject: 'Hello Bob',
      hasAttachment: false,
    })
    expect(msg).not.toHaveProperty('from')
    expect(msg).not.toHaveProperty('body')
  })

  it('queries only messages from the current user', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findMany.mockResolvedValue([])
    await sentGET(makeGet('http://localhost/api/sent'))
    const { where } = mockPrisma.message.findMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where.fromEmail).toBe('alice@maillab.local')
  })

  it('returns messages ordered newest first', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const older = { ...SENT_MSG, id: 'msg-2', createdAt: new Date('2026-01-01T00:00:00Z') }
    mockPrisma.message.findMany.mockResolvedValue([SENT_MSG, older])
    const res = await sentGET(makeGet('http://localhost/api/sent'))
    const body = await res.json() as { id: string }[]
    expect(body[0].id).toBe('msg-1')
  })
})

describe('GET /api/messages/:id — sender access', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 when the sender views their own sent message', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(SENT_MSG)
    const res = await messageGET(
      makeGet('http://localhost/api/messages/msg-1'),
      { params: Promise.resolve({ id: 'msg-1' }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body).toMatchObject({ id: 'msg-1', from: 'alice@maillab.local', to: 'bob@maillab.local' })
  })
})
