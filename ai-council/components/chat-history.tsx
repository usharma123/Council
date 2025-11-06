'use client'

import { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Plus, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RunItem {
  id: string
  createdAt: string
  userQuery: string
  winnerAnswer: string
}

interface ChatHistoryProps {
  selectedRunId: string | null
  onSelectRun: (runId: string | null) => void
  onNewChat: () => void
  refreshTrigger?: number
}

export function ChatHistory({ selectedRunId, onSelectRun, onNewChat, refreshTrigger }: ChatHistoryProps) {
  const [runs, setRuns] = useState<RunItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRuns()
  }, [])

  // Refresh when refreshTrigger changes or when selection is cleared
  useEffect(() => {
    fetchRuns()
  }, [refreshTrigger, selectedRunId])

  const fetchRuns = async () => {
    try {
      const res = await fetch('/api/runs')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setRuns(data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch runs', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      <div className="p-4 border-b">
        <Button
          onClick={onNewChat}
          className="w-full"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="text-sm text-muted-foreground p-4 text-center">
              Loading...
            </div>
          ) : runs.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 text-center">
              No chat history yet
            </div>
          ) : (
            <div className="space-y-1">
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => onSelectRun(run.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-colors",
                    "hover:bg-muted",
                    selectedRunId === run.id
                      ? "bg-primary/10 border border-primary/20"
                      : "border border-transparent"
                  )}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {truncate(run.userQuery, 60)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(run.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

