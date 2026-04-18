import { useState, useRef, useEffect } from 'react'
import { usePlaylists, createPlaylist, deletePlaylist } from '../hooks/usePlaylists'
import type { Playlist } from '../db'
import { PlusIcon, PlaylistIcon } from './Icons'
import { CoverArt } from './CoverArt'

interface Props {
  onSelect: (playlist: Playlist) => void
}

interface ContextMenu {
  playlist: Playlist
  visible: boolean
}

function PlaylistContextMenu({ playlist, onClose, onDelete }: { playlist: Playlist; onClose: () => void; onDelete: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const close = () => {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  const handleDelete = () => {
    onDelete()
    close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 260ms ease' }}
        onClick={close}
      />

      <div
        className="relative w-full"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <div className="mx-3 mb-2 bg-[#1c1c1e] rounded-2xl overflow-hidden">
          {/* Playlist identity */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8">
            <CoverArt blob={playlist.coverBlob ?? null} size={48} className="rounded-lg shrink-0" />
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{playlist.name}</p>
              <p className="text-gray-400 text-xs">Playlist</p>
            </div>
          </div>

          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-4 px-5 py-4 active:bg-white/5"
          >
            <span className="text-red-400 text-lg w-6 text-center">✕</span>
            <span className="text-red-400 text-sm font-medium">Delete Playlist</span>
          </button>
        </div>

        <button
          onClick={close}
          className="mx-3 w-[calc(100%-1.5rem)] bg-[#1c1c1e] rounded-2xl py-4 text-white font-semibold text-base active:bg-[#2c2c2e] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function PlaylistList({ onSelect }: Props) {
  const playlists = usePlaylists()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

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

  // Long-press detection
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const startLongPress = (pl: Playlist) => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setContextMenu({ playlist: pl, visible: true })
    }, 500)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleTap = (pl: Playlist) => {
    if (didLongPress.current) return
    onSelect(pl)
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
          <div className="flex items-center gap-2 bg-[#2c2c2e] rounded-2xl px-4 py-3">
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
              className="text-[#fc3c44] text-sm font-semibold px-1 disabled:opacity-30 active:opacity-50"
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
              onPointerDown={() => startLongPress(pl)}
              onPointerUp={() => { cancelLongPress(); handleTap(pl) }}
              onPointerCancel={cancelLongPress}
              onPointerLeave={cancelLongPress}
              className="flex items-center gap-4 px-4 py-3 active:bg-white/[0.05] cursor-pointer border-b border-white/[0.05] last:border-0 select-none"
            >
              <div className="shrink-0">
                <CoverArt
                  blob={pl.coverBlob ?? null}
                  size={60}
                  className="rounded-xl shadow"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-[15px] truncate">{pl.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">Playlist</p>
              </div>
            </div>
          ))
        )}
        <div className="h-28" />
      </div>

      {contextMenu && (
        <PlaylistContextMenu
          playlist={contextMenu.playlist}
          onClose={() => setContextMenu(null)}
          onDelete={() => contextMenu.playlist.id != null && deletePlaylist(contextMenu.playlist.id)}
        />
      )}
    </div>
  )
}
