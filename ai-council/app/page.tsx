'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

interface PersonaResponse {
  id: string
  name: string
  answer: string
  vote: string | null
  vote_explanation: string
}

interface AskResponse {
  answer: string
  voteCounts: Record<string, number>
  personas: PersonaResponse[]
  creditsLeft: number
}

export default function Home() {
  const { isSignedIn } = useUser()
  const [credits, setCredits] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<AskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isSignedIn) {
      fetch('/api/me')
        .then((res) => res.json())
        .then((data) => {
          if (data.credits !== undefined) {
            setCredits(data.credits)
          }
        })
        .catch(console.error)
    }
  }, [isSignedIn])

  const handleAsk = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      if (res.status === 402) {
        const checkoutRes = await fetch('/api/stripe/checkout', {
          method: 'POST',
        })
        const checkoutData = await checkoutRes.json()
        if (checkoutData.url) {
          window.location.href = checkoutData.url
        }
        return
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error')
        return
      }

      const data: AskResponse = await res.json()
      setResponse(data)
      setCredits(data.creditsLeft)
    } catch (err) {
      setError('Failed to ask council')
    } finally {
      setLoading(false)
    }
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">AI Council</h1>
          <p className="text-gray-600">Please sign in to continue.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-4xl font-bold">AI Council</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/personas"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Manage Personas
            </Link>
            <div className="text-lg">
              Credits: <span className="font-semibold">{credits ?? '...'}</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask the council a question..."
            className="w-full p-4 border rounded-lg resize-none"
            rows={4}
          />
          <button
            onClick={handleAsk}
            disabled={loading || !query.trim()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Asking...' : 'Ask Council'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {response && (
          <div className="space-y-6">
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
              <h2 className="text-2xl font-semibold mb-2">Winner</h2>
              <p className="text-gray-800 whitespace-pre-wrap">{response.answer}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Vote Counts</h3>
              <div className="space-y-1">
                {Object.entries(response.voteCounts).map(([key, count]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">All Responses</h3>
              {response.personas.map((persona) => (
                <div
                  key={persona.id}
                  className="p-4 border rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{persona.name}</h4>
                    {persona.vote && (
                      <span className="text-sm text-gray-600">
                        Voted for: {persona.vote}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap mb-2">
                    {persona.answer}
                  </p>
                  {persona.vote_explanation && (
                    <p className="text-sm text-gray-500 italic">
                      {persona.vote_explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
