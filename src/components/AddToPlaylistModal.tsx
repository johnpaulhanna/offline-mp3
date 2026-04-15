import { useState } from 'react'
import { usePlaylists, createPlaylist, addTrackToPlaylist } from '../hooks/usePlaylists'
import { XIcon, PlusIcon } from './Icons'

interface Props {
  trackId: number
  onClose: () => void
}

export function AddToPlaylistModal({ trackId, onClose }: Props) {
  const playlists = usePlaylists()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [added, setAdded] = useState<number[]>([])

  const handleAdd = async (playlistId: number) => {
    await addTrackToPlaylist(playlistId, trackId)
    setAdded(prev => [...prev, playlistId])
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const id = await createPlaylist(name)
      await addTrackToPlaylist(id, trackId)
      setAdded(prev => [...prev, id])
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full bg-gray-950 rounded-t-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <p className="text-white font-semibold">Add to Playlist</p>
          <button onClick={onClose} className="text-white/40 w-7 h-7 flex items-center justify-center">
            <XIcon size={16} />
          </button>
        </div>

        {/* Create new */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
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

        {/* Existing playlists */}
        <div className="overflow-y-auto max-h-64">
          {playlists.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-6">No playlists yet</p>
          )}
          {playlists.map(pl => {
            const isAdded = added.includes(pl.id!)
            return (
              <button
                key={pl.id}
                onClick={() => !isAdded && handleAdd(pl.id!)}
                className="w-full flex items-center justify-between px-5 py-3.5 active:bg-white/5 text-left border-b border-white/5 last:border-0"
              >
                <span className="text-white text-sm">{pl.name}</span>
                {isAdded && (
                  <span className="text-green-400 text-xs font-semibold">Added</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
