import { useRef, useState, useEffect, useMemo } from 'react'
import { usePlaylistTracks, removeFromPlaylist, updatePlaylistCover } from '../hooks/usePlaylists'
import { toggleLike } from '../hooks/useTracks'
import { importFiles } from '../lib/importTracks'
import type { Playlist, Track } from '../db'
import { CoverArt } from './CoverArt'
import { ChevronLeftIcon, PlayIcon, ShuffleIcon, PlusIcon, ImportIcon } from './Icons'
import { TrackContextMenu } from './TrackContextMenu'
import { AddToPlaylistModal } from './AddToPlaylistModal'
import { AddSongsModal } from './AddSongsModal'

interface Props {
  playlist: Playlist
  currentTrackId?: number
  playing: boolean
  onPlay: (tracks: Track[], index: number) => void
  onPlayAll: (tracks: Track[], index: number) => void
  onPlayNext: (track: Track) => void
  onAddToQueue: (track: Track) => void
  onPlayShuffle: (tracks: Track[]) => void
  onBack: () => void
}

export function PlaylistDetail({ playlist, currentTrackId, playing, onPlay, onPlayAll, onPlayNext, onAddToQueue, onPlayShuffle, onBack }: Props) {
  const data = usePlaylistTracks(playlist.id!)
  const tracks = data?.tracks ?? []
  const pts = data?.pts ?? []

  const [localCover, setLocalCover] = useState<Blob | null>(playlist.coverBlob ?? null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [showAddSongs, setShowAddSongs] = useState(false)

  useEffect(() => { setLocalCover(playlist.coverBlob ?? null) }, [playlist.coverBlob])

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !playlist.id) return
    setLocalCover(file)
    await updatePlaylistCover(playlist.id, file)
    e.target.value = ''
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setImporting(true)
    try {
      await importFiles(files, playlist.id!)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const bgBlob = useMemo(
    () => localCover ?? tracks[0]?.coverBlob ?? null,
    [localCover, tracks]
  )
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!bgBlob) { setBgUrl(null); return }
    const url = URL.createObjectURL(bgBlob)
    setBgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [bgBlob])

  const [contextTrack, setContextTrack] = useState<{ track: Track; idx: number; ptId: number } | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<number | null>(null)

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
      {/* Hidden file inputs */}
      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
      <input ref={importInputRef} type="file" multiple accept="audio/mpeg,audio/mp3,.mp3" className="hidden" onChange={handleImport} />

      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Blurred background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {bgUrl ? (
            <>
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${bgUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(80px)',
                  transform: 'scale(1.5)',
                  opacity: 0.4,
                }}
              />
              <div className="absolute inset-0 bg-black/70" />
            </>
          ) : (
            <div className="absolute inset-0 bg-black" />
          )}
        </div>

        {/* Header: back + import + add songs */}
        <div className="relative flex items-center gap-2 px-4 py-3 shrink-0">
          <button
            onClick={onBack}
            className="text-white w-9 h-9 flex items-center justify-center active:opacity-50 bg-white/10 rounded-full"
          >
            <ChevronLeftIcon size={20} />
          </button>
          <p className="text-white/50 text-sm font-medium flex-1 truncate">Library</p>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-full active:bg-white/20 transition-colors disabled:opacity-40"
            aria-label="Import files to playlist"
          >
            <ImportIcon size={18} />
          </button>
          <button
            onClick={() => setShowAddSongs(true)}
            className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-full active:bg-white/20 transition-colors"
            aria-label="Add songs from library"
          >
            <PlusIcon size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 relative" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

          {/* Hero */}
          <div className="flex flex-col items-center px-8 pt-4 pb-6">
            <div
              className="relative cursor-pointer active:opacity-80 transition-opacity"
              onClick={() => coverInputRef.current?.click()}
            >
              <CoverArt blob={localCover} size={180} className="rounded-2xl shadow-2xl" />
              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm border border-white/20 rounded-full px-2.5 py-1 flex items-center gap-1">
                <span className="text-white text-[10px] font-semibold tracking-wide">EDIT</span>
              </div>
            </div>

            <p className="text-white font-bold text-[22px] mt-4 text-center leading-tight">{playlist.name}</p>
            <p className="text-white/40 text-sm mt-1.5">
              {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
            </p>
          </div>

          {/* Play / Shuffle */}
          {tracks.length > 0 && (
            <div className="flex gap-3 px-5 pb-6">
              <button
                onClick={() => onPlayAll(tracks, 0)}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-black text-sm font-bold py-3 rounded-2xl active:scale-95 transition-transform"
              >
                <PlayIcon size={14} /> Play
              </button>
              <button
                onClick={() => onPlayShuffle(tracks)}
                className="flex-1 flex items-center justify-center gap-2 bg-white/[0.12] text-white text-sm font-bold py-3 rounded-2xl active:scale-95 transition-transform border border-white/10"
              >
                <ShuffleIcon size={14} /> Shuffle
              </button>
            </div>
          )}

          {/* Track list */}
          {tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-8 text-center">
              <p className="text-white font-semibold">Empty playlist</p>
              <p className="text-white/40 text-sm">
                Tap <span className="text-white font-medium">+</span> to add songs, or{' '}
                <span className="text-white font-medium">↓</span> to import files directly.
              </p>
            </div>
          ) : (
            <div className="mx-4 rounded-2xl overflow-hidden bg-white/[0.05]">
              {tracks.map((track, idx) => {
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
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none border-b border-white/[0.05] last:border-0 transition-colors ${isActive ? 'bg-white/[0.08]' : 'active:bg-white/[0.08]'}`}
                  >
                    <CoverArt blob={track.coverBlob} size={44} className="rounded-xl" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate leading-snug ${isActive ? 'text-[#fc3c44]' : 'text-white'}`}>
                        {isActive && playing && (
                          <span className="inline-block w-2 h-2 rounded-full bg-[#fc3c44] mr-1.5 mb-0.5 animate-pulse" />
                        )}
                        {track.title}
                      </p>
                      <p className="text-xs text-white/40 truncate mt-0.5">{track.artist}</p>
                    </div>
                    <span className="text-xs text-white/30 shrink-0 tabular-nums">{formatDuration(track.duration)}</span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="h-28" />
        </div>
      </div>

      {contextTrack && (
        <TrackContextMenu
          track={contextTrack.track}
          onClose={() => setContextTrack(null)}
          onPlay={() => { onPlayAll(tracks, contextTrack.idx); setContextTrack(null) }}
          onPlayNext={() => { onPlayNext(contextTrack.track); setContextTrack(null) }}
          onAddToQueue={() => { onAddToQueue(contextTrack.track); setContextTrack(null) }}
          onAddToPlaylist={() => { setAddingTrackId(contextTrack.track.id!); setContextTrack(null) }}
          onToggleLike={async () => {
            await toggleLike(contextTrack.track.id!)
            setContextTrack(null)
          }}
          onRemove={async () => { await removeFromPlaylist(contextTrack.ptId); setContextTrack(null) }}
        />
      )}

      {addingTrackId != null && (
        <AddToPlaylistModal trackId={addingTrackId} onClose={() => setAddingTrackId(null)} />
      )}

      {showAddSongs && (
        <AddSongsModal playlistId={playlist.id!} onClose={() => setShowAddSongs(false)} />
      )}
    </>
  )
}
