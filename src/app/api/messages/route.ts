import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const EMAIL_REGEX = /^[a-z0-9._-]+@maillab\.local$/i
const MAX_ATTACHMENT_BYTES = 50 * 1024

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 })
  }

  const to = form.get('to')
  const subject = form.get('subject')
  const body = form.get('body') ?? ''
  const attachmentFile = form.get('attachment')

  if (typeof to !== 'string' || !EMAIL_REGEX.test(to)) {
    return NextResponse.json({ error: 'invalid_to', field: 'to' }, { status: 400 })
  }

  if (typeof subject !== 'string' || subject.length < 1 || subject.length > 200) {
    return NextResponse.json({ error: 'invalid_subject', field: 'subject' }, { status: 400 })
  }

  if (typeof body !== 'string' || body.length > 10000) {
    return NextResponse.json({ error: 'invalid_body', field: 'body' }, { status: 400 })
  }

  const attachment = attachmentFile instanceof File ? attachmentFile : null

  if (attachment && attachment.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: 'attachment_too_large', field: 'attachment' }, { status: 400 })
  }

  const recipient = await prisma.user.findUnique({ where: { email: to } })
  if (!recipient) {
    return NextResponse.json({ error: 'recipient_not_found' }, { status: 404 })
  }

  const deliveryDelayMs = Math.floor(Math.random() * 3000) + 2000
  const deliveredAt = new Date(Date.now() + deliveryDelayMs)

  const message = await prisma.message.create({
    data: {
      fromId: session.user.id,
      toId: recipient.id,
      fromEmail: session.user.email,
      toEmail: to,
      subject,
      body,
      hasAttachment: attachment !== null,
      attachmentFilename: attachment?.name ?? null,
      attachmentSizeBytes: attachment?.size ?? null,
      storagePath: null,
      deliveredAt,
    },
  })

  if (attachment) {
    const dir = path.join('storage', 'messages', message.id)
    await mkdir(dir, { recursive: true })
    const filePath = path.join(dir, attachment.name)
    const buffer = Buffer.from(await attachment.arrayBuffer())
    await writeFile(filePath, buffer)

    await prisma.message.update({
      where: { id: message.id },
      data: { storagePath: filePath },
    })
  }

  return NextResponse.json(
    { id: message.id, createdAt: message.createdAt },
    { status: 201 }
  )
}
