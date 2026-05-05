import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id: folderId } = await params

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, userId: session.user.id },
  })
  if (!folder) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const isTrash = folder.name === 'Trash' && folder.isRoot

  const files = await prisma.diskFile.findMany({
    where: {
      folderId,
      userId: session.user.id,
      deletedAt: isTrash ? { not: null } : null,
    },
    select: { id: true, name: true, sizeBytes: true, createdAt: true, deletedAt: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(files)
}
