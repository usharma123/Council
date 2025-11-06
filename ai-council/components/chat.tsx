'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface PersonaData {
  id: string
  name: string
  answer: string
  vote: string | null
  vote_explanation: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    phase?: string
    personaId?: string
    personaName?: string
    voteCounts?: Record<string, number>
    winnerId?: string
    personas?: PersonaData[]
  }
}

interface ChatProps {
  credits: number | null
  onCreditsUpdate: (credits: number) => void
  onNewRun: () => void
  selectedRunId?: string | null
}

export function Chat({ credits, onCreditsUpdate, onNewRun, selectedRunId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<string | null>(null)
  const [streamingPersonas, setStreamingPersonas] = useState<Record<string, PersonaData>>({})
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingPersonas])

  // Load selected run when selectedRunId changes
  useEffect(() => {
    if (selectedRunId) {
      loadRun(selectedRunId)
    } else {
      // Clear messages when starting new chat
      setMessages([])
      setStreamingPersonas({})
      setVoteCounts({})
    }
  }, [selectedRunId])

  const loadRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}`)
      if (!res.ok) return

      const data = await res.json()
      
      // Create messages from the run data
      const userMessage: Message = {
        id: `${runId}-user`,
        role: 'user',
        content: data.userQuery,
        timestamp: new Date(data.createdAt),
      }

      const assistantMessage: Message = {
        id: `${runId}-assistant`,
        role: 'assistant',
        content: data.winnerAnswer,
        timestamp: new Date(data.createdAt),
        metadata: {
          voteCounts: data.voteCounts,
          winnerId: data.winnerId,
          personas: data.personas || [],
        },
      }

      setMessages([userMessage, assistantMessage])
    } catch (error) {
      console.error('Failed to load run', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // Clear selected run when starting a new conversation
    if (selectedRunId) {
      // This will be handled by parent component
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setCurrentPhase(null)
    setStreamingPersonas({})
    setVoteCounts({})
    
    // Create initial assistant message for streaming
    const assistantMessageId = (Date.now() + 1).toString()
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        metadata: {
          personas: [],
        },
      },
    ])

    try {
      const response = await fetch('/api/ask/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content }),
      })

      if (response.status === 402) {
        const checkoutRes = await fetch('/api/stripe/checkout', {
          method: 'POST',
        })
        const checkoutData = await checkoutRes.json()
        if (checkoutData.url) {
          window.location.href = checkoutData.url
        }
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        const data = await response.json()
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: `Error: ${data.error || 'Failed to get response'}`,
                }
              : msg
          )
        )
        setIsLoading(false)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let winnerId: string | null = null
      let finalAnswer = ''

      if (!reader) {
        setIsLoading(false)
        return
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'phase') {
                setCurrentPhase(data.message)
              } else if (data.type === 'answer') {
                // Add or update persona answer
                setStreamingPersonas((prev) => {
                  const updated = {
                    ...prev,
                    [data.personaId]: {
                      id: data.personaId,
                      name: data.personaName,
                      answer: data.answer,
                      vote: null,
                      vote_explanation: '',
                    },
                  }
                  // Update message with current personas
                  setTimeout(() => {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              metadata: {
                                ...msg.metadata,
                                personas: Object.values(updated),
                              },
                            }
                          : msg
                      )
                    )
                  }, 0)
                  return updated
                })
              } else if (data.type === 'vote') {
                // Update persona with vote information
                setStreamingPersonas((prev) => {
                  if (!prev[data.personaId]) return prev
                  const updated = {
                    ...prev,
                    [data.personaId]: {
                      ...prev[data.personaId],
                      vote: data.votedFor,
                      vote_explanation: data.voteExplanation || '',
                    },
                  }
                  // Update message with current personas
                  setTimeout(() => {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              metadata: {
                                ...msg.metadata,
                                personas: Object.values(updated),
                              },
                            }
                          : msg
                      )
                    )
                  }, 0)
                  return updated
                })
              } else if (data.type === 'winner') {
                winnerId = data.winnerId
                setVoteCounts(data.voteCounts || {})
                setStreamingPersonas((prev) => {
                  setTimeout(() => {
                    setMessages((prevMsgs) =>
                      prevMsgs.map((msg) =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              metadata: {
                                ...msg.metadata,
                                voteCounts: data.voteCounts,
                                winnerId: data.winnerId,
                                personas: Object.values(prev),
                              },
                            }
                          : msg
                      )
                    )
                  }, 0)
                  return prev
                })
              } else if (data.type === 'complete') {
                finalAnswer = data.answer
                onCreditsUpdate(data.creditsLeft)
                onNewRun() // This will trigger history refresh
                
                // Final update with complete data
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          content: finalAnswer,
                          metadata: {
                            voteCounts: data.voteCounts,
                            winnerId: data.winnerId,
                            personas: data.personas || [],
                          },
                        }
                      : msg
                  )
                )
                setIsLoading(false)
                setCurrentPhase(null)
                
                // Auto-select the new run
                if (data.runId) {
                  // This will be handled by parent component via onNewRun callback
                }
              } else if (data.type === 'error') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          content: `Error: ${data.error}`,
                        }
                      : msg
                  )
                )
                setIsLoading(false)
                setCurrentPhase(null)
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Failed to get response from council',
          timestamp: new Date(),
        },
      ])
      setIsLoading(false)
      setCurrentPhase(null)
    }
  }

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <h2 className="text-2xl font-semibold mb-2 text-foreground">AI Council</h2>
              <p className="text-sm">Ask a question and get answers from multiple AI personas</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-xs font-semibold text-primary">AI</span>
                </div>
              )}
              <div
                className={cn(
                  'rounded-lg px-4 py-3 max-w-[80%] shadow-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {message.role === 'assistant' ? (
                  <div>
                    {message.content && (
                      <div className="mb-3">
                        <div className="inline-flex items-center gap-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-xs font-semibold text-green-800 dark:text-green-200 mb-2">
                          🏆 Winner
                        </div>
                        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-0 prose-headings:mb-2 prose-p:my-2">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                    
                    {message.metadata?.personas && message.metadata.personas.length > 0 && (
                      <div className={cn("pt-4", message.content && "border-t border-border/50")}>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                          {message.content ? 'All Council Members' : 'Council Members'}
                        </h4>
                        <div className="space-y-4">
                          {message.metadata.personas.map((persona) => {
                            const isWinner = message.metadata?.winnerId === persona.id
                            const votedForName = message.metadata?.personas?.find(p => p.id === persona.vote)?.name || null
                            const hasAnswer = persona.answer && persona.answer.trim() !== ''
                            return (
                              <div
                                key={persona.id}
                                className={cn(
                                  "rounded-lg p-3 border transition-all",
                                  isWinner 
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
                                    : "bg-background border-border"
                                )}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h5 className={cn(
                                    "text-sm font-semibold",
                                    isWinner && "text-green-700 dark:text-green-300"
                                  )}>
                                    {persona.name}
                                    {isWinner && message.content && (
                                      <span className="ml-2 text-xs">👑</span>
                                    )}
                                    {!hasAnswer && (
                                      <Loader2 className="ml-2 w-3 h-3 inline animate-spin text-muted-foreground" />
                                    )}
                                  </h5>
                                  {persona.vote && votedForName && (
                                    <span className="text-xs text-muted-foreground">
                                      Voted: {votedForName}
                                    </span>
                                  )}
                                </div>
                                {hasAnswer ? (
                                  <>
                                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-0 prose-headings:mb-1 prose-p:my-1 mb-2">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {persona.answer}
                                      </ReactMarkdown>
                                    </div>
                                    {persona.vote_explanation && (
                                      <div className="mt-2 pt-2 border-t border-border/50">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">
                                          Reasoning:
                                        </p>
                                        <p className="text-xs text-muted-foreground italic">
                                          {persona.vote_explanation}
                                        </p>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">
                                    Thinking...
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {message.metadata?.voteCounts && Object.keys(message.metadata.voteCounts).length > 0 && (
                          <div className="mt-4 pt-3 border-t border-border/50">
                            <p className="text-xs text-muted-foreground">
                              Total votes: {Object.values(message.metadata.voteCounts).reduce((a, b) => a + b, 0)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-xs font-semibold text-primary-foreground">U</span>
                </div>
              )}
            </div>
          ))}

          {isLoading && currentPhase && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
              <div className="rounded-lg px-4 py-3 bg-muted shadow-sm">
                <p className="text-sm text-muted-foreground">{currentPhase}</p>
              </div>
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="border-t p-4 bg-background">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the council..."
            disabled={isLoading}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

