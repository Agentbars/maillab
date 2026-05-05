import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const file = await prisma.diskFile.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!file) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (!file.deletedAt) {
    return NextResponse.json({ error: 'not_in_trash' }, { status: 400 })
  }

  let targetFolderId = file.previousFolderId

  if (targetFolderId) {
    const prevFolder = await prisma.folder.findFirst({
      where: { id: targetFolderId, userId: session.user.id },
    })
    if (!prevFolder) targetFolderId = null
  }

  if (!targetFolderId) {
    const otherFolder = await prisma.folder.findFirst({
      where: { name: 'Other', isRoot: true, userId: session.user.id },
    })
    if (!otherFolder) {
      return NextResponse.json({ error: 'no_target_folder' }, { status: 500 })
    }
    targetFolderId = otherFolder.id
  }

  const updated = await prisma.diskFile.update({
    where: { id },
    data: { folderId: targetFolderId, deletedAt: null, previousFolderId: null },
  })

  return NextResponse.json({ id: updated.id, folderId: updated.folderId })
}
