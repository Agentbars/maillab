'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type FolderNode = {
  id: string
  name: string
  isRoot: boolean
  parentId: string | null
  children: FolderNode[]
}

type Message = {
  id: string
  fromEmail: string
  toEmail: string
  subject: string
  body: string
  createdAt: string
  attachment: { filename: string; sizeBytes: number } | null
}

function formatDate(str: string) {
  return new Date(str).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function flattenFolders(nodes: FolderNode[], depth = 0): { folder: FolderNode; depth: number }[] {
  const out: { folder: FolderNode; depth: number }[] = []
  for (const node of nodes) {
    if (node.name === 'Trash' && node.isRoot) continue
    out.push({ folder: node, depth })
    out.push(...flattenFolders(node.children, depth + 1))
  }
  return out
}

export default function MessagePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/messages/${id}`)
      .then(r => {
        if (r.status === 404) { router.push('/inbox'); return null }
        return r.json()
      })
      .then((data: unknown) => {
        if (data) setMessage(data as Message)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, router])

  async function openPicker() {
    setSaveMsg(null)
    setShowPicker(true)
    const res = await fetch('/api/disk/folders')
    setFolders((await res.json()) as FolderNode[])
  }

  async function saveToFolder(folderId: string) {
    setSaving(true)
    const res = await fetch(`/api/messages/${id}/save-to-disk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    })
    const data = await res.json() as { name?: string; error?: string }
    setSaving(false)
    setShowPicker(false)
    setSaveMsg(res.ok ? `Saved as "${data.name}" to Disk.` : `Error: ${data.error}`)
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>
  if (!message) return null

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link href="/inbox" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Inbox
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">{message.subject}</h1>
          <div className="mt-2 space-y-0.5 text-sm text-gray-600">
            <p><span className="text-gray-400 w-10 inline-block">From</span> {message.fromEmail}</p>
            <p><span className="text-gray-400 w-10 inline-block">To</span> {message.toEmail}</p>
            <p><span className="text-gray-400 w-10 inline-block">Date</span> {formatDate(message.createdAt)}</p>
          </div>
        </div>

        <div className="px-6 py-5">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
            {message.body}
          </pre>
        </div>

        {message.attachment && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Attachment</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{message.attachment.filename}</p>
                <p className="text-xs text-gray-500">{formatSize(message.attachment.sizeBytes)}</p>
              </div>
              <a
                href={`/api/messages/${id}/attachment`}
                download
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                Download
              </a>
              <button
                onClick={openPicker}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
              >
                Save to Disk
              </button>
            </div>
            {saveMsg && (
              <p className="mt-2 text-sm text-green-600">{saveMsg}</p>
            )}
          </div>
        )}
      </div>

      {showPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold mb-4">Choose a folder</h2>
            {folders.length === 0 ? (
              <p className="text-sm text-gray-500">Loading folders...</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto space-y-0.5">
                {flattenFolders(folders).map(({ folder, depth }) => (
                  <li key={folder.id}>
                    <button
                      onClick={() => saveToFolder(folder.id)}
                      disabled={saving}
                      style={{ paddingLeft: `${12 + depth * 16}px` }}
                      className="w-full text-left py-2 pr-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {folder.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setShowPicker(false)}
              className="mt-4 w-full py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
