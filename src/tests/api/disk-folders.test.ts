import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  folder: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  diskFile: { count: vi.fn() },
}
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const mockGetServerSession = vi.fn()
vi.mock('next-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth')>()
  return { ...actual, getServerSession: mockGetServerSession }
})

const { GET: foldersGET, POST: foldersPOST } = await import('@/app/api/disk/folders/route')
const { DELETE: folderDELETE } = await import('@/app/api/disk/folders/[id]/route')

const SESSION = { user: { id: 'user-1', email: 'alice@maillab.local' } }

const ROOT_FOLDERS = [
  { id: 'f-inbox', name: 'Inbox attachments', isRoot: true, parentId: null, userId: 'user-1' },
  { id: 'f-long',  name: 'Long-term',         isRoot: true, parentId: null, userId: 'user-1' },
  { id: 'f-other', name: 'Other',              isRoot: true, parentId: null, userId: 'user-1' },
  { id: 'f-trash', name: 'Trash',              isRoot: true, parentId: null, userId: 'user-1' },
]

function makeGet() {
  return new Request('http://localhost/api/disk/folders')
}

function makePost(body: object) {
  return new Request('http://localhost/api/disk/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDelete(id: string) {
  return new Request(`http://localhost/api/disk/folders/${id}`, { method: 'DELETE' })
}

describe('GET /api/disk/folders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await foldersGET(makeGet())
    expect(res.status).toBe(401)
  })

  it('returns 4 root folders with no children initially', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findMany.mockResolvedValue(ROOT_FOLDERS)

    const res = await foldersGET(makeGet())
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string; children: unknown[] }[]
    expect(body).toHaveLength(4)
    expect(body.every(f => f.children.length === 0)).toBe(true)
  })

  it('nests subfolders under their parent', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const sub = { id: 'f-sub', name: 'Sub', isRoot: false, parentId: 'f-long', userId: 'user-1' }
    mockPrisma.folder.findMany.mockResolvedValue([...ROOT_FOLDERS, sub])

    const res = await foldersGET(makeGet())
    const body = await res.json() as { id: string; children: { id: string }[] }[]
    const longTerm = body.find(f => f.id === 'f-long')!
    expect(longTerm.children).toHaveLength(1)
    expect(longTerm.children[0].id).toBe('f-sub')
  })
})

describe('POST /api/disk/folders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await foldersPOST(makePost({ name: 'New', parentId: 'f-long' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 on blank name', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    const res = await foldersPOST(makePost({ name: '  ', parentId: 'f-long' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ field: 'name' })
  })

  it('returns 404 when parentId belongs to another user', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findFirst.mockResolvedValue(null)
    const res = await foldersPOST(makePost({ name: 'Sub', parentId: 'other-folder' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when parentId is Trash', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findFirst.mockResolvedValue(
      { id: 'f-trash', name: 'Trash', isRoot: true, userId: 'user-1' }
    )
    const res = await foldersPOST(makePost({ name: 'Sub', parentId: 'f-trash' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'cannot_nest_in_trash' })
  })

  it('returns 201 on valid subfolder creation', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findFirst.mockResolvedValue(
      { id: 'f-long', name: 'Long-term', isRoot: true, userId: 'user-1' }
    )
    mockPrisma.folder.create.mockResolvedValue(
      { id: 'f-new', name: 'Reports', parentId: 'f-long' }
    )
    const res = await foldersPOST(makePost({ name: 'Reports', parentId: 'f-long' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 'f-new', name: 'Reports', parentId: 'f-long' })
  })
})

describe('DELETE /api/disk/folders/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await folderDELETE(makeDelete('f-sub'), { params: Promise.resolve({ id: 'f-sub' }) })
    expect(res.status).toBe(401)
  })

  it('returns 400 when trying to delete a root folder', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findFirst.mockResolvedValue(
      { id: 'f-long', name: 'Long-term', isRoot: true, userId: 'user-1' }
    )
    const res = await folderDELETE(makeDelete('f-long'), { params: Promise.resolve({ id: 'f-long' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'cannot_delete_root' })
  })

  it('returns 400 when folder has files or subfolders', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findFirst.mockResolvedValue(
      { id: 'f-sub', name: 'Sub', isRoot: false, userId: 'user-1' }
    )
    mockPrisma.folder.count.mockResolvedValue(0)
    mockPrisma.diskFile.count.mockResolvedValue(2)
    const res = await folderDELETE(makeDelete('f-sub'), { params: Promise.resolve({ id: 'f-sub' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'folder_not_empty' })
  })

  it('returns 204 on successful delete of empty subfolder', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockPrisma.folder.findFirst.mockResolvedValue(
      { id: 'f-sub', name: 'Sub', isRoot: false, userId: 'user-1' }
    )
    mockPrisma.folder.count.mockResolvedValue(0)
    mockPrisma.diskFile.count.mockResolvedValue(0)
    mockPrisma.folder.delete.mockResolvedValue({})
    const res = await folderDELETE(makeDelete('f-sub'), { params: Promise.resolve({ id: 'f-sub' }) })
    expect(res.status).toBe(204)
  })
})
