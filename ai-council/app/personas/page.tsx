'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

interface Persona {
  id: string
  name: string
  systemPrompt: string
  status: string
}

export default function PersonasPage() {
  const { isSignedIn } = useUser()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isSignedIn) {
      fetchPersonas()
    }
  }, [isSignedIn])

  const fetchPersonas = async () => {
    try {
      const res = await fetch('/api/personas')
      if (res.ok) {
        const data = await res.json()
        setPersonas(data)
      }
    } catch (error) {
      console.error('Failed to fetch personas', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      const res = await fetch(`/api/personas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        fetchPersonas()
      }
    } catch (error) {
      console.error('Failed to update persona', error)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !systemPrompt.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, systemPrompt }),
      })
      if (res.ok) {
        setName('')
        setSystemPrompt('')
        fetchPersonas()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to create persona')
      }
    } catch (error) {
      alert('Failed to create persona')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Personas</h1>
          <p className="text-gray-600">Please sign in to continue.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/"
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            ← Back to Council
          </Link>
          <h1 className="text-4xl font-bold">Personas</h1>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Create New Persona</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full p-2 border rounded resize-none"
                rows={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Persona'}
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">All Personas</h2>
          {loading ? (
            <p>Loading...</p>
          ) : personas.length === 0 ? (
            <p className="text-gray-600">No personas yet.</p>
          ) : (
            <div className="space-y-4">
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  className="p-4 border rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-semibold">{persona.name}</h3>
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded ${
                          persona.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {persona.status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleStatus(persona.id, persona.status)}
                      className={`px-4 py-2 rounded ${
                        persona.status === 'active'
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {persona.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">
                    {persona.systemPrompt}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

