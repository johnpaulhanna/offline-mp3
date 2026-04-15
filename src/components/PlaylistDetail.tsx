import { useRef, useState } from 'react'
import { usePlaylistTracks, removeFromPlaylist } from '../hooks/usePlaylists'
import type { Playlist, Track } from '../db'
import { CoverArt } from './CoverArt'
import { ChevronLeftIcon, PlayIcon, ShuffleIcon } from './Icons'
import { TrackContextMenu } from './TrackContextMenu'
import { AddToPlaylistModal } from './AddToPlaylistModal'

interface Props {
  playlist: Playlist
  currentTrackId?: number
  playing: boolean
  onPlay: (tracks: Track[], index: number) => void
  onPlayNext: (track: Track) => void
  onPlayShuffle: (tracks: Track[]) => void
  onBack: () => void
}

export function PlaylistDetail({ playlist, currentTrackId, playing, onPlay, onPlayNext, onPlayShuffle, onBack }: Props) {
  const data = usePlaylistTracks(playlist.id!)
  const tracks = data?.tracks ?? []
  const pts = data?.pts ?? []

  const [contextTrack, setContextTrack] = useState<{ track: Track; idx: number; ptId: number } | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<number | null>(null)

  // Long press state
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpStart = useRef<{ x: number; y: number } | null>(null)
  const lpFired = useRef(false)

  const startLongPress = (e: React.PointerEvent, track: Track, idx: number, ptId: number) => {
    lpFired.current = false
    lpStart.current = { x: e.clientX, y: e.clientY }
    lpTimer.current = setTimeout(() => {
      lpFired.current = true
      if ('vibrate' in navigator) (navigator as Navigator & { vibrate: (d: number) => void }).vibrate(40)
      setContextTrack({ track, idx, ptId })
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

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
          <button onClick={onBack} className="text-white w-9 h-9 flex items-center justify-center active:opacity-50">
            <ChevronLeftIcon size={22} />
          </button>
          <p className="text-white font-bold text-base flex-1 truncate">{playlist.name}</p>
          <span className="text-gray-500 text-xs">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Play / Shuffle */}
        {tracks.length > 0 && (
          <div className="flex gap-3 px-4 py-3 border-b border-white/5 shrink-0">
            <button
              onClick={() => onPlay(tracks, 0)}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-black text-sm font-semibold py-2.5 rounded-2xl active:scale-95 transition-transform"
            >
              <PlayIcon size={16} /> Play All
            </button>
            <button
              onClick={() => onPlayShuffle(tracks)}
              className="flex-1 flex items-center justify-center gap-2 bg-white/10 text-white text-sm font-semibold py-2.5 rounded-2xl active:scale-95 transition-transform"
            >
              <ShuffleIcon size={16} /> Shuffle
            </button>
          </div>
        )}

        {/* Track list */}
        <div className="overflow-y-auto flex-1">
          {tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
              <p className="text-white font-semibold">Empty playlist</p>
              <p className="text-gray-500 text-sm">Go to Songs, hold a track, and tap Add to Playlist.</p>
            </div>
          ) : (
            tracks.map((track, idx) => {
              const isActive = track.id === currentTrackId
              const pt = pts[idx]
              return (
                <div
                  key={pt?.id ?? idx}
                  onClick={() => { if (!lpFired.current) onPlay(tracks, idx) }}
                  onPointerDown={e => startLongPress(e, track, idx, pt?.id ?? 0)}
                  onPointerUp={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onPointerMove={moveLongPress}
                  className={`flex items-center gap-3 mx-3 mb-1.5 px-3 py-3 rounded-2xl cursor-pointer select-none transition-colors ${isActive ? 'bg-white/10' : 'bg-white/[0.05] active:bg-white/10'}`}
                >
                  <CoverArt blob={track.coverBlob} size={48} className="rounded-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-snug">
                      {isActive && playing && (
                        <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1.5 mb-0.5 animate-pulse" />
                      )}
                      {track.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{track.artist}</p>
                  </div>
                  <span className="text-xs text-gray-600 shrink-0 tabular-nums">{formatDuration(track.duration)}</span>
                </div>
              )
            })
          )}
          <div className="h-28" />
        </div>
      </div>

      {/* Context menu */}
      {contextTrack && (
        <TrackContextMenu
          track={contextTrack.track}
          onClose={() => setContextTrack(null)}
          onPlay={() => { onPlay(tracks, contextTrack.idx); setContextTrack(null) }}
          onPlayNext={() => { onPlayNext(contextTrack.track); setContextTrack(null) }}
          onAddToPlaylist={() => { setAddingTrackId(contextTrack.track.id!); setContextTrack(null) }}
          onRemove={async () => { await removeFromPlaylist(contextTrack.ptId); setContextTrack(null) }}
        />
      )}

      {addingTrackId != null && (
        <AddToPlaylistModal trackId={addingTrackId} onClose={() => setAddingTrackId(null)} />
      )}
    </>
  )
}
