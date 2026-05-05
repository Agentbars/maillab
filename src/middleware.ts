import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware() {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/inbox/:path*',
    '/sent',
    '/disk/:path*',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/messages/:path*',
    '/api/inbox/:path*',
    '/api/sent/:path*',
    '/api/disk/:path*',
    '/api/internal/:path*',
  ],
}
