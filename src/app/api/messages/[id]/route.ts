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

  const { id } = await params

  const message = await prisma.message.findFirst({
    where: {
      id,
      OR: [
        { fromEmail: session.user.email },
        { toEmail: session.user.email, deliveredAt: { lte: new Date() } },
      ],
    },
  })

  if (!message) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({
    id: message.id,
    from: message.fromEmail,
    to: message.toEmail,
    subject: message.subject,
    body: message.body,
    createdAt: message.createdAt,
    attachment: message.hasAttachment
      ? { filename: message.attachmentFilename, sizeBytes: message.attachmentSizeBytes }
      : null,
  })
}
