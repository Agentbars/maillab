import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { readFile } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.zip': 'application/zip',
}

function mimeFor(name: string): string {
  const ext = path.extname(name).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const file = await prisma.diskFile.findUnique({ where: { id } })
  if (!file || file.deletedAt !== null) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (file.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let buffer: Buffer
  try {
    buffer = await readFile(file.storagePath)
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  // Buffer is a subclass of Uint8Array — wrap so TS sees a BodyInit.
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': mimeFor(file.name),
      'Content-Disposition': `attachment; filename="${file.name}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
