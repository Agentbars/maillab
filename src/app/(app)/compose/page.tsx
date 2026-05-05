'use client'
import { useState, useRef } from 'react'

export default function ComposePage() {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)

    const form = new FormData()
    form.append('to', to)
    form.append('subject', subject)
    form.append('body', body)
    if (file) form.append('attachment', file)

    try {
      const res = await fetch('/api/messages', { method: 'POST', body: form })
      const data = await res.json() as { error?: string; field?: string }
      if (res.ok) {
        setStatus({ type: 'ok', text: 'Message sent successfully.' })
        setTo(''); setSubject(''); setBody(''); setFile(null)
        if (fileRef.current) fileRef.current.value = ''
      } else {
        const msg =
          data.field === 'to'      ? 'Recipient must be a @maillab.local address.' :
          data.field === 'subject' ? 'Subject cannot be empty.' :
          data.error === 'recipient_not_found' ? 'Recipient not found. Are they registered?' :
          data.error === 'cannot_send_to_self'  ? 'You cannot send a message to yourself.' :
          'Failed to send. Please try again.'
        setStatus({ type: 'err', text: msg })
      }
    } catch {
      setStatus({ type: 'err', text: 'Network error. Please try again.' })
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Compose</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-gray-100">
          <div className="flex items-center px-4 py-3 gap-4">
            <label className="text-sm text-gray-400 w-14 flex-shrink-0">To</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@maillab.local"
              required
              className="flex-1 text-sm outline-none placeholder-gray-300"
            />
          </div>
          <div className="flex items-center px-4 py-3 gap-4">
            <label className="text-sm text-gray-400 w-14 flex-shrink-0">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              required
              className="flex-1 text-sm outline-none placeholder-gray-300"
            />
          </div>
          <div className="px-4 py-3">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={12}
              required
              className="w-full text-sm outline-none resize-none placeholder-gray-300"
            />
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <input
                ref={fileRef}
                type="file"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="text-xs text-gray-600 max-w-xs"
              />
              {file && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
      {status && (
        <p className={`mt-3 text-sm ${status.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
          {status.text}
        </p>
      )}
    </div>
  )
}
