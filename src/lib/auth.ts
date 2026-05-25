import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export async function authorizeCredentials(
  credentials: Record<string, string> | undefined
): Promise<{ id: string; email: string } | null> {
  const loginDelayMs = Math.floor(Math.random() * 5000) + 5000
  await new Promise((resolve) => setTimeout(resolve, loginDelayMs))

  if (!credentials?.email || !credentials?.password) return null

  const user = await prisma.user.findUnique({
    where: { email: credentials.email },
  })
  if (!user) return null

  const valid = await bcrypt.compare(credentials.password, user.passwordHash)
  if (!valid) return null

  return { id: user.id, email: user.email }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email ?? ''
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
