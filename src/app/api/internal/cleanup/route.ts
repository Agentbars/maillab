import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import prisma from '@/lib/prisma'

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get('X-Internal-Secret')
  if (!secret || secret !== process.env.CLEANUP_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const expired = await prisma.diskFile.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true, storagePath: true },
  })

  await Promise.all(
    expired.map(async (file) => {
      try {
        await unlink(file.storagePath)
      } catch {
        // file already missing on disk — proceed with DB deletion
      }
      await prisma.diskFile.delete({ where: { id: file.id } })
    })
  )

  return NextResponse.json({ deleted: expired.length })
}
