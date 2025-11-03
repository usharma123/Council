import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/get-or-create-user'

export const runtime = 'nodejs'

async function callOpenRouter(personaSystemPrompt: string, query: string) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ai-council',
      'X-Title': 'ai-council',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: personaSystemPrompt,
        },
        {
          role: 'user',
          content: query,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    throw new Error('OpenRouter API error')
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

function parsePersonaResponse(content: string) {
  try {
    const parsed = JSON.parse(content)
    return {
      answer: parsed.answer || '',
      vote: parsed.vote || null,
      vote_explanation: parsed.vote_explanation || '',
    }
  } catch {
    return {
      answer: content,
      vote: null,
      vote_explanation: 'bad json',
    }
  }
}

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser()

    if (user.credits < 1) {
      return NextResponse.json({ error: 'NO_CREDITS' }, { status: 402 })
    }

    const body = await request.json()
    const { query } = body

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    const activePersonas = await prisma.persona.findMany({
      where: { status: 'active' },
    })

    if (activePersonas.length === 0) {
      return NextResponse.json(
        { error: 'No active personas' },
        { status: 400 }
      )
    }

    const personaResponses = await Promise.all(
      activePersonas.map(async (persona) => {
        try {
          const content = await callOpenRouter(persona.systemPrompt, query)
          const parsed = parsePersonaResponse(content)
          return {
            persona,
            ...parsed,
          }
        } catch (error) {
          return {
            persona,
            answer: 'Error calling AI',
            vote: null,
            vote_explanation: 'error',
          }
        }
      })
    )

    const voteCounts: Record<string, number> = {}
    activePersonas.forEach((p) => {
      voteCounts[p.id] = 0
    })

    personaResponses.forEach((resp) => {
      if (resp.vote) {
        activePersonas.forEach((p) => {
          if (resp.vote === p.id || resp.vote === p.name) {
            voteCounts[p.id]++
          }
        })
      }
    })

    let winnerId: string | null = null
    let maxVotes = 0
    activePersonas.forEach((p) => {
      if (voteCounts[p.id] > maxVotes) {
        maxVotes = voteCounts[p.id]
        winnerId = p.id
      }
    })

    if (!winnerId) {
      winnerId = activePersonas[0].id
    }

    const winnerResponse = personaResponses.find(
      (r) => r.persona.id === winnerId
    )

    const result = await prisma.$transaction(async (tx) => {
      const councilRun = await tx.councilRun.create({
        data: {
          userId: user.id,
          userQuery: query,
          winnerId,
        },
      })

      await Promise.all(
        personaResponses.map((resp) =>
          tx.personaAnswer.create({
            data: {
              councilRunId: councilRun.id,
              personaId: resp.persona.id,
              raw: {
                answer: resp.answer,
                vote: resp.vote,
                vote_explanation: resp.vote_explanation,
              },
              votedFor: resp.vote || null,
              isWinner: resp.persona.id === winnerId,
            },
          })
        )
      )

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          credits: {
            decrement: 1,
          },
        },
      })

      return { councilRun, updatedUser }
    })

    return NextResponse.json({
      answer: winnerResponse?.answer || '',
      voteCounts,
      personas: personaResponses.map((r) => ({
        id: r.persona.id,
        name: r.persona.name,
        answer: r.answer,
        vote: r.vote,
        vote_explanation: r.vote_explanation,
      })),
      creditsLeft: result.updatedUser.credits,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

