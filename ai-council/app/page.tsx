'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { Chat } from '@/components/chat'
import { ChatHistory } from '@/components/chat-history'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'

export default function Home() {
  const { isSignedIn } = useUser()
  const [credits, setCredits] = useState<number | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)

  useEffect(() => {
    if (isSignedIn) {
      fetch('/api/me')
        .then((res) => res.json())
        .then((data) => {
          if (data.credits !== undefined) setCredits(data.credits)
        })
        .catch(console.error)
    }
  }, [isSignedIn])

  const handleNewRun = () => {
    // Refresh credits after a new run
    fetch('/api/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.credits !== undefined) setCredits(data.credits)
      })
      .catch(console.error)
    // Refresh history and clear selection to show new chat
    setHistoryRefreshTrigger((prev) => prev + 1)
    setSelectedRunId(null)
  }

  const handleNewChat = () => {
    setSelectedRunId(null)
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">AI Council</h1>
          <p className="text-muted-foreground">Please sign in to continue.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">AI Council</h1>
          <div className="flex items-center gap-4">
            <Link href="/personas">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Personas
              </Button>
            </Link>
            <div className="text-sm text-muted-foreground">
              Credits: <span className="font-semibold text-foreground">{credits ?? '...'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-64 flex-shrink-0 h-full">
          <ChatHistory
            selectedRunId={selectedRunId}
            onSelectRun={setSelectedRunId}
            onNewChat={handleNewChat}
            refreshTrigger={historyRefreshTrigger}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="h-full p-6">
            <Chat
              credits={credits}
              onCreditsUpdate={setCredits}
              onNewRun={handleNewRun}
              selectedRunId={selectedRunId}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
