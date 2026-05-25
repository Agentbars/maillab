import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

const mockPrisma = {
  user: { findUnique: vi.fn() },
  message: { create: vi.fn(), update: vi.fn() },
}
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const mockGetServerSession = vi.fn()
vi.mock('next-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth')>()
  return { ...actual, getServerSession: mockGetServerSession }
})

const mockMkdir = vi.fn()
const mockWriteFile = vi.fn()
vi.mock('fs/promises', () => ({
  default: { mkdir: mockMkdir, writeFile: mockWriteFile },
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}))

const { POST } = await import('@/app/api/messages/route')

const SESSION = { user: { id: 'sender-id', email: 'alice@maillab.local' } }
const RECIPIENT = { id: 'recipient-id', email: 'bob@maillab.local' }

function makeRequest(fields: Record<string, string>, file?: { name: string; bytes: Uint8Array }) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  if (file) {
    form.append('attachment', new File([file.bytes.buffer as ArrayBuffer], file.name, { type: 'application/octet-stream' }))
  }
  return new Request('http://localhost/api/messages', { method: 'POST', body: form })
}

describe('POST /api/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makeRequest({ to: 'bob@maillab.local', subject: 'Hi', body: '' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 on missing subject', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await POST(makeRequest({ to: 'bob@maillab.local', subject: '', body: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json).toMatchObject({ field: 'subject' })
  })

  it('returns 400 on invalid to address', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await POST(makeRequest({ to: 'bob@gmail.com', subject: 'Hi', body: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json).toMatchObject({ field: 'to' })
  })

  it('returns 400 on too-large attachment (> 50 KB)', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await POST(makeRequest(
      { to: 'bob@maillab.local', subject: 'Hi', body: '' },
      { name: 'big.bin', bytes: new Uint8Array(50 * 1024 + 1) },
    ))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json).toMatchObject({ field: 'attachment' })
  })

  it('accepts attachment exactly at 50 KB boundary', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'recipient-1', email: 'bob@maillab.local' })
    mockPrisma.message.create.mockResolvedValue({ id: 'msg-1', createdAt: new Date() })
    mockPrisma.message.update.mockResolvedValue({})

    const res = await POST(makeRequest(
      { to: 'bob@maillab.local', subject: 'Hi', body: '' },
      { name: 'edge.bin', bytes: new Uint8Array(50 * 1024) },
    ))
    expect(res.status).toBe(201)
  })

  it('returns 404 on unknown recipient', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const res = await POST(makeRequest({ to: 'nobody@maillab.local', subject: 'Hi', body: '' }))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json).toMatchObject({ error: 'recipient_not_found' })
  })

  it('returns 201 on valid send to self — one row created', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'sender-id', email: 'alice@maillab.local' })
    mockPrisma.message.create.mockResolvedValue({ id: 'msg-1', createdAt: new Date('2026-01-01T00:00:00Z') })

    const res = await POST(makeRequest({ to: 'alice@maillab.local', subject: 'Self', body: 'hello' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toMatchObject({ id: 'msg-1' })
    expect(mockPrisma.message.create).toHaveBeenCalledOnce()
  })

  it('returns 201 on send to another user — row created with correct from/to', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(RECIPIENT)
    mockPrisma.message.create.mockResolvedValue({ id: 'msg-2', createdAt: new Date('2026-01-01T00:00:00Z') })

    const res = await POST(makeRequest({ to: 'bob@maillab.local', subject: 'Hey', body: 'world' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toMatchObject({ id: 'msg-2' })

    const createCall = mockPrisma.message.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createCall.data).toMatchObject({
      fromEmail: 'alice@maillab.local',
      toEmail: 'bob@maillab.local',
      subject: 'Hey',
    })
  })

  it('sets deliveredAt to 2–5 seconds after creation time', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(RECIPIENT)

    vi.useFakeTimers()
    const now = new Date('2026-03-01T10:00:00Z')
    vi.setSystemTime(now)
    mockPrisma.message.create.mockResolvedValue({ id: 'msg-d', createdAt: now })

    await POST(makeRequest({ to: 'bob@maillab.local', subject: 'Delayed', body: '' }))

    const createCall = mockPrisma.message.create.mock.calls[0][0] as { data: Record<string, unknown> }
    const deliveredAt = createCall.data.deliveredAt as Date
    expect(deliveredAt).toBeInstanceOf(Date)
    const delayMs = deliveredAt.getTime() - now.getTime()
    expect(delayMs).toBeGreaterThanOrEqual(2000)
    expect(delayMs).toBeLessThanOrEqual(5000)

    vi.useRealTimers()
  })

  it('saves attachment to disk and sets hasAttachment on row', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(RECIPIENT)
    mockPrisma.message.create.mockResolvedValue({ id: 'msg-3', createdAt: new Date('2026-01-01T00:00:00Z') })
    mockPrisma.message.update.mockResolvedValue({})

    const res = await POST(makeRequest(
      { to: 'bob@maillab.local', subject: 'Attached', body: '' },
      { name: 'report.txt', bytes: new TextEncoder().encode('data') },
    ))
    expect(res.status).toBe(201)
    expect(mockWriteFile).toHaveBeenCalledOnce()

    const [writePath] = mockWriteFile.mock.calls[0] as [string, ...unknown[]]
    expect(writePath).toContain(path.join('storage', 'messages'))
    expect(writePath).toContain('report.txt')

    const createCall = mockPrisma.message.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createCall.data).toMatchObject({ hasAttachment: true, attachmentFilename: 'report.txt' })
  })
})
