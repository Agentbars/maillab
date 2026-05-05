'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  onClose: () => void
}

export default function ComposeModal({ onClose }: Props) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(() => {
    if (!loading) onClose()
  }, [loading, onClose])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

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
        setStatus({ type: 'ok', text: 'Message sent.' })
        setTo(''); setSubject(''); setBody(''); setFile(null)
        if (fileRef.current) fileRef.current.value = ''
        setTimeout(onClose, 1200)
      } else {
        const msg =
          data.field === 'to'      ? 'Recipient must be a @maillab.local address.' :
          data.field === 'subject' ? 'Subject cannot be empty.' :
          data.error === 'recipient_not_found' ? 'Recipient not found.' :
          data.error === 'cannot_send_to_self'  ? 'Cannot send to yourself.' :
          'Failed to send. Please try again.'
        setStatus({ type: 'err', text: msg })
      }
    } catch {
      setStatus({ type: 'err', text: 'Network error.' })
    }
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">New message</h2>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col divide-y divide-gray-100">
          <div className="flex items-center px-5 py-3 gap-3">
            <label className="text-sm text-gray-400 w-14 flex-shrink-0">To</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@maillab.local"
              required
              autoFocus
              className="flex-1 text-sm outline-none placeholder-gray-300"
            />
          </div>
          <div className="flex items-center px-5 py-3 gap-3">
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
          <div className="px-5 py-3">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={8}
              required
              className="w-full text-sm outline-none resize-none placeholder-gray-300"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 rounded-b-xl gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <input
                ref={fileRef}
                type="file"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="text-xs text-gray-500 max-w-[180px]"
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
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>

        {status && (
          <div className={`px-5 py-3 text-sm border-t ${
            status.type === 'ok'
              ? 'text-green-700 bg-green-50 border-green-100'
              : 'text-red-700 bg-red-50 border-red-100'
          } rounded-b-xl`}>
            {status.text}
          </div>
        )}
      </div>
    </div>
  )
}
