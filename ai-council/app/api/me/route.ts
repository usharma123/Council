import { NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/get-or-create-user'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getOrCreateUser()
    return NextResponse.json({
      credits: user.credits,
      email: user.email,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

