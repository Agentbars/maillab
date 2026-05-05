import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(_request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const messages = await prisma.message.findMany({
    where: { fromEmail: session.user.email },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      toEmail: true,
      subject: true,
      createdAt: true,
      hasAttachment: true,
    },
  })

  return NextResponse.json(
    messages.map(m => ({
      id: m.id,
      to: m.toEmail,
      subject: m.subject,
      createdAt: m.createdAt,
      hasAttachment: m.hasAttachment,
    }))
  )
}
