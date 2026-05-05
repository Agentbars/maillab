import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

type FolderRow = {
  id: string
  name: string
  isRoot: boolean
  parentId: string | null
  userId: string
}

type FolderNode = FolderRow & { children: FolderNode[] }

function buildTree(folders: FolderRow[]): FolderNode[] {
  const map = new Map<string, FolderNode>()
  for (const f of folders) map.set(f.id, { ...f, children: [] })

  const roots: FolderNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export async function GET(_request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const folders = await prisma.folder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, isRoot: true, parentId: true, userId: true },
  })

  return NextResponse.json(buildTree(folders))
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { name, parentId } = body as Record<string, unknown>

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return NextResponse.json({ error: 'invalid_name', field: 'name' }, { status: 400 })
  }

  if (typeof parentId !== 'string') {
    return NextResponse.json({ error: 'invalid_parentId', field: 'parentId' }, { status: 400 })
  }

  const parent = await prisma.folder.findFirst({
    where: { id: parentId, userId: session.user.id },
  })
  if (!parent) {
    return NextResponse.json({ error: 'parent_not_found' }, { status: 404 })
  }

  if (parent.name === 'Trash' && parent.isRoot) {
    return NextResponse.json({ error: 'cannot_nest_in_trash' }, { status: 400 })
  }

  const folder = await prisma.folder.create({
    data: {
      name: name.trim(),
      userId: session.user.id,
      parentId,
      isRoot: false,
    },
  })

  return NextResponse.json({ id: folder.id, name: folder.name, parentId: folder.parentId }, { status: 201 })
}
