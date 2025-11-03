import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/get-or-create-user'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await getOrCreateUser()
    const personas = await prisma.persona.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(personas)
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await getOrCreateUser()
    const body = await request.json()
    const { name, systemPrompt } = body

    if (!name || !systemPrompt) {
      return NextResponse.json(
        { error: 'Missing name or systemPrompt' },
        { status: 400 }
      )
    }

    const persona = await prisma.persona.create({
      data: {
        name,
        systemPrompt,
        status: 'active',
      },
    })

    return NextResponse.json(persona)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Persona name already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

