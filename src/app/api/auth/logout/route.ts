import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(_request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('next-auth.session-token', '', { expires: new Date(0), path: '/' })
  response.cookies.set('__Secure-next-auth.session-token', '', { expires: new Date(0), path: '/' })

  return response
}
