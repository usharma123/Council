import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    )
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const appUserId = session.metadata?.app_user_id

    if (appUserId) {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: appUserId },
          data: {
            credits: {
              increment: 50,
            },
          },
        })

        await tx.creditTransaction.create({
          data: {
            userId: user.id,
            amount: 50,
            reason: 'stripe_checkout:$5',
          },
        })
      })
    }
  }

  return NextResponse.json({ received: true })
}

