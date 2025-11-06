'use client'

import { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare } from 'lucide-react'
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

  // Group runs by date
  const groupRunsByDate = () => {
    const today: RunItem[] = []
    const week: RunItem[] = []
    const older: RunItem[] = []
    const now = new Date()

    runs.forEach((run) => {
      const runDate = new Date(run.createdAt)
      const diffDays = Math.floor((now.getTime() - runDate.getTime()) / 86400000)

      if (diffDays === 0) {
        today.push(run)
      } else if (diffDays < 7) {
        week.push(run)
      } else {
        older.push(run)
      }
    })

    return { today, week, older }
  }

  const { today, week, older } = groupRunsByDate()

  return (
    <ScrollArea className="flex-1">
      <div className="p-2">
        {loading ? (
          <div className="text-sm text-muted-foreground p-8 text-center">
            <div className="animate-pulse">Loading conversations...</div>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-sidebar-accent flex items-center justify-center">
              <MessageSquare size={30} className="opacity-50 text-sidebar-foreground/40" />
            </div>
            <p className="text-sm text-sidebar-foreground/60">No threads found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {today.length > 0 && (
              <div className="mb-2">
                <div className="px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                  Today
                </div>
                {today.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => onSelectRun(run.id)}
                    className={cn(
                      "w-full text-left p-2 rounded-lg transition-colors overflow-x-hidden flex items-center relative px-0 group/link-item",
                      selectedRunId === run.id
                        ? "bg-sidebar-accent"
                        : "hover:bg-sidebar-accent"
                    )}
                  >
                    <div className="p-2 text-nowrap overflow-hidden w-[95%] truncate px-3">
                      <p className="truncate text-sm text-sidebar-foreground">
                        {truncate(run.userQuery, 40)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {week.length > 0 && (
              <div className="mb-2">
                <div className="px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                  Earlier
                </div>
                {week.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => onSelectRun(run.id)}
                    className={cn(
                      "w-full text-left p-2 rounded-lg transition-colors overflow-x-hidden flex items-center relative px-0 group/link-item",
                      selectedRunId === run.id
                        ? "bg-sidebar-accent"
                        : "hover:bg-sidebar-accent"
                    )}
                  >
                    <div className="p-2 text-nowrap overflow-hidden w-[95%] truncate px-3">
                      <p className="truncate text-sm text-sidebar-foreground">
                        {truncate(run.userQuery, 40)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {older.length > 0 && (
              <div className="mb-2">
                <div className="px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                  Older
                </div>
                {older.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => onSelectRun(run.id)}
                    className={cn(
                      "w-full text-left p-2 rounded-lg transition-colors overflow-x-hidden flex items-center relative px-0 group/link-item",
                      selectedRunId === run.id
                        ? "bg-sidebar-accent"
                        : "hover:bg-sidebar-accent"
                    )}
                  >
                    <div className="p-2 text-nowrap overflow-hidden w-[95%] truncate px-3">
                      <p className="truncate text-sm text-sidebar-foreground">
                        {truncate(run.userQuery, 40)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

