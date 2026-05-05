'use client'
import { useEffect, useState, useCallback } from 'react'

type FolderNode = {
  id: string
  name: string
  isRoot: boolean
  parentId: string | null
  children: FolderNode[]
}

type DiskFile = {
  id: string
  name: string
  sizeBytes: number
  createdAt: string
  deletedAt: string | null
}

function findInTree(nodes: FolderNode[], pred: (n: FolderNode) => boolean): FolderNode | null {
  for (const node of nodes) {
    if (pred(node)) return node
    const found = findInTree(node.children, pred)
    if (found) return found
  }
  return null
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FolderItem({
  node,
  selectedId,
  onSelect,
  dragOverId,
  setDragOver,
  onDrop,
}: {
  node: FolderNode
  selectedId: string | null
  onSelect: (f: FolderNode) => void
  dragOverId: string | null
  setDragOver: (id: string | null) => void
  onDrop: (folder: FolderNode) => void
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0
  const isDragOver = dragOverId === node.id

  return (
    <li>
      <div
        onClick={() => onSelect(node)}
        onDragOver={e => { e.preventDefault(); setDragOver(node.id) }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(null)
          }
        }}
        onDrop={e => { e.preventDefault(); setDragOver(null); onDrop(node) }}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer select-none transition-all ${
          isDragOver
            ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset text-blue-700'
            : selectedId === node.id
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <span
          className="w-4 flex-shrink-0 text-center text-xs text-gray-400"
          onClick={e => { e.stopPropagation(); if (hasChildren) setOpen(o => !o) }}
        >
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </span>
        <span className="text-sm truncate">{node.name}</span>
      </div>
      {open && hasChildren && (
        <ul className="ml-3 mt-0.5 space-y-0.5">
          {node.children.map(child => (
            <FolderItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              dragOverId={dragOverId}
              setDragOver={setDragOver}
              onDrop={onDrop}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function DiskPage() {
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [selected, setSelected] = useState<FolderNode | null>(null)
  const [files, setFiles] = useState<DiskFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [draggedFile, setDraggedFile] = useState<DiskFile | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  const loadFolders = useCallback(async () => {
    const res = await fetch('/api/disk/folders')
    setFolders((await res.json()) as FolderNode[])
  }, [])

  const loadFiles = useCallback(async (folderId: string) => {
    setFilesLoading(true)
    setFiles([])
    const res = await fetch(`/api/disk/folders/${folderId}/files`)
    setFiles((await res.json()) as DiskFile[])
    setFilesLoading(false)
  }, [])

  useEffect(() => { loadFolders() }, [loadFolders])

  function selectFolder(f: FolderNode) {
    setSelected(f)
    setStatus(null)
    setShowNewFolder(false)
    setNewFolderName('')
    loadFiles(f.id)
  }

  async function createFolder() {
    if (!selected || !newFolderName.trim()) return
    const res = await fetch('/api/disk/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim(), parentId: selected.id }),
    })
    if (res.ok) {
      setNewFolderName('')
      setShowNewFolder(false)
      setStatus({ type: 'ok', text: 'Folder created.' })
      await loadFolders()
    } else {
      const data = (await res.json()) as { error: string }
      setStatus({ type: 'err', text: data.error === 'cannot_nest_in_trash' ? 'Cannot create folder inside Trash.' : data.error })
    }
  }

  async function deleteFolder() {
    if (!selected) return
    const res = await fetch(`/api/disk/folders/${selected.id}`, { method: 'DELETE' })
    if (res.status === 204) {
      setStatus({ type: 'ok', text: 'Folder deleted.' })
      setSelected(null)
      setFiles([])
      await loadFolders()
    } else {
      const data = (await res.json()) as { error: string }
      setStatus({ type: 'err', text: data.error === 'folder_not_empty' ? 'Folder must be empty before deleting.' : data.error })
    }
  }

  async function moveToTrash(fileId: string) {
    const trash = findInTree(folders, n => n.name === 'Trash' && n.isRoot)
    if (!trash) return
    const res = await fetch(`/api/disk/files/${fileId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetFolderId: trash.id }),
    })
    if (res.ok) {
      setStatus({ type: 'ok', text: 'Moved to Trash.' })
      if (selected) loadFiles(selected.id)
    } else {
      setStatus({ type: 'err', text: 'Failed to move to Trash.' })
    }
  }

  async function restore(fileId: string) {
    const res = await fetch(`/api/disk/files/${fileId}/restore`, { method: 'POST' })
    if (res.ok) {
      setStatus({ type: 'ok', text: 'File restored.' })
      if (selected) loadFiles(selected.id)
    } else {
      setStatus({ type: 'err', text: 'Failed to restore file.' })
    }
  }

  function download(fileId: string) {
    window.open(`/api/disk/files/${fileId}/download`, '_blank')
  }

  async function handleDropOnFolder(targetFolder: FolderNode) {
    if (!draggedFile) return
    setDraggedFile(null)
    setStatus(null)

    // No-op: dropping onto the folder already containing the file
    if (targetFolder.id === selected?.id) return

    // Files in Trash can only be restored (API doesn't allow moving to a specific target)
    if (draggedFile.deletedAt !== null) {
      await restore(draggedFile.id)
      return
    }

    const res = await fetch(`/api/disk/files/${draggedFile.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetFolderId: targetFolder.id }),
    })
    if (res.ok) {
      const isTargetTrash = targetFolder.name === 'Trash' && targetFolder.isRoot
      setStatus({ type: 'ok', text: isTargetTrash ? 'Moved to Trash.' : `Moved to "${targetFolder.name}".` })
      if (selected) loadFiles(selected.id)
    } else {
      setStatus({ type: 'err', text: 'Failed to move file.' })
    }
  }

  const isTrash = selected?.name === 'Trash' && selected?.isRoot === true

  return (
    <div className="flex h-full">
      {/* Folder tree */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-gray-200 p-3 overflow-y-auto">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-3 mb-2">Folders</p>
        <ul className="space-y-0.5">
          {folders.map(f => (
            <FolderItem
              key={f.id}
              node={f}
              selectedId={selected?.id ?? null}
              onSelect={selectFolder}
              dragOverId={dragOverFolderId}
              setDragOver={setDragOverFolderId}
              onDrop={handleDropOnFolder}
            />
          ))}
        </ul>
      </div>

      {/* File panel */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!selected ? (
          <div className="text-center py-20 text-sm text-gray-400">
            Select a folder to view files.
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">{selected.name}</h2>
              <div className="flex gap-2">
                {!isTrash && (
                  <button
                    onClick={() => { setShowNewFolder(s => !s); setStatus(null) }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    New folder
                  </button>
                )}
                {!selected.isRoot && (
                  <button
                    onClick={deleteFolder}
                    className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete folder
                  </button>
                )}
              </div>
            </div>

            {/* New folder input */}
            {showNewFolder && (
              <div className="mb-4 flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createFolder()}
                  placeholder="Folder name"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={createFolder}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowNewFolder(false); setNewFolderName('') }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Status message */}
            {status && (
              <p className={`mb-3 text-sm ${status.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                {status.text}
              </p>
            )}

            {/* Drag hint */}
            {files.length > 0 && !isTrash && (
              <p className="mb-3 text-xs text-gray-400">
                Drag files onto a folder in the left panel to move them.
              </p>
            )}

            {/* File list */}
            {filesLoading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : files.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">
                {isTrash ? 'Trash is empty.' : 'No files here yet.'}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">Size</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">
                        {isTrash ? 'Deleted' : 'Added'}
                      </th>
                      <th className="px-4 py-3 w-36"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, i) => (
                      <tr
                        key={file.id}
                        draggable
                        onDragStart={() => setDraggedFile(file)}
                        onDragEnd={() => { setDraggedFile(null); setDragOverFolderId(null) }}
                        className={`transition-opacity ${
                          draggedFile?.id === file.id ? 'opacity-40' : 'opacity-100'
                        } ${i < files.length - 1 ? 'border-b border-gray-100' : ''}`}
                      >
                        <td className="px-4 py-3 text-gray-900 font-medium cursor-grab">
                          {file.name}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatSize(file.sizeBytes)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {formatDate(isTrash ? file.deletedAt! : file.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            {isTrash ? (
                              <button
                                onClick={() => restore(file.id)}
                                className="px-2.5 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                              >
                                Restore
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => download(file.id)}
                                  className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  Download
                                </button>
                                <button
                                  onClick={() => moveToTrash(file.id)}
                                  className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                  Trash
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
