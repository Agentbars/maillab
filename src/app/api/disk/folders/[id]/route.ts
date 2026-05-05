import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const folder = await prisma.folder.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!folder) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (folder.isRoot) {
    return NextResponse.json({ error: 'cannot_delete_root' }, { status: 400 })
  }

  const [subfolderCount, fileCount] = await Promise.all([
    prisma.folder.count({ where: { parentId: id } }),
    prisma.diskFile.count({ where: { folderId: id } }),
  ])

  if (subfolderCount > 0 || fileCount > 0) {
    return NextResponse.json({ error: 'folder_not_empty' }, { status: 400 })
  }

  await prisma.folder.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
