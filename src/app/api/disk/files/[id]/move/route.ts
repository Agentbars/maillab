import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(
  request: Request,
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const targetFolderId = (body as Record<string, unknown>)?.targetFolderId
  if (typeof targetFolderId !== 'string') {
    return NextResponse.json({ error: 'invalid_targetFolderId', field: 'targetFolderId' }, { status: 400 })
  }

  const targetFolder = await prisma.folder.findFirst({
    where: { id: targetFolderId, userId: session.user.id },
  })
  if (!targetFolder) {
    return NextResponse.json({ error: 'folder_not_found' }, { status: 404 })
  }

  const isTargetTrash = targetFolder.name === 'Trash' && targetFolder.isRoot

  if (isTargetTrash) {
    const updated = await prisma.diskFile.update({
      where: { id },
      data: { folderId: targetFolderId, deletedAt: new Date(), previousFolderId: file.folderId },
    })
    return NextResponse.json({ id: updated.id, folderId: updated.folderId, deletedAt: updated.deletedAt })
  }

  if (file.deletedAt !== null) {
    return NextResponse.json({ error: 'use_restore_endpoint' }, { status: 400 })
  }

  const updated = await prisma.diskFile.update({
    where: { id },
    data: { folderId: targetFolderId, deletedAt: null, previousFolderId: null },
  })
  return NextResponse.json({ id: updated.id, folderId: updated.folderId, deletedAt: updated.deletedAt })
}
