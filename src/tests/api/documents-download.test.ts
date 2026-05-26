import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  diskFile: { findUnique: vi.fn() },
}
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const mockGetServerSession = vi.fn()
vi.mock('next-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth')>()
  return { ...actual, getServerSession: mockGetServerSession }
})

const mockReadFile = vi.fn()
vi.mock('fs/promises', () => ({
  default: { readFile: mockReadFile },
  readFile: mockReadFile,
}))

const { GET } = await import('@/app/api/documents/[id]/download/route')

const SESSION = { user: { id: 'owner-1', email: 'owner@maillab.local' } }

function call(id: string) {
  return GET(new Request(`http://localhost/api/documents/${id}/download`), {
    params: Promise.resolve({ id }),
  })
}

const OWNED_FILE = {
  id: 'file-1',
  name: 'report.pdf',
  userId: 'owner-1',
  storagePath: 'storage/disk/owner-1/report.pdf',
  sizeBytes: 12,
  deletedAt: null,
}

describe('GET /api/documents/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await call('file-1')
    expect(res.status).toBe(401)
  })

  it('returns 404 when document does not exist', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findUnique.mockResolvedValue(null)
    const res = await call('missing')
    expect(res.status).toBe(404)
  })

  it('returns 403 when document belongs to a different user', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findUnique.mockResolvedValue({
      ...OWNED_FILE,
      userId: 'someone-else',
    })
    const res = await call('file-1')
    expect(res.status).toBe(403)
  })

  it('returns 404 when document is in trash (deletedAt set)', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findUnique.mockResolvedValue({
      ...OWNED_FILE,
      deletedAt: new Date(),
    })
    const res = await call('file-1')
    expect(res.status).toBe(404)
  })

  it('returns 500 when reading the file throws', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findUnique.mockResolvedValue(OWNED_FILE)
    mockReadFile.mockRejectedValue(new Error('disk on fire'))
    const res = await call('file-1')
    expect(res.status).toBe(500)
  })

  it('returns 200 with file body and Content-Disposition on success', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findUnique.mockResolvedValue(OWNED_FILE)
    mockReadFile.mockResolvedValue(Buffer.from('hello-bytes!'))
    const res = await call('file-1')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="report.pdf"',
    )
    expect(res.headers.get('Content-Type')).toBeTruthy()
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.toString()).toBe('hello-bytes!')
  })
})
