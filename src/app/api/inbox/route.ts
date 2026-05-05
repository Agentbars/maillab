import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get('since')

  const sinceDate = since ? new Date(since) : null

  const messages = await prisma.message.findMany({
    where: {
      toEmail: session.user.email,
      ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fromEmail: true,
      subject: true,
      createdAt: true,
      hasAttachment: true,
    },
  })

  const result = messages.map((m) => ({
    id: m.id,
    from: m.fromEmail,
    subject: m.subject,
    createdAt: m.createdAt,
    hasAttachment: m.hasAttachment,
  }))

  return NextResponse.json(result)
}
