import { useState } from 'react'
import { useTracks, deleteTrack, type SortKey } from '../hooks/useTracks'
import type { Track } from '../db'
import { CoverArt } from './CoverArt'

interface Props {
  onPlay: (tracks: Track[], index: number) => void
  currentTrackId?: number
  playing: boolean
}

export function Library({ onPlay, currentTrackId, playing }: Props) {
  const [sort, setSort] = useState<SortKey>('title')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const tracks = useTracks(sort)

  const formatDuration = (s: number) => {
    if (!s || isNaN(s)) return '--:--'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setDeletingId(id)
    await deleteTrack(id)
    setDeletingId(null)
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6 text-center">
        <div className="text-6xl">🎵</div>
        <p className="text-white font-semibold text-lg">No music yet</p>
        <p className="text-gray-400 text-sm">
          Tap <strong>Add Music</strong> to import MP3 files from your device.
          <br />
          <span className="text-gray-500 text-xs mt-2 block">
            The app must be loaded online once to install. After that it works fully offline.
          </span>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Sort bar */}
      <div className="flex gap-1 px-4 py-2 border-b border-gray-800">
        {(['title', 'artist', 'album'] as SortKey[]).map(key => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`text-xs px-3 py-1 rounded-full capitalize transition-colors ${
              sort === key ? 'bg-white text-black font-semibold' : 'text-gray-400'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Track list */}
      <div className="overflow-y-auto flex-1">
        {tracks.map((track, idx) => {
          const isActive = track.id === currentTrackId
          return (
            <div
              key={track.id}
              onClick={() => onPlay(tracks, idx)}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-900 active:bg-gray-900 cursor-pointer ${
                isActive ? 'bg-gray-900' : ''
              }`}
            >
              <CoverArt blob={track.coverBlob} size={44} />

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isActive ? 'text-green-400' : 'text-white'}`}>
                  {isActive && playing ? '▶ ' : ''}{track.title}
                </p>
                <p className="text-xs text-gray-400 truncate">{track.artist} — {track.album}</p>
              </div>

              <span className="text-xs text-gray-500 shrink-0">{formatDuration(track.duration)}</span>

              <button
                onClick={(e) => track.id != null && handleDelete(e, track.id)}
                disabled={deletingId === track.id}
                className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none ml-1 shrink-0"
                aria-label="Delete track"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
