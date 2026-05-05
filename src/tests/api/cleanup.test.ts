import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockPrisma = {
  diskFile: {
    findMany: vi.fn(),
    delete: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const mockUnlink = vi.fn()
vi.mock('fs/promises', () => ({ unlink: mockUnlink }))

const { POST: cleanupPOST } = await import('@/app/api/internal/cleanup/route')

const SECRET = 'test-secret-that-is-at-least-32-chars!'

function makePost(secret?: string) {
  return new Request('http://localhost/api/internal/cleanup', {
    method: 'POST',
    headers: secret ? { 'X-Internal-Secret': secret } : {},
  })
}

describe('POST /api/internal/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLEANUP_SECRET = SECRET
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 401 with missing secret', async () => {
    const res = await cleanupPOST(makePost())
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong secret', async () => {
    const res = await cleanupPOST(makePost('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with {deleted: 0} when no files qualify', async () => {
    mockPrisma.diskFile.findMany.mockResolvedValue([])
    const res = await cleanupPOST(makePost(SECRET))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: 0 })
  })

  it('uses cutoff of exactly now-48h (boundary: lt, not lte)', async () => {
    vi.useFakeTimers()
    const now = new Date('2024-01-03T12:00:00.000Z')
    vi.setSystemTime(now)
    mockPrisma.diskFile.findMany.mockResolvedValue([])

    await cleanupPOST(makePost(SECRET))

    const { where } = mockPrisma.diskFile.findMany.mock.calls[0][0]
    const cutoff = where.deletedAt.lt as Date
    const expected = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    expect(cutoff.getTime()).toBe(expected.getTime())
  })

  it('deletes expired file: removes physical file and DB row', async () => {
    const file = { id: 'df-old', storagePath: 'storage/disk/user-1/f-long/old.pdf' }
    mockPrisma.diskFile.findMany.mockResolvedValue([file])
    mockUnlink.mockResolvedValue(undefined)
    mockPrisma.diskFile.delete.mockResolvedValue({})

    const res = await cleanupPOST(makePost(SECRET))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: 1 })
    expect(mockUnlink).toHaveBeenCalledWith(file.storagePath)
    expect(mockPrisma.diskFile.delete).toHaveBeenCalledWith({ where: { id: file.id } })
  })

  it('ignores ENOENT when physical file is already gone', async () => {
    const file = { id: 'df-gone', storagePath: 'storage/disk/user-1/f/gone.pdf' }
    mockPrisma.diskFile.findMany.mockResolvedValue([file])
    mockUnlink.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    mockPrisma.diskFile.delete.mockResolvedValue({})

    const res = await cleanupPOST(makePost(SECRET))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: 1 })
    expect(mockPrisma.diskFile.delete).toHaveBeenCalledWith({ where: { id: file.id } })
  })

  it('does not touch files with deletedAt = null (not in trash)', async () => {
    mockPrisma.diskFile.findMany.mockResolvedValue([])
    await cleanupPOST(makePost(SECRET))

    const { where } = mockPrisma.diskFile.findMany.mock.calls[0][0]
    expect(where.deletedAt).toBeDefined()
    expect(where.deletedAt.not).toBe(null)
  })

  it('cleans up expired trash for all users (no userId scoping)', async () => {
    const files = [
      { id: 'df-u1', storagePath: 'storage/disk/user-1/f/file.pdf' },
      { id: 'df-u2', storagePath: 'storage/disk/user-2/f/file.pdf' },
    ]
    mockPrisma.diskFile.findMany.mockResolvedValue(files)
    mockUnlink.mockResolvedValue(undefined)
    mockPrisma.diskFile.delete.mockResolvedValue({})

    const res = await cleanupPOST(makePost(SECRET))
    expect(await res.json()).toEqual({ deleted: 2 })
    const { where } = mockPrisma.diskFile.findMany.mock.calls[0][0]
    expect(where).not.toHaveProperty('userId')
  })

  it('returns correct count when multiple files are cleaned up', async () => {
    const files = [
      { id: 'df-1', storagePath: 'storage/disk/u/f/a.pdf' },
      { id: 'df-2', storagePath: 'storage/disk/u/f/b.pdf' },
      { id: 'df-3', storagePath: 'storage/disk/u/f/c.pdf' },
    ]
    mockPrisma.diskFile.findMany.mockResolvedValue(files)
    mockUnlink.mockResolvedValue(undefined)
    mockPrisma.diskFile.delete.mockResolvedValue({})

    const res = await cleanupPOST(makePost(SECRET))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: 3 })
    expect(mockPrisma.diskFile.delete).toHaveBeenCalledTimes(3)
  })
})
