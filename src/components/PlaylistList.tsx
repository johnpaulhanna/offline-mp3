import { useState } from 'react'
import { usePlaylists, createPlaylist, deletePlaylist } from '../hooks/usePlaylists'
import type { Playlist } from '../db'
import { PlusIcon, TrashIcon, PlaylistIcon } from './Icons'
import { CoverArt } from './CoverArt'

interface Props {
  onSelect: (playlist: Playlist) => void
}

export function PlaylistList({ onSelect }: Props) {
  const playlists = usePlaylists()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [processing, setProcessing] = useState(false)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setProcessing(true)
    try {
      await createPlaylist(name)
      setNewName('')
      setCreating(false)
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    await deletePlaylist(id)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <p className="text-white text-2xl font-bold tracking-tight">Playlists</p>
        <button
          onClick={() => { setCreating(true); setNewName('') }}
          className="w-9 h-9 flex items-center justify-center text-white bg-white/10 rounded-full active:opacity-50 transition-opacity"
          aria-label="New playlist"
        >
          <PlusIcon size={18} />
        </button>
      </div>

      {/* New playlist input */}
      {creating && (
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 bg-gray-800 rounded-2xl px-4 py-3">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setCreating(false)
              }}
              placeholder="Playlist name…"
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
            />
            <button
              onClick={() => setCreating(false)}
              className="text-gray-400 text-sm px-1 active:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || processing}
              className="text-blue-400 text-sm font-semibold px-1 disabled:opacity-30 active:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {playlists.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center">
              <PlaylistIcon size={36} className="text-white/30" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg mb-1">No playlists</p>
              <p className="text-gray-500 text-sm">Tap + to create your first playlist.</p>
            </div>
          </div>
        ) : (
          playlists.map(pl => (
            <div
              key={pl.id}
              onClick={() => onSelect(pl)}
              className="flex items-center gap-4 px-4 py-3 active:bg-white/[0.05] cursor-pointer border-b border-white/[0.05] last:border-0"
            >
              {/* Artwork */}
              <div className="shrink-0">
                <CoverArt
                  blob={pl.coverBlob ?? null}
                  size={60}
                  className="rounded-xl shadow"
                />
              </div>

              {/* Name + subtitle */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-[15px] truncate">{pl.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">Playlist</p>
              </div>

              {/* Delete */}
              <button
                onClick={e => pl.id != null && handleDelete(e, pl.id)}
                className="w-8 h-8 flex items-center justify-center text-white/[0.15] active:text-red-400 transition-colors shrink-0"
                aria-label="Delete playlist"
              >
                <TrashIcon size={15} />
              </button>
            </div>
          ))
        )}
        <div className="h-28" />
      </div>
    </div>
  )
}
