import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  folder: {
    findFirst: vi.fn(),
  },
  diskFile: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const mockGetServerSession = vi.fn()
vi.mock('next-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth')>()
  return { ...actual, getServerSession: mockGetServerSession }
})

const mockReadFile = vi.fn()
vi.mock('fs/promises', () => ({ readFile: mockReadFile }))

const { GET: filesGET } = await import('@/app/api/disk/folders/[id]/files/route')
const { POST: movePOST } = await import('@/app/api/disk/files/[id]/move/route')
const { POST: restorePOST } = await import('@/app/api/disk/files/[id]/restore/route')
const { GET: downloadGET } = await import('@/app/api/disk/files/[id]/download/route')

const SESSION = { user: { id: 'user-1', email: 'alice@maillab.local' } }

const FOLDER_LONG  = { id: 'f-long',  name: 'Long-term', isRoot: true, userId: 'user-1' }
const FOLDER_OTHER = { id: 'f-other', name: 'Other',     isRoot: true, userId: 'user-1' }
const FOLDER_TRASH = { id: 'f-trash', name: 'Trash',     isRoot: true, userId: 'user-1' }

const DISK_FILE = {
  id: 'df-1',
  name: 'report.pdf',
  userId: 'user-1',
  folderId: 'f-long',
  storagePath: 'storage/disk/user-1/f-long/report.pdf',
  sizeBytes: 1024,
  createdAt: new Date('2024-01-01'),
  deletedAt: null,
  previousFolderId: null,
}

const DISK_FILE_TRASHED = {
  ...DISK_FILE,
  id: 'df-2',
  folderId: 'f-trash',
  deletedAt: new Date('2024-01-02'),
  previousFolderId: 'f-long',
}

function makeGet(url: string) {
  return new Request(url)
}

function makePost(url: string, body?: object) {
  return new Request(url, {
    method: 'POST',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
}

describe('GET /api/disk/folders/:id/files', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await filesGET(makeGet('http://localhost/api/disk/folders/f-long/files'), {
      params: Promise.resolve({ id: 'f-long' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 when folder belongs to another user', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findFirst.mockResolvedValue(null)
    const res = await filesGET(makeGet('http://localhost/api/disk/folders/other/files'), {
      params: Promise.resolve({ id: 'other' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 200 with empty array for new empty folder', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER_LONG)
    mockPrisma.diskFile.findMany.mockResolvedValue([])
    const res = await filesGET(makeGet('http://localhost/api/disk/folders/f-long/files'), {
      params: Promise.resolve({ id: 'f-long' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns only non-deleted files for non-trash folder', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER_LONG)
    mockPrisma.diskFile.findMany.mockResolvedValue([
      { id: 'df-1', name: 'report.pdf', sizeBytes: 1024, createdAt: new Date('2024-01-01'), deletedAt: null },
    ])
    const res = await filesGET(makeGet('http://localhost/api/disk/folders/f-long/files'), {
      params: Promise.resolve({ id: 'f-long' }),
    })
    const body = await res.json() as { deletedAt: null }[]
    expect(body).toHaveLength(1)
    expect(body[0].deletedAt).toBeNull()
    expect(mockPrisma.diskFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    )
  })

  it('returns deleted files for Trash folder', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER_TRASH)
    mockPrisma.diskFile.findMany.mockResolvedValue([
      { id: 'df-2', name: 'old.pdf', sizeBytes: 512, createdAt: new Date('2024-01-01'), deletedAt: '2024-01-02T00:00:00.000Z' },
    ])
    const res = await filesGET(makeGet('http://localhost/api/disk/folders/f-trash/files'), {
      params: Promise.resolve({ id: 'f-trash' }),
    })
    const body = await res.json() as { deletedAt: string }[]
    expect(body).toHaveLength(1)
    expect(body[0].deletedAt).not.toBeNull()
    expect(mockPrisma.diskFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: { not: null } }) })
    )
  })
})

describe('POST /api/disk/files/:id/move', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await movePOST(makePost('http://localhost/api/disk/files/df-1/move', { targetFolderId: 'f-trash' }), {
      params: Promise.resolve({ id: 'df-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown file', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(null)
    const res = await movePOST(makePost('http://localhost/api/disk/files/df-x/move', { targetFolderId: 'f-long' }), {
      params: Promise.resolve({ id: 'df-x' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 for unknown targetFolderId', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(DISK_FILE)
    mockPrisma.folder.findFirst.mockResolvedValue(null)
    const res = await movePOST(makePost('http://localhost/api/disk/files/df-1/move', { targetFolderId: 'f-unknown' }), {
      params: Promise.resolve({ id: 'df-1' }),
    })
    expect(res.status).toBe(404)
  })

  it('moves to Trash: sets deletedAt and previousFolderId', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(DISK_FILE)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER_TRASH)
    mockPrisma.diskFile.update.mockResolvedValue({
      id: 'df-1',
      folderId: 'f-trash',
      deletedAt: new Date('2024-01-02'),
    })
    const res = await movePOST(makePost('http://localhost/api/disk/files/df-1/move', { targetFolderId: 'f-trash' }), {
      params: Promise.resolve({ id: 'df-1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { folderId: string; deletedAt: string }
    expect(body.folderId).toBe('f-trash')
    expect(body.deletedAt).not.toBeNull()
    expect(mockPrisma.diskFile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deletedAt: expect.any(Date), previousFolderId: 'f-long' }),
    }))
  })

  it('moves to non-Trash: updates folderId, deletedAt stays null', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(DISK_FILE)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER_OTHER)
    mockPrisma.diskFile.update.mockResolvedValue({
      id: 'df-1',
      folderId: 'f-other',
      deletedAt: null,
    })
    const res = await movePOST(makePost('http://localhost/api/disk/files/df-1/move', { targetFolderId: 'f-other' }), {
      params: Promise.resolve({ id: 'df-1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { folderId: string; deletedAt: null }
    expect(body.folderId).toBe('f-other')
    expect(body.deletedAt).toBeNull()
  })

  it('returns 400 when file is in Trash (use restore instead)', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(DISK_FILE_TRASHED)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER_LONG)
    const res = await movePOST(makePost('http://localhost/api/disk/files/df-2/move', { targetFolderId: 'f-long' }), {
      params: Promise.resolve({ id: 'df-2' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'use_restore_endpoint' })
  })
})

describe('POST /api/disk/files/:id/restore', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await restorePOST(makePost('http://localhost/api/disk/files/df-2/restore'), {
      params: Promise.resolve({ id: 'df-2' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown file', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(null)
    const res = await restorePOST(makePost('http://localhost/api/disk/files/df-x/restore'), {
      params: Promise.resolve({ id: 'df-x' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when file is not in Trash', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(DISK_FILE)
    const res = await restorePOST(makePost('http://localhost/api/disk/files/df-1/restore'), {
      params: Promise.resolve({ id: 'df-1' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'not_in_trash' })
  })

  it('restores file to previousFolderId, clears deletedAt', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(DISK_FILE_TRASHED)
    mockPrisma.folder.findFirst.mockResolvedValue(FOLDER_LONG)
    mockPrisma.diskFile.update.mockResolvedValue({ id: 'df-2', folderId: 'f-long' })
    const res = await restorePOST(makePost('http://localhost/api/disk/files/df-2/restore'), {
      params: Promise.resolve({ id: 'df-2' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string; folderId: string }
    expect(body.folderId).toBe('f-long')
    expect(mockPrisma.diskFile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deletedAt: null, previousFolderId: null }),
    }))
  })

  it('falls back to "Other" when previousFolder is deleted', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(DISK_FILE_TRASHED)
    mockPrisma.folder.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(FOLDER_OTHER)
    mockPrisma.diskFile.update.mockResolvedValue({ id: 'df-2', folderId: 'f-other' })
    const res = await restorePOST(makePost('http://localhost/api/disk/files/df-2/restore'), {
      params: Promise.resolve({ id: 'df-2' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { folderId: string }
    expect(body.folderId).toBe('f-other')
  })
})

describe('GET /api/disk/files/:id/download', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await downloadGET(makeGet('http://localhost/api/disk/files/df-1/download'), {
      params: Promise.resolve({ id: 'df-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 for trashed file', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(null)
    const res = await downloadGET(makeGet('http://localhost/api/disk/files/df-2/download'), {
      params: Promise.resolve({ id: 'df-2' }),
    })
    expect(res.status).toBe(404)
  })

  it('streams correct bytes with proper headers', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.diskFile.findFirst.mockResolvedValue(DISK_FILE)
    const fileContent = Buffer.from('file content bytes')
    mockReadFile.mockResolvedValue(fileContent)
    const res = await downloadGET(makeGet('http://localhost/api/disk/files/df-1/download'), {
      params: Promise.resolve({ id: 'df-1' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="report.pdf"')
    const body = await res.arrayBuffer()
    expect(Buffer.from(body)).toEqual(fileContent)
  })
})
