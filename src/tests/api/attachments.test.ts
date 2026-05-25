import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

const mockPrisma = {
  message: { findFirst: vi.fn() },
  folder: { findFirst: vi.fn() },
  diskFile: { create: vi.fn(), aggregate: vi.fn() },
}
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const mockGetServerSession = vi.fn()
vi.mock('next-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth')>()
  return { ...actual, getServerSession: mockGetServerSession }
})

const mockReadFile = vi.fn()
const mockMkdir = vi.fn()
const mockCopyFile = vi.fn()
const mockAccess = vi.fn()
vi.mock('fs/promises', () => ({
  default: { readFile: mockReadFile, mkdir: mockMkdir, copyFile: mockCopyFile, access: mockAccess },
  readFile: mockReadFile,
  mkdir: mockMkdir,
  copyFile: mockCopyFile,
  access: mockAccess,
}))

const { GET: downloadGET } = await import('@/app/api/messages/[id]/attachment/route')
const { POST: saveToDiskPOST } = await import('@/app/api/messages/[id]/save-to-disk/route')

const SESSION = { user: { id: 'user-1', email: 'alice@maillab.local' } }

const MSG_WITH_ATTACH = {
  id: 'msg-1',
  toEmail: 'alice@maillab.local',
  hasAttachment: true,
  attachmentFilename: 'report.txt',
  attachmentSizeBytes: 11,
  storagePath: path.join('storage', 'messages', 'msg-1', 'report.txt'),
}

const MSG_NO_ATTACH = {
  id: 'msg-2',
  toEmail: 'alice@maillab.local',
  hasAttachment: false,
  attachmentFilename: null,
  attachmentSizeBytes: null,
  storagePath: null,
}

const FOLDER = { id: 'folder-1', userId: 'user-1' }

function makeDownloadRequest(id: string) {
  return new Request(`http://localhost/api/messages/${id}/attachment`)
}

function makeSaveRequest(id: string, body: object) {
  return new Request(`http://localhost/api/messages/${id}/save-to-disk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/messages/:id/attachment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await downloadGET(makeDownloadRequest('msg-1'), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when message belongs to another user', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(null)
    const res = await downloadGET(makeDownloadRequest('msg-1'), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 404 when message has no attachment', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(MSG_NO_ATTACH)
    const res = await downloadGET(makeDownloadRequest('msg-2'), { params: Promise.resolve({ id: 'msg-2' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with file bytes and correct headers', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(MSG_WITH_ATTACH)
    mockReadFile.mockResolvedValue(Buffer.from('hello world'))

    const res = await downloadGET(makeDownloadRequest('msg-1'), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('report.txt')
    const bytes = await res.arrayBuffer()
    expect(Buffer.from(bytes).toString()).toBe('hello world')
  })
})

describe('POST /api/messages/:id/save-to-disk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMkdir.mockResolvedValue(undefined)
    mockCopyFile.mockResolvedValue(undefined)
    mockAccess.mockResolvedValue(undefined)
    mockPrisma.diskFile.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0 } })
  })

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await saveToDiskPOST(makeSaveRequest('msg-1', { folderId: 'folder-1' }), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when message not found or not recipient', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(null)
    const res = await saveToDiskPOST(makeSaveRequest('msg-1', { folderId: 'folder-1' }), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when message has no attachment', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(MSG_NO_ATTACH)
    const res = await saveToDiskPOST(makeSaveRequest('msg-2', { folderId: 'folder-1' }), { params: Promise.resolve({ id: 'msg-2' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'no_attachment' })
  })

  it('returns 404 when folderId belongs to another user', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(MSG_WITH_ATTACH)
    mockPrisma.folder.findFirst.mockResolvedValue(null)
    const res = await saveToDiskPOST(makeSaveRequest('msg-1', { folderId: 'other-folder' }), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 201 and creates DiskFile row and copies file', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(MSG_WITH_ATTACH)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER)
    mockPrisma.diskFile.create.mockResolvedValue({ id: 'file-1', name: 'report.txt', folderId: 'folder-1' })
    // No collision: first access throws (file doesn't exist)
    mockAccess.mockRejectedValue(new Error('ENOENT'))

    const res = await saveToDiskPOST(makeSaveRequest('msg-1', { folderId: 'folder-1' }), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(201)
    const body = await res.json() as Record<string, unknown>
    expect(body).toMatchObject({ fileId: 'file-1', name: 'report.txt', folderId: 'folder-1' })
    expect(mockCopyFile).toHaveBeenCalledOnce()

    const [src, dest] = mockCopyFile.mock.calls[0] as [string, string]
    expect(src).toContain(path.join('storage', 'messages'))
    expect(dest).toContain(path.join('storage', 'disk'))
  })

  it('returns 507 storage_full when new file would exceed account quota', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(MSG_WITH_ATTACH)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER)
    mockAccess.mockRejectedValue(new Error('ENOENT'))
    // MSG_WITH_ATTACH is 11 bytes; user already has 255_990 bytes → 255_990 + 11 = 256_001 > 256_000
    mockPrisma.diskFile.aggregate.mockResolvedValue({ _sum: { sizeBytes: 255_990 } })
    mockPrisma.diskFile.create.mockResolvedValue({ id: 'file-x', name: 'report.txt', folderId: 'folder-1' })

    const res = await saveToDiskPOST(makeSaveRequest('msg-1', { folderId: 'folder-1' }), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(507)
    const body = await res.json() as Record<string, unknown>
    expect(body).toMatchObject({ error: 'storage_full' })
    // Quota number must NOT be leaked in the response
    expect(JSON.stringify(body)).not.toMatch(/250|256000|0\.25/)
    expect(mockPrisma.diskFile.create).not.toHaveBeenCalled()
    expect(mockCopyFile).not.toHaveBeenCalled()
  })

  it('allows save when total stays exactly at quota boundary', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(MSG_WITH_ATTACH)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER)
    mockAccess.mockRejectedValue(new Error('ENOENT'))
    // 255_989 + 11 = 256_000 (exactly the cap)
    mockPrisma.diskFile.aggregate.mockResolvedValue({ _sum: { sizeBytes: 255_989 } })
    mockPrisma.diskFile.create.mockResolvedValue({ id: 'file-edge', name: 'report.txt', folderId: 'folder-1' })

    const res = await saveToDiskPOST(makeSaveRequest('msg-1', { folderId: 'folder-1' }), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(201)
  })

  it('deduplicates filename on collision', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.message.findFirst.mockResolvedValue(MSG_WITH_ATTACH)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER)
    mockPrisma.diskFile.create.mockResolvedValue({ id: 'file-2', name: 'report_1.txt', folderId: 'folder-1' })
    // First check: file exists (collision), second check: no collision
    mockAccess
      .mockResolvedValueOnce(undefined)   // report.txt exists
      .mockRejectedValueOnce(new Error('ENOENT')) // report_1.txt free

    const res = await saveToDiskPOST(makeSaveRequest('msg-1', { folderId: 'folder-1' }), { params: Promise.resolve({ id: 'msg-1' }) })
    expect(res.status).toBe(201)
    const body = await res.json() as Record<string, unknown>
    expect(body.name).toBe('report_1.txt')

    const [, dest] = mockCopyFile.mock.calls[0] as [string, string]
    expect(dest).toContain('report_1.txt')
  })
})
