import { useState, useEffect } from 'react'
import type { Track } from '../db'
import { CoverArt } from './CoverArt'

interface Props {
  track: Track
  onClose: () => void
  onPlay: () => void
  onPlayNext: () => void
  onAddToQueue: () => void
  onAddToPlaylist: () => void
  onToggleLike: () => void
  onDelete?: () => void   // library: delete from library
  onRemove?: () => void   // playlist: remove from playlist
}

export function TrackContextMenu({
  track, onClose, onPlay, onPlayNext, onAddToQueue,
  onAddToPlaylist, onToggleLike, onDelete, onRemove,
}: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const close = () => {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  const action = (fn: () => void) => () => { fn(); close() }
  const isLiked = !!track.liked

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
        {/* Track identity card */}
        <div className="mx-3 mb-2 bg-gray-900 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8">
            <CoverArt blob={track.coverBlob} size={48} className="rounded-lg shrink-0" />
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{track.title}</p>
              <p className="text-gray-400 text-xs truncate">{track.artist}</p>
            </div>
          </div>

          <button onClick={action(onPlay)} className="w-full flex items-center gap-4 px-5 py-4 active:bg-white/5 border-b border-white/5">
            <span className="text-white text-lg w-6 text-center">▶{'\uFE0E'}</span>
            <span className="text-white text-sm font-medium">Play</span>
          </button>

          <button onClick={action(onPlayNext)} className="w-full flex items-center gap-4 px-5 py-4 active:bg-white/5 border-b border-white/5">
            <span className="text-white text-lg w-6 text-center">⊳</span>
            <span className="text-white text-sm font-medium">Play Next</span>
          </button>

          <button onClick={action(onAddToQueue)} className="w-full flex items-center gap-4 px-5 py-4 active:bg-white/5 border-b border-white/5">
            <span className="text-white text-lg w-6 text-center">⊞</span>
            <span className="text-white text-sm font-medium">Add to Queue</span>
          </button>

          <button onClick={action(onToggleLike)} className="w-full flex items-center gap-4 px-5 py-4 active:bg-white/5 border-b border-white/5">
            <span className={`text-lg w-6 text-center ${isLiked ? 'text-pink-400' : 'text-white'}`}>
              {isLiked ? `♥${'\uFE0E'}` : `♡${'\uFE0E'}`}
            </span>
            <span className="text-white text-sm font-medium">{isLiked ? 'Unlike' : 'Like'}</span>
          </button>

          <button onClick={action(onAddToPlaylist)} className="w-full flex items-center gap-4 px-5 py-4 active:bg-white/5 border-b border-white/5">
            <span className="text-white text-lg w-6 text-center">⊕</span>
            <span className="text-white text-sm font-medium">Add to Playlist</span>
          </button>

          {onDelete && (
            <button onClick={action(onDelete)} className="w-full flex items-center gap-4 px-5 py-4 active:bg-white/5">
              <span className="text-red-400 text-lg w-6 text-center">✕</span>
              <span className="text-red-400 text-sm font-medium">Delete from Library</span>
            </button>
          )}

          {onRemove && (
            <button onClick={action(onRemove)} className="w-full flex items-center gap-4 px-5 py-4 active:bg-white/5">
              <span className="text-red-400 text-lg w-6 text-center">✕</span>
              <span className="text-red-400 text-sm font-medium">Remove from Playlist</span>
            </button>
          )}
        </div>

        <button
          onClick={close}
          className="mx-3 w-[calc(100%-1.5rem)] bg-gray-900 rounded-2xl py-4 text-white font-semibold text-base active:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
