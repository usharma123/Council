import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/get-or-create-user'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await getOrCreateUser()
    const runs = await prisma.councilRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        answers: true,
      },
    })

    const data = runs.map((r) => {
      const winner = r.answers.find((a) => a.isWinner)
      let winnerAnswer = ''
      if (winner && winner.raw && typeof winner.raw === 'object') {
        const raw = winner.raw as any
        if (typeof raw.answer === 'string') {
          winnerAnswer = raw.answer
        }
      }
      return {
        id: r.id,
        createdAt: r.createdAt,
        userQuery: r.userQuery,
        winnerAnswer,
      }
    })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}


