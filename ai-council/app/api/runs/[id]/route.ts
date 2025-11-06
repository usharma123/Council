import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/get-or-create-user'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getOrCreateUser()
    
    const { id } = await params
    const run = await prisma.councilRun.findUnique({
      where: { id },
      include: {
        answers: {
          include: {
            persona: true,
          },
        },
      },
    })

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const personaResponses = run.answers.map((answer) => {
      const raw = answer.raw as any
      const votedForAnswer = answer.votedFor
        ? run.answers.find((a) => a.personaId === answer.votedFor)
        : null
      
      return {
        id: answer.persona.id,
        name: answer.persona.name,
        answer: typeof raw?.answer === 'string' ? raw.answer : '',
        vote: answer.votedFor || null,
        vote_explanation: typeof raw?.vote_explanation === 'string' ? raw.vote_explanation : '',
      }
    })

    const winner = run.answers.find((a) => a.isWinner)
    const winnerAnswer = winner && winner.raw && typeof winner.raw === 'object'
      ? (winner.raw as any).answer || ''
      : ''

    const voteCounts: Record<string, number> = {}
    run.answers.forEach((answer) => {
      if (answer.votedFor) {
        voteCounts[answer.votedFor] = (voteCounts[answer.votedFor] || 0) + 1
      }
    })

    return NextResponse.json({
      id: run.id,
      userQuery: run.userQuery,
      createdAt: run.createdAt,
      winnerId: run.winnerId,
      winnerAnswer,
      voteCounts,
      personas: personaResponses,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

