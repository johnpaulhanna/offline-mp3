import { useRef, useState } from 'react'
import { useTracks, deleteTrack, type SortKey } from '../hooks/useTracks'
import type { Track } from '../db'
import { CoverArt } from './CoverArt'
import { MusicNoteIcon } from './Icons'
import { AddToPlaylistModal } from './AddToPlaylistModal'
import { TrackContextMenu } from './TrackContextMenu'

interface Props {
  onPlay: (tracks: Track[], index: number) => void
  onPlayNext: (track: Track) => void
  currentTrackId?: number
  playing: boolean
}

export function Library({ onPlay, onPlayNext, currentTrackId, playing }: Props) {
  const [sort, setSort] = useState<SortKey>('title')
  const [search, setSearch] = useState('')
  const [contextTrack, setContextTrack] = useState<{ track: Track; idx: number; all: Track[] } | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<number | null>(null)

  const allTracks = useTracks(sort)
  const tracks = search.trim()
    ? allTracks.filter(t =>
        [t.title, t.artist, t.album].some(f =>
          f.toLowerCase().includes(search.toLowerCase())
        )
      )
    : allTracks

  // Long press state
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpStart = useRef<{ x: number; y: number } | null>(null)
  const lpFired = useRef(false)

  const startLongPress = (e: React.PointerEvent, track: Track, idx: number) => {
    lpFired.current = false
    lpStart.current = { x: e.clientX, y: e.clientY }
    lpTimer.current = setTimeout(() => {
      lpFired.current = true
      if ('vibrate' in navigator) (navigator as Navigator & { vibrate: (d: number) => void }).vibrate(40)
      setContextTrack({ track, idx, all: tracks })
    }, 500)
  }

  const cancelLongPress = () => {
    if (lpTimer.current) clearTimeout(lpTimer.current)
    lpStart.current = null
  }

  const moveLongPress = (e: React.PointerEvent) => {
    if (!lpStart.current) return
    const dx = e.clientX - lpStart.current.x
    const dy = e.clientY - lpStart.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 10) cancelLongPress()
  }

  const formatDuration = (s: number) => {
    if (!s || isNaN(s)) return '--:--'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (allTracks.length === 0) {
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
        {/* Search */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search songs, artists, albums…"
            className="w-full bg-gray-800 text-white placeholder-gray-500 text-sm px-4 py-2.5 rounded-xl outline-none"
          />
        </div>

        {/* Sort tabs */}
        <div className="flex gap-1 px-4 pb-2 shrink-0">
          {(['title', 'artist', 'album'] as SortKey[]).map(key => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`text-xs px-3 py-1.5 rounded-full capitalize font-medium transition-colors ${
                sort === key ? 'bg-white/15 text-white' : 'text-white/35 active:bg-white/10'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Track list */}
        <div className="overflow-y-auto flex-1">
          {tracks.length === 0 && search ? (
            <p className="text-gray-500 text-sm text-center mt-12">No results for "{search}"</p>
          ) : (
            tracks.map((track, idx) => {
              const isActive = track.id === currentTrackId
              return (
                <div
                  key={track.id}
                  onClick={() => { if (!lpFired.current) onPlay(tracks, idx) }}
                  onPointerDown={e => startLongPress(e, track, idx)}
                  onPointerUp={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onPointerMove={moveLongPress}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 active:bg-white/5 cursor-pointer select-none ${
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
                </div>
              )
            })
          )}
          <div className="h-2" />
        </div>
      </div>

      {/* Context menu */}
      {contextTrack && (
        <TrackContextMenu
          track={contextTrack.track}
          onClose={() => setContextTrack(null)}
          onPlay={() => { onPlay(contextTrack.all, contextTrack.idx); setContextTrack(null) }}
          onPlayNext={() => { onPlayNext(contextTrack.track); setContextTrack(null) }}
          onAddToPlaylist={() => { setAddingTrackId(contextTrack.track.id!); setContextTrack(null) }}
          onDelete={async () => { await deleteTrack(contextTrack.track.id!); setContextTrack(null) }}
        />
      )}

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
