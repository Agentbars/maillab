import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

const EMAIL_REGEX = /^[a-z0-9._-]+@maillab\.local$/i
const ROOT_FOLDER_NAMES = ['Inbox attachments', 'Long-term', 'Other', 'Trash'] as const

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { email, password } = body as Record<string, unknown>

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'invalid_email_format', field: 'email' }, { status: 400 })
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return NextResponse.json({ error: 'password_too_short', field: 'password' }, { status: 400 })
  }

  const [existing, passwordHash] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    bcrypt.hash(password, 12),
  ])

  if (existing) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 })
  }

  const user = await prisma.user.create({ data: { email, passwordHash } })

  await prisma.folder.createMany({
    data: ROOT_FOLDER_NAMES.map((name) => ({
      name,
      userId: user.id,
      isRoot: true,
      parentId: null,
    })),
  })

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}
