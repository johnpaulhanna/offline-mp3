import { useState, useMemo } from 'react'
import { useTracks } from '../hooks/useTracks'
import type { Track } from '../db'
import { CoverArt } from './CoverArt'
import { TrackContextMenu } from './TrackContextMenu'
import { AddToPlaylistModal } from './AddToPlaylistModal'
import { ConfirmDialog } from './ConfirmDialog'
import { deleteTrack, toggleLike } from '../hooks/useTracks'
import { useRef } from 'react'

interface Props {
  onPlay: (tracks: Track[], index: number) => void
  onPlayAndOpen: (tracks: Track[], index: number) => void
  onPlayNext: (track: Track) => void
  onAddToQueue: (track: Track) => void
  currentTrackId?: number
  playing: boolean
}

interface ArtistGroup {
  name: string
  tracks: Track[]
}

export function ArtistsView({ onPlay, onPlayAndOpen, onPlayNext, onAddToQueue, currentTrackId, playing }: Props) {
  const allTracks = useTracks('artist')
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
  const [contextTrack, setContextTrack] = useState<{ track: Track; idx: number; all: Track[] } | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<number | null>(null)
  // Deleting a track destroys the only copy of the audio; ask first.
  const [confirmingDelete, setConfirmingDelete] = useState<Track | null>(null)

  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpStart = useRef<{ x: number; y: number } | null>(null)
  const lpFired = useRef(false)

  const startLP = (e: React.PointerEvent, track: Track, idx: number, all: Track[]) => {
    lpFired.current = false
    lpStart.current = { x: e.clientX, y: e.clientY }
    lpTimer.current = setTimeout(() => {
      lpFired.current = true
      if ('vibrate' in navigator) (navigator as Navigator & { vibrate: (d: number) => void }).vibrate(40)
      setContextTrack({ track, idx, all })
    }, 500)
  }

  const cancelLP = () => {
    if (lpTimer.current) clearTimeout(lpTimer.current)
    lpStart.current = null
  }

  const moveLP = (e: React.PointerEvent) => {
    if (!lpStart.current) return
    const dx = e.clientX - lpStart.current.x
    const dy = e.clientY - lpStart.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 10) cancelLP()
  }

  const formatDuration = (s: number) => {
    if (!s || isNaN(s)) return '--:--'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Memoised: without this the whole library is regrouped on every render, and
  // the player's position ticks re-render this view several times a second.
  const artistMap = useMemo(() => {
    const map = new Map<string, Track[]>()
    for (const track of allTracks) {
      const a = track.artist || 'Unknown Artist'
      if (!map.has(a)) map.set(a, [])
      map.get(a)!.push(track)
    }
    return map
  }, [allTracks])
  const artists: ArtistGroup[] = useMemo(
    () => Array.from(artistMap.entries()).map(([name, tracks]) => ({ name, tracks })),
    [artistMap]
  )

  // Falls through to the list when the artist is gone — deleting their last
  // track used to strand you on an empty detail page.
  const artistTracks = selectedArtist ? artistMap.get(selectedArtist) : undefined
  if (selectedArtist && artistTracks) {
    return (
      <>
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b border-white/[0.06]">
            <button
              onClick={() => setSelectedArtist(null)}
              className="text-[#fc3c44] text-sm font-medium active:opacity-50"
            >
              ‹ Artists
            </button>
            <p className="text-white font-bold flex-1 truncate">{selectedArtist}</p>
            <p className="text-white/40 text-xs">{artistTracks.length} {artistTracks.length === 1 ? 'song' : 'songs'}</p>
          </div>
          <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {artistTracks.map((track, idx) => {
              const isActive = track.id === currentTrackId
              return (
                <div
                  key={track.id}
                  onClick={() => { if (!lpFired.current) onPlay(artistTracks, idx) }}
                  onPointerDown={e => startLP(e, track, idx, artistTracks)}
                  onPointerUp={cancelLP}
                  onPointerCancel={cancelLP}
                  onPointerMove={moveLP}
                  className={`flex items-center gap-3 mx-3 mb-1.5 px-3 py-3 rounded-2xl cursor-pointer select-none transition-colors ${isActive ? 'bg-white/10' : 'bg-white/[0.05] active:bg-white/10'}`}
                >
                  <CoverArt blob={track.coverBlob} size={44} className="rounded-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-snug">
                      {isActive && playing && (
                        <span className="inline-block w-2 h-2 rounded-full bg-[#fc3c44] mr-1.5 mb-0.5 animate-pulse" />
                      )}
                      {track.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{track.album}</p>
                  </div>
                  <span className="text-xs text-gray-600 shrink-0 tabular-nums">{formatDuration(track.duration)}</span>
                </div>
              )
            })}
            <div className="h-28" />
          </div>
        </div>

        {contextTrack && (
          <TrackContextMenu
            track={contextTrack.track}
            onClose={() => setContextTrack(null)}
            onPlay={() => { onPlayAndOpen(contextTrack.all, contextTrack.idx); setContextTrack(null) }}
            onPlayNext={() => { onPlayNext(contextTrack.track); setContextTrack(null) }}
            onAddToQueue={() => { onAddToQueue(contextTrack.track); setContextTrack(null) }}
            onAddToPlaylist={() => { setAddingTrackId(contextTrack.track.id!); setContextTrack(null) }}
            onToggleLike={async () => { await toggleLike(contextTrack.track.id!); setContextTrack(null) }}
            onDelete={() => { const t = contextTrack.track; setContextTrack(null); setConfirmingDelete(t) }}
          />
        )}
        {addingTrackId != null && (
          <AddToPlaylistModal trackIds={[addingTrackId]} onClose={() => setAddingTrackId(null)} />
        )}
        {confirmingDelete && (
          <ConfirmDialog
            title={`Delete "${confirmingDelete.title}"?`}
            message="The song file is removed from this device. This cannot be undone."
            confirmLabel="Delete Song"
            onConfirm={() => { void deleteTrack(confirmingDelete.id!) }}
            onClose={() => setConfirmingDelete(null)}
          />
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {artists.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-16">No artists yet</p>
        )}
        {artists.map(artist => (
          <div
            key={artist.name}
            onClick={() => setSelectedArtist(artist.name)}
            className="flex items-center gap-4 px-4 py-3 active:bg-white/[0.05] cursor-pointer border-b border-white/[0.05] last:border-0 select-none"
          >
            <CoverArt
              blob={artist.tracks.find(t => t.coverBlob)?.coverBlob ?? null}
              size={52}
              className="rounded-full shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold truncate">{artist.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {artist.tracks.length} {artist.tracks.length === 1 ? 'song' : 'songs'}
              </p>
            </div>
            <span className="text-white/20 text-xl leading-none">›</span>
          </div>
        ))}
        <div className="h-28" />
      </div>
    </div>
  )
}
