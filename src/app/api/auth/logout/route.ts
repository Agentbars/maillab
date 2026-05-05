import { NextResponse } from 'next/server'

export async function POST(_request: Request): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('next-auth.session-token', '', { expires: new Date(0), path: '/' })
  response.cookies.set('__Secure-next-auth.session-token', '', { expires: new Date(0), path: '/' })
  return response
}
