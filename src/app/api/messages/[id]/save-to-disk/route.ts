import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { mkdir, copyFile, access } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ACCOUNT_DISK_QUOTA_BYTES = 250 * 1024

async function resolveFilename(dir: string, filename: string): Promise<string> {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let candidate = filename
  let counter = 1
  while (true) {
    try {
      await access(path.join(dir, candidate))
      candidate = `${base}_${counter}${ext}`
      counter++
    } catch {
      return candidate
    }
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const message = await prisma.message.findFirst({
    where: { id, toEmail: session.user.email },
  })
  if (!message) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (!message.hasAttachment || !message.storagePath || !message.attachmentFilename) {
    return NextResponse.json({ error: 'no_attachment' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const folderId = (body as Record<string, unknown>)?.folderId
  if (typeof folderId !== 'string') {
    return NextResponse.json({ error: 'invalid_folderId', field: 'folderId' }, { status: 400 })
  }

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, userId: session.user.id },
  })
  if (!folder) {
    return NextResponse.json({ error: 'folder_not_found' }, { status: 404 })
  }

  const usage = await prisma.diskFile.aggregate({
    _sum: { sizeBytes: true },
    where: { userId: session.user.id },
  })
  const currentBytes = usage._sum.sizeBytes ?? 0
  const incomingBytes = message.attachmentSizeBytes ?? 0
  if (currentBytes + incomingBytes > ACCOUNT_DISK_QUOTA_BYTES) {
    return NextResponse.json({ error: 'storage_full' }, { status: 507 })
  }

  const destDir = path.join('storage', 'disk', session.user.id, folderId)
  await mkdir(destDir, { recursive: true })

  const finalName = await resolveFilename(destDir, message.attachmentFilename)
  const destPath = path.join(destDir, finalName)

  await copyFile(message.storagePath, destPath)

  const diskFile = await prisma.diskFile.create({
    data: {
      name: finalName,
      userId: session.user.id,
      folderId,
      storagePath: destPath,
      sizeBytes: message.attachmentSizeBytes ?? 0,
    },
  })

  return NextResponse.json(
    { fileId: diskFile.id, name: diskFile.name, folderId: diskFile.folderId },
    { status: 201 }
  )
}
