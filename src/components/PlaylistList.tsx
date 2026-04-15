import { useState } from 'react'
import { usePlaylists, createPlaylist, deletePlaylist } from '../hooks/usePlaylists'
import type { Playlist } from '../db'
import { PlusIcon, TrashIcon, PlaylistIcon } from './Icons'

interface Props {
  onSelect: (playlist: Playlist) => void
}

export function PlaylistList({ onSelect }: Props) {
  const playlists = usePlaylists()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      await createPlaylist(name)
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    await deletePlaylist(id)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* New playlist input */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 shrink-0">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="New playlist name…"
          className="flex-1 bg-gray-800 text-white placeholder-gray-500 text-sm px-3 py-2 rounded-lg outline-none focus:bg-gray-700"
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="bg-white text-black text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-30 active:scale-95 transition-transform flex items-center gap-1"
        >
          <PlusIcon size={14} />
          Create
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center">
              <PlaylistIcon size={36} className="text-white/30" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg mb-1">No playlists</p>
              <p className="text-gray-500 text-sm">Type a name above to create your first playlist.</p>
            </div>
          </div>
        ) : (
          playlists.map(pl => (
            <div
              key={pl.id}
              onClick={() => onSelect(pl)}
              className="flex items-center gap-3 px-4 py-4 border-b border-white/5 active:bg-white/5 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
                <PlaylistIcon size={22} className="text-white/50" />
              </div>
              <p className="text-white font-semibold flex-1 truncate">{pl.name}</p>
              <button
                onClick={e => pl.id != null && handleDelete(e, pl.id)}
                className="w-8 h-8 flex items-center justify-center text-white/20 active:text-red-400 transition-colors shrink-0"
                aria-label="Delete playlist"
              >
                <TrashIcon size={16} />
              </button>
            </div>
          ))
        )}
        <div className="h-2" />
      </div>
    </div>
  )
}
