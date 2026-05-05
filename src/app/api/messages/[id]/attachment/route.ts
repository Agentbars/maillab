import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { readFile } from 'fs/promises'
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

  const { id } = await params

  const message = await prisma.message.findFirst({
    where: { id, toEmail: session.user.email },
  })

  if (!message || !message.hasAttachment || !message.storagePath || !message.attachmentFilename) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const buffer = await readFile(message.storagePath)

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${message.attachmentFilename}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
