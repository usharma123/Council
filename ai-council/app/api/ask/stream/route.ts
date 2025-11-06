import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/get-or-create-user'

export const runtime = 'nodejs'

async function callOpenRouterJson(messages: Array<{ role: 'system' | 'user'; content: string }>) {
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
      messages,
      response_format: { type: 'json_object' },
    }),
  })
  if (!response.ok) {
    throw new Error('OpenRouter API error')
  }
  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

async function callForAnswer(personaSystemPrompt: string, userQuery: string) {
  const content = await callOpenRouterJson([
    { role: 'system', content: personaSystemPrompt },
    {
      role: 'user',
      content:
        `You are one of several specialized experts answering a user's question.\n` +
        `Return STRICT JSON with only: {"answer": string}.\n` +
        `Do not include any voting yet.\n\n` +
        `User question:\n${userQuery}`,
    },
  ])
  try {
    const parsed = JSON.parse(content)
    return { answer: String(parsed.answer ?? '') }
  } catch {
    return { answer: content || '' }
  }
}

type BallotItem = { label: string; answer: string }

async function callForVote(
  personaSystemPrompt: string,
  userQuery: string,
  ballot: BallotItem[],
  ownLabel: string
) {
  const ballotText = ballot.map((b) => `${b.label}. ${b.answer}`).join('\n')
  const content = await callOpenRouterJson([
    { role: 'system', content: personaSystemPrompt },
    {
      role: 'user',
      content:
        `You are now voting on the best answer to the user's question from an anonymized ballot.\n` +
        `Rules:\n` +
        `- You must pick exactly one label from the ballot.\n` +
        `- Your own answer is labeled "${ownLabel}". You may NOT vote for your own label.\n` +
        `- Return STRICT JSON with keys: {"vote": "A|B|C|...", "vote_explanation": string}.\n` +
        `- "vote" must be one of the provided labels, and not "${ownLabel}".\n\n` +
        `User question:\n${userQuery}\n\n` +
        `Ballot:\n${ballotText}`,
    },
  ])
  try {
    const parsed = JSON.parse(content)
    const vote = typeof parsed.vote === 'string' ? parsed.vote.trim().toUpperCase() : null
    const vote_explanation = String(parsed.vote_explanation ?? '')
    return { vote, vote_explanation }
  } catch {
    return { vote: null as string | null, vote_explanation: 'bad json' }
  }
}

function shuffle<T>(arr: T[]) {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
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

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          // Phase A: Answers only
          send({ type: 'phase', phase: 'answers', message: 'Collecting answers from council members...' })
          
          const answers = await Promise.all(
            activePersonas.map(async (persona, idx) => {
              try {
                const { answer } = await callForAnswer(persona.systemPrompt, query)
                send({ 
                  type: 'answer', 
                  personaId: persona.id, 
                  personaName: persona.name,
                  answer,
                  progress: { current: idx + 1, total: activePersonas.length }
                })
                return { persona, answer }
              } catch {
                send({ 
                  type: 'answer', 
                  personaId: persona.id, 
                  personaName: persona.name,
                  answer: 'Error calling AI',
                  progress: { current: idx + 1, total: activePersonas.length }
                })
                return { persona, answer: 'Error calling AI' }
              }
            })
          )

          const personaIdToAnswer: Record<string, string> = {}
          for (const a of answers) {
            personaIdToAnswer[a.persona.id] = a.answer
          }

          // Phase B: Voting
          send({ type: 'phase', phase: 'voting', message: 'Council members are voting...' })
          
          const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, activePersonas.length)
          const voteCounts: Record<string, number> = Object.fromEntries(
            activePersonas.map((p) => [p.id, 0])
          )

          type VoteRecord = {
            personaId: string
            voteForPersonaId: string | null
            voteLabel: string | null
            voteExplanation: string
          }

          const votes: VoteRecord[] = []

          for (let idx = 0; idx < activePersonas.length; idx++) {
            const voter = activePersonas[idx]
            const shuffledPersonaIds = shuffle(activePersonas.map((p) => p.id))
            const labelToPersonaId: Record<string, string> = {}
            shuffledPersonaIds.forEach((personaId, i) => {
              labelToPersonaId[labels[i]] = personaId
            })
            const ownLabel = Object.entries(labelToPersonaId).find(
              ([, personaId]) => personaId === voter.id
            )?.[0] as string

            const ballot: BallotItem[] = labels.map((label) => {
              const pid = labelToPersonaId[label]
              return { label, answer: personaIdToAnswer[pid] }
            })

            try {
              const { vote, vote_explanation } = await callForVote(
                voter.systemPrompt,
                query,
                ballot,
                ownLabel
              )
              let resolvedPersonaId: string | null = null
              let voteLabel: string | null = null
              if (vote && vote !== ownLabel && labelToPersonaId[vote]) {
                resolvedPersonaId = labelToPersonaId[vote]
                voteLabel = vote
                if (resolvedPersonaId) {
                  voteCounts[resolvedPersonaId] = (voteCounts[resolvedPersonaId] || 0) + 1
                }
              }
              votes.push({
                personaId: voter.id,
                voteForPersonaId: resolvedPersonaId,
                voteLabel,
                voteExplanation: vote_explanation || '',
              })
              const votedForPersona = resolvedPersonaId ? activePersonas.find(p => p.id === resolvedPersonaId) : null
              send({ 
                type: 'vote', 
                personaId: voter.id,
                personaName: voter.name,
                votedFor: resolvedPersonaId,
                votedForName: votedForPersona?.name || null,
                voteExplanation: vote_explanation || '',
                progress: { current: idx + 1, total: activePersonas.length }
              })
            } catch {
              votes.push({
                personaId: voter.id,
                voteForPersonaId: null,
                voteLabel: null,
                voteExplanation: 'error',
              })
              send({ 
                type: 'vote', 
                personaId: voter.id,
                personaName: voter.name,
                votedFor: null,
                votedForName: null,
                voteExplanation: 'error',
                progress: { current: idx + 1, total: activePersonas.length }
              })
            }
          }

          // Determine winner
          let winnerId: string | null = null
          let maxVotes = -1
          for (const p of activePersonas) {
            const count = voteCounts[p.id] || 0
            if (count > maxVotes) {
              maxVotes = count
              winnerId = p.id
            }
          }
          if (!winnerId) {
            winnerId = activePersonas[0].id
          }

          send({ type: 'winner', winnerId, voteCounts })

          const result = await prisma.$transaction(async (tx) => {
            const councilRun = await tx.councilRun.create({
              data: {
                userId: user.id,
                userQuery: query,
                winnerId,
              },
            })

            await Promise.all(
              activePersonas.map((persona) => {
                const voteFor = votes.find((v) => v.personaId === persona.id)
                return tx.personaAnswer.create({
                  data: {
                    councilRunId: councilRun.id,
                    personaId: persona.id,
                    raw: {
                      answer: personaIdToAnswer[persona.id],
                      vote_label: voteFor?.voteLabel ?? null,
                      vote_explanation: voteFor?.voteExplanation ?? '',
                    },
                    votedFor: voteFor?.voteForPersonaId ?? null,
                    isWinner: persona.id === winnerId,
                  },
                })
              })
            )

            await Promise.all(
              activePersonas.map((persona) =>
                tx.persona.update({
                  where: { id: persona.id },
                  data: {
                    runs: { increment: 1 },
                    wins: { increment: persona.id === winnerId ? 1 : 0 },
                    voteScore: { increment: voteCounts[persona.id] || 0 },
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

          const personaResponses = activePersonas.map((p) => {
            const v = votes.find((vv) => vv.personaId === p.id)
            return {
              id: p.id,
              name: p.name,
              answer: personaIdToAnswer[p.id],
              vote: v?.voteForPersonaId ?? null,
              vote_explanation: v?.voteExplanation ?? '',
            }
          })

          send({ 
            type: 'complete', 
            answer: personaIdToAnswer[winnerId] || '',
            voteCounts,
            personas: personaResponses,
            creditsLeft: result.updatedUser.credits,
            runId: result.councilRun.id
          })
        } catch (error: any) {
          send({ type: 'error', error: error.message || 'Internal server error' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

