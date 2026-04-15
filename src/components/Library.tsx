import { useState } from 'react'
import { useTracks, deleteTrack, type SortKey } from '../hooks/useTracks'
import type { Track } from '../db'
import { CoverArt } from './CoverArt'
import { XIcon, MusicNoteIcon, AddToPlaylistIcon } from './Icons'
import { AddToPlaylistModal } from './AddToPlaylistModal'

interface Props {
  onPlay: (tracks: Track[], index: number) => void
  currentTrackId?: number
  playing: boolean
}

export function Library({ onPlay, currentTrackId, playing }: Props) {
  const [sort, setSort] = useState<SortKey>('title')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<number | null>(null)
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
      <div className="flex flex-col items-center justify-center flex-1 gap-5 px-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center">
          <MusicNoteIcon size={36} className="text-white/30" />
        </div>
        <div>
          <p className="text-white font-semibold text-lg mb-1">No music yet</p>
          <p className="text-gray-500 text-sm leading-relaxed">
            Tap <span className="text-white font-medium">Add Music</span> to import MP3s from your Files app.
          </p>
          <p className="text-gray-600 text-xs mt-3">
            Requires one online load to install, then works fully offline.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Sort tabs */}
        <div className="flex gap-1 px-4 py-2.5 border-b border-white/5">
          {(['title', 'artist', 'album'] as SortKey[]).map(key => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`text-xs px-3 py-1.5 rounded-full capitalize font-medium transition-colors ${
                sort === key
                  ? 'bg-white/15 text-white'
                  : 'text-white/35 active:bg-white/10'
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
                className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 active:bg-white/5 cursor-pointer ${
                  isActive ? 'bg-white/5' : ''
                }`}
              >
                <CoverArt blob={track.coverBlob} size={48} className="rounded-lg" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate leading-snug">
                    {isActive && playing && (
                      <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1.5 mb-0.5 animate-pulse" />
                    )}
                    {track.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {track.artist}
                    {track.album && track.album !== 'Unknown Album' && (
                      <span className="text-gray-600"> · {track.album}</span>
                    )}
                  </p>
                </div>

                <span className="text-xs text-gray-600 shrink-0 tabular-nums">
                  {formatDuration(track.duration)}
                </span>

                <button
                  onClick={e => { e.stopPropagation(); track.id != null && setAddingTrackId(track.id) }}
                  className="w-7 h-7 flex items-center justify-center text-white/25 active:text-white transition-colors shrink-0"
                  aria-label="Add to playlist"
                >
                  <AddToPlaylistIcon size={18} />
                </button>

                <button
                  onClick={e => track.id != null && handleDelete(e, track.id)}
                  disabled={deletingId === track.id}
                  className="w-7 h-7 flex items-center justify-center text-white/20 active:text-red-400 transition-colors shrink-0"
                  aria-label="Delete track"
                >
                  <XIcon size={14} />
                </button>
              </div>
            )
          })}
          <div className="h-2" />
        </div>
      </div>

      {/* Add to playlist modal */}
      {addingTrackId != null && (
        <AddToPlaylistModal
          trackId={addingTrackId}
          onClose={() => setAddingTrackId(null)}
        />
      )}
    </>
  )
}
