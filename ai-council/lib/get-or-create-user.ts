import { currentUser } from '@clerk/nextjs/server'
import { prisma } from './prisma'

export async function getOrCreateUser() {
  const clerkUser = await currentUser()
  if (!clerkUser) {
    throw new Error('Not authenticated')
  }

  let user = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || null,
        credits: 10,
      },
    })
  }

  return user
}

