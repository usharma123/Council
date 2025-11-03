import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/get-or-create-user'

export const runtime = 'nodejs'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await getOrCreateUser()
    const body = await request.json()
    const { status } = body

    if (status !== 'active' && status !== 'inactive') {
      return NextResponse.json(
        { error: 'Status must be "active" or "inactive"' },
        { status: 400 }
      )
    }

    const persona = await prisma.persona.update({
      where: { id: params.id },
      data: { status },
    })

    return NextResponse.json(persona)
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

