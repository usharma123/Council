'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { Chat } from '@/components/chat'
import { ChatHistory } from '@/components/chat-history'
import { Button } from '@/components/ui/button'
import { Settings, Plus, Search, Users, Sun, Moon, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import ChatHeader from '@/components/chat-header'

export default function Home() {
  const { isSignedIn, user } = useUser()
  const [credits, setCredits] = useState<number | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showCredits, setShowCredits] = useState(false)
  const [isDark, setIsDark] = useState<boolean>(false)
  const [showAccount, setShowAccount] = useState(false)

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

  useEffect(() => {
    // hydrate theme
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = stored ? stored === 'dark' : prefersDark
    document.documentElement.classList.toggle('dark', dark)
    setIsDark(dark)
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">AI Council</h1>
          <p className="text-muted-foreground">Please sign in to continue.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden bg-background">
      <main className="flex-1 overflow-hidden z-20 border-chat-border bg-chat-background transition-[margin-top,height,rounded] md:mt-3.5 h-full md:border md:rounded-tl-xl duration-100 ease-snappy">
        <ChatHeader />
        <div className="h-full flex overflow-hidden">
          {/* Sidebar */}
          <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-200 flex-shrink-0 border-r border-sidebar-border bg-sidebar-background overflow-hidden`}>
            <div className="h-full flex flex-col">
              {/* Sidebar Header */}
              <div className="p-4 space-y-3 border-b border-sidebar-border">
                <div className="flex items-center gap-2 h-8">
                  <div className="w-6 h-6 rounded bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary-foreground">AI</span>
                  </div>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--wordmark-color)' }}>AI Council</h2>
                </div>
                <Button 
                  className="w-full" 
                  variant="t3"
                  onClick={handleNewChat}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Chat
                </Button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search your threads..."
                    className="pl-9 w-full bg-transparent border-0 border-b border-sidebar-border rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
              
              {/* Workspaces Section */}
              <div className="px-4 py-2 border-b border-sidebar-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Workspaces</span>
                  </div>
                </div>
              </div>

              {/* Chat History */}
              <div className="flex-1 overflow-hidden">
                <ChatHistory
                  selectedRunId={selectedRunId}
                  onSelectRun={setSelectedRunId}
                  onNewChat={handleNewChat}
                  refreshTrigger={historyRefreshTrigger}
                />
              </div>

              {/* Sidebar Footer */}
              <div className="p-2 border-t border-sidebar-border">
                {user && (
                  <Link
                    href="/personas"
                    className="flex rounded-lg p-2.5 mb-2 w-full hover:bg-sidebar-accent min-w-0 flex-row items-center gap-3"
                  >
                    <img
                      src={user.imageUrl || ""}
                      alt={user.fullName || ""}
                      className="h-8 w-8 bg-accent rounded-full ring-1 ring-muted-foreground/20"
                    />
                    <div className="flex min-w-0 flex-col text-foreground">
                      <span className="truncate text-sm font-medium">
                        {user.fullName || 'User'}
                      </span>
                      <span
                        className="text-xs text-muted-foreground cursor-pointer select-none"
                        onClick={(e) => {
                          e.preventDefault()
                          setShowCredits((s) => !s)
                        }}
                        title="Click to toggle credits"
                      >
                        {showCredits ? `Credits: ${credits ?? '...'}` : 'Free'}
                      </span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden bg-chat-background">
            <div className="h-full overflow-y-auto pt-5 md:pt-0">
              <Chat
                credits={credits}
                onCreditsUpdate={setCredits}
                onNewRun={handleNewRun}
                selectedRunId={selectedRunId}
                userName={user?.fullName?.split(' ')[0] || 'User'}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Top Right Actions - flat, no glass */}
      <div className="fixed right-2 top-2 z-[100] flex flex-row gap-1 text-muted-foreground">
        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Theme">
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        {/* Personas button (replaces GitHub) */}
        <Link href="/personas">
          <Button variant="ghost" size="icon" title="Personas">
            <Users className="w-4 h-4" />
          </Button>
        </Link>
        {/* Settings → User Info (Clerk) */}
        <Link href="/user">
          <Button variant="ghost" size="icon" title="User settings">
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Bottom Right: Account quick info (Info button toggles card) */}
      <div className="fixed bottom-4 right-4 z-[200]">
        {showAccount && (
          <div className="mb-3 w-64 rounded-xl border border-border/60 bg-background/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/80 p-4">
            <div className="text-sm font-semibold mb-1">{user?.fullName || 'User'}</div>
            <div className="text-xs text-muted-foreground">Credits</div>
            <div className="text-lg font-bold">{credits ?? '...'}</div>
            <div className="mt-3 flex gap-2">
              <Link href="/personas" className="flex-1">
                <Button variant="outline" className="w-full">Personas</Button>
              </Link>
              <Link href="/user" className="flex-1">
                <Button variant="outline" className="w-full">Settings</Button>
              </Link>
            </div>
          </div>
        )}
        <Button
          variant="t3"
          size="icon"
          title="Account"
          onClick={() => setShowAccount((s) => !s)}
          className="h-10 w-10"
        >
          <Info className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
}
