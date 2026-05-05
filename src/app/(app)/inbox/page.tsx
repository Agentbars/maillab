'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ComposeModal from '@/components/ComposeModal'

type InboxItem = {
  id: string
  from: string
  subject: string
  createdAt: string
  hasAttachment: boolean
}

function formatDate(str: string) {
  return new Date(str).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function InboxPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompose, setShowCompose] = useState(false)

  useEffect(() => {
    fetch('/api/inbox')
      .then(r => r.json())
      .then((data: unknown) => { setMessages(data as InboxItem[]); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <button
          onClick={() => setShowCompose(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New mail
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No messages yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">From</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Subject</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-44">Date</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg, i) => (
                <tr
                  key={msg.id}
                  onClick={() => router.push(`/inbox/${msg.id}`)}
                  className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                    i < messages.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{msg.from}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {msg.subject}
                    {msg.hasAttachment && (
                      <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        attachment
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(msg.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} />}
    </div>
  )
}
