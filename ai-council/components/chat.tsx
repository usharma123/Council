'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowUp, Loader2, Sparkles, Newspaper, Code, GraduationCap } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  userName?: string
}

export function Chat({ credits, onCreditsUpdate, onNewRun, selectedRunId, userName = 'User' }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<string | null>(null)
  const [streamingPersonas, setStreamingPersonas] = useState<Record<string, PersonaData>>({})
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  const actionButtons = [
    { label: 'Create', value: 'create', icon: <Sparkles /> },
    { label: 'Explore', value: 'explore', icon: <Newspaper /> },
    { label: 'Code', value: 'code', icon: <Code /> },
    { label: 'Learn', value: 'learn', icon: <GraduationCap /> },
  ]

  const presetMessages: { [key: string]: { text: string }[] } = {
    create: [
      { text: 'How to design a logo?' },
      { text: 'Best tools for digital art?' },
      { text: 'Create a poster idea' },
    ],
    explore: [
      { text: 'Top travel destinations in 2025?' },
      { text: 'Interesting facts about space?' },
      { text: 'Wildlife in the Amazon?' },
    ],
    code: [
      { text: 'Learn Python basics?' },
      { text: 'Best practices for JavaScript?' },
      { text: 'Build a simple app?' },
    ],
    learn: [
      { text: 'History of the Internet?' },
      { text: 'Basics of quantum physics?' },
      { text: 'How to learn a new language?' },
    ],
  }

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
    <div className="flex flex-col h-full bg-chat-background relative">
      <div className="flex-1 overflow-y-auto pt-5 md:pt-0">
        <div className="mx-auto flex w-full max-w-3xl flex-col space-y-12 px-4 pb-10 pt-safe-offset-10">
          {messages.length === 0 && (
            <div className="flex h-[calc(100vh-20rem)] items-center justify-center">
              <div className="w-full max-w-2xl space-y-6 px-2 duration-300 animate-in fade-in-50 zoom-in-95 sm:px-8">
                <h2 className="text-2xl md:text-3xl font-semibold text-center">
                  How can I help you, {userName}?
                </h2>
                <Tabs defaultValue="create" className="w-full">
                  <TabsList className="flex p-0 !h-auto justify-center flex-row flex-wrap gap-2.5 text-sm max-sm:justify-evenly bg-transparent">
                    {actionButtons.map((tab, index) => (
                      <TabsTrigger
                        className="justify-center flex-col rounded-xl md:flex-row !h-auto md:h-9 whitespace-nowrap text-sm transition-[opacity, translate-x] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed !max-w-fit disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-9 flex items-center gap-2 md:rounded-full px-3 md:px-5 py-2 font-semibold outline-1 outline-secondary/70 backdrop-blur-xl shadow !border-0 border-reflect button-reflect bg-background hover:bg-accent hover:text-accent-foreground dark:bg-secondary/30 dark:hover:bg-secondary data-[state=active]:bg-[rgb(162,59,103)] data-[state=inactive]:before:!p-0 data-[state=inactive]:text-secondary-foreground data-[state=inactive]:before:!bg-none data-[state=active]:text-primary-foreground data-[state=active]:shadow data-[state=active]:hover:bg-[#d56698] data-[state=active]:active:bg-[rgb(162,59,103)] data-[state=active]:disabled:hover:bg-[rgb(162,59,103)] data-[state=active]:disabled:active:bg-[rgb(162,59,103)] data-[state=active]:dark:bg-primary/20 data-[state=active]:dark:hover:bg-pink-800/70 data-[state=active]:dark:active:bg-pink-800/40 data-[state=active]:disabled:dark:hover:bg-primary/20 data-[state=active]:disabled:dark:active:bg-primary/20"
                        key={index}
                        value={tab.value}
                      >
                        {tab.icon}
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {actionButtons.map((tab) => (
                    <TabsContent className="mt-5" key={tab.value} value={tab.value}>
                      <div className="flex flex-col text-foreground">
                        {presetMessages[tab.value].map((message, index) => (
                          <div
                            key={index}
                            onClick={() => setInput(message.text)}
                            className="flex items-start gap-2 border-t border-secondary/40 py-1 first:border-none"
                          >
                            <button className="w-full rounded-md py-2 text-left text-secondary-foreground hover:bg-secondary/50 sm:px-3">
                              <span>{message.text}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                'space-y-16 animate-fade-in',
                message.role === 'user' ? '' : ''
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {message.role === 'user' ? (
                <div className="flex relative justify-end items-end flex-col duration-300 animate-in fade-in-50 zoom-in-95">
                  <div
                    role="article"
                    aria-label="Your message"
                    className="group inline-block max-w-[80%] break-words rounded-xl border border-secondary/50 bg-secondary/50 p-3.5 px-4 text-left"
                  >
                    <span className="sr-only">Your message: </span>
                    <div className="flex flex-col gap-3">
                      <div className="prose prose-pink max-w-none dark:prose-invert prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0">
                        <p>{message.content || ""}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="group relative w-full max-w-full break-words">
                    <div
                      role="article"
                      aria-label="Assistant message"
                      className="prose prose-pink max-w-none dark:prose-invert prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0"
                    >
                      <span className="sr-only">Assistant Reply: </span>
                      {message.content ? (
                        <div className="mark-response">
                          {message.content && (
                            <div className="mb-5 animate-fade-in">
                              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-100 via-emerald-100 to-green-100 dark:from-green-900/50 dark:via-emerald-900/40 dark:to-green-900/50 rounded-xl text-xs font-bold text-green-800 dark:text-green-200 mb-4 shadow-md shadow-green-200/50 dark:shadow-green-900/30">
                                <span className="text-sm">🏆</span>
                                <span>Winner</span>
                              </div>
                              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-0 prose-headings:mb-3 prose-p:my-3 prose-headings:font-bold prose-strong:font-bold">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex space-x-2 mt-2">
                          <div className="w-2.5 h-2.5 bg-primary/50 rounded-full animate-bounce-dot animate-delay-1"></div>
                          <div className="w-2.5 h-2.5 bg-primary/50 rounded-full animate-bounce-dot animate-delay-2"></div>
                          <div className="w-2.5 h-2.5 bg-primary/50 rounded-full animate-bounce-dot"></div>
                        </div>
                      )}
                    </div>
                    
                    {message.metadata?.personas && message.metadata.personas.length > 0 && (
                      <div className={cn("pt-5", message.content && "border-t border-border/50")}>
                        <h4 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
                          {message.content ? 'All Council Members' : 'Council Members'}
                        </h4>
                        <div className="space-y-3">
                          {message.metadata.personas.map((persona, idx) => {
                            const isWinner = message.metadata?.winnerId === persona.id
                            const votedForName = message.metadata?.personas?.find(p => p.id === persona.vote)?.name || null
                            const hasAnswer = persona.answer && persona.answer.trim() !== ''
                            return (
                              <div
                                key={persona.id}
                                className={cn(
                                  "rounded-xl p-4 border transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.01] animate-fade-in",
                                  isWinner 
                                    ? "bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 dark:from-green-900/40 dark:via-emerald-900/30 dark:to-green-900/40 border-2 border-green-300/50 dark:border-green-700/50 shadow-green-200/50 dark:shadow-green-900/30" 
                                    : "bg-background/70 border-border/60 hover:border-border hover:bg-background/80"
                                )}
                                style={{ animationDelay: `${idx * 50}ms` }}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <h5 className={cn(
                                      "text-sm font-bold",
                                      isWinner && "text-green-700 dark:text-green-300"
                                    )}>
                                      {persona.name}
                                    </h5>
                                    {isWinner && message.content && (
                                      <span className="text-base">👑</span>
                                    )}
                                    {!hasAnswer && (
                                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                    )}
                                  </div>
                                  {persona.vote && votedForName && (
                                    <span className="text-xs px-2 py-1 rounded-md bg-muted/50 text-muted-foreground font-medium">
                                      Voted: {votedForName}
                                    </span>
                                  )}
                                </div>
                                {hasAnswer ? (
                                  <>
                                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-0 prose-headings:mb-1.5 prose-p:my-1.5 mb-3">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {persona.answer}
                                      </ReactMarkdown>
                                    </div>
                                    {persona.vote_explanation && (
                                      <div className="mt-4 pt-4 border-t border-border/50 bg-gradient-to-br from-muted/40 to-muted/20 rounded-xl p-4 -mx-1 shadow-inner">
                                        <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                                          <span>💭</span>
                                          <span>Reasoning</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                          {persona.vote_explanation}
                                        </p>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span className="italic">Thinking...</span>
                                  </div>
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
                </div>
              )}
            </div>
          ))}

          {isLoading && currentPhase && (
            <div className="flex gap-4 justify-start animate-fade-in">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/25 via-primary/15 to-primary/10 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-primary/10">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
              <div className="rounded-2xl px-6 py-4 bg-muted/90 backdrop-blur-md border border-border/60 shadow-lg">
                <p className="text-sm text-muted-foreground font-semibold">{currentPhase}</p>
              </div>
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>
      </div>

      <div className="absolute !bottom-0 h-fit inset-x-0 w-full">
        <div className="rounded-t-[20px] bg-chat-input-background/80 relative dark:bg-secondary/30 p-2 pb-0 backdrop-blur-lg ![--c:--chat-input-gradient] border-x border-secondary-foreground/5 gradBorder">
          <form
            onSubmit={handleSubmit}
            className="relative flex w-full pb-2 flex-col items-stretch gap-2 rounded-t-xl border border-b-0 border-white/70 dark:border-secondary-foreground/5 bg-chat-input-background px-3 pt-3 text-secondary-foreground outline-8 outline-chat-input-gradient/50 dark:outline-chat-input-gradient/5 pb-safe-offset-3 sm:max-w-3xl dark:bg-secondary/30 mx-auto"
            style={{
              boxShadow:
                'rgba(0, 0, 0, 0.1) 0px 80px 50px 0px, rgba(0, 0, 0, 0.07) 0px 50px 30px 0px, rgba(0, 0, 0, 0.06) 0px 30px 15px 0px, rgba(0, 0, 0, 0.04) 0px 15px 8px, rgba(0, 0, 0, 0.04) 0px 6px 4px, rgba(0, 0, 0, 0.02) 0px 2px 2px',
            }}
          >
            <div className="flex flex-grow flex-col">
              <div className="flex flex-grow flex-row items-start">
                <textarea
                  id="chat-input"
                  placeholder="Ask the council a question..."
                  autoFocus
                  value={input}
                  className="w-full max-h-64 min-h-[54px] resize-none bg-transparent text-base leading-6 text-foreground outline-none placeholder:text-secondary-foreground/60 disabled:opacity-50 transition-opacity"
                  aria-label="Message input"
                  aria-describedby="chat-input-description"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                />
                <div id="chat-input-description" className="sr-only">
                  Press Enter to send, Shift + Enter for new line
                </div>
              </div>

              <div className="-mb-px mt-2 flex w-full flex-row-reverse justify-between">
                <div
                  className="-mr-0.5 -mt-0.5 flex items-center justify-center gap-2"
                  aria-label="Message actions"
                >
                  <Button
                    variant="t3"
                    type="submit"
                    size="icon"
                    disabled={isLoading || !input.trim()}
                    className="transition-[opacity, translate-x] h-9 w-9 duration-200"
                  >
                    <ArrowUp className="!size-5" />
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

