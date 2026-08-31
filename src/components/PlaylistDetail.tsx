import { useRef, useState, useEffect, useMemo } from 'react'
import { usePlaylistTracks, removeFromPlaylist, removeManyFromPlaylist, updatePlaylistCover } from '../hooks/usePlaylists'
import { toggleLike } from '../hooks/useTracks'
import { importFiles, AUDIO_ACCEPT } from '../lib/importTracks'
import { useBlobUrl } from '../hooks/useBlobUrl'
import type { Playlist, Track } from '../db'
import { CoverArt } from './CoverArt'
import { ChevronLeftIcon, PlayIcon, ShuffleIcon, PlusIcon, ImportIcon } from './Icons'
import { TrackContextMenu } from './TrackContextMenu'
import { AddToPlaylistModal } from './AddToPlaylistModal'
import { AddSongsModal } from './AddSongsModal'

type DisplaySort = 'manual' | 'alpha' | 'newest' | 'oldest'
const SORT_LABELS: Record<DisplaySort, string> = {
  manual: 'Playlist order',
  alpha: 'A-Z',
  newest: 'Newest',
  oldest: 'Oldest',
}

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
  // Memoised so the fallbacks don't hand out a fresh array on every render.
  const tracks = useMemo(() => data?.tracks ?? [], [data])
  const pts = useMemo(() => data?.pts ?? [], [data])

  const [localCover, setLocalCover] = useState<Blob | null>(playlist.coverBlob ?? null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [showAddSongs, setShowAddSongs] = useState(false)

  // Search + sort
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<DisplaySort>('alpha')
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Multi-select
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set<number>())

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
  const bgUrl = useBlobUrl(bgBlob)

  // Sorted + filtered track/pt pairs
  const displayPairs = useMemo(() => {
    const pairs = tracks.map((t, i) => ({ track: t, pt: pts[i] }))

    let sorted: typeof pairs
    if (sort === 'manual') {
      // usePlaylistTracks already returns them by position.
      sorted = pairs
    } else if (sort === 'alpha') {
      sorted = [...pairs].sort((a, b) => a.track.title.toLowerCase().localeCompare(b.track.title.toLowerCase()))
    } else if (sort === 'newest') {
      sorted = [...pairs].sort((a, b) => b.track.addedAt - a.track.addedAt)
    } else {
      sorted = [...pairs].sort((a, b) => a.track.addedAt - b.track.addedAt)
    }

    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter(({ track }) =>
      [track.title, track.artist, track.album].some(f => f?.toLowerCase().includes(q))
    )
  }, [tracks, pts, sort, search])

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const handleBulkAddToQueue = () => {
    const selectedTracks = displayPairs.filter(p => selected.has(p.track.id!)).map(p => p.track)
    for (const t of selectedTracks) onAddToQueue(t)
    exitSelectMode()
  }

  const handleBulkRemove = async () => {
    const selectedPtIds = displayPairs
      .filter(p => selected.has(p.track.id!) && p.pt?.id)
      .map(p => p.pt!.id!)
    await removeManyFromPlaylist(selectedPtIds)
    exitSelectMode()
  }

  const [contextTrack, setContextTrack] = useState<{ track: Track; idx: number; ptId: number } | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<number | null>(null)
  const [addingSelectedToPlaylist, setAddingSelectedToPlaylist] = useState(false)

  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpStart = useRef<{ x: number; y: number } | null>(null)
  const lpFired = useRef(false)

  const startLongPress = (e: React.PointerEvent, track: Track, idx: number, ptId: number) => {
    lpFired.current = false
    lpStart.current = { x: e.clientX, y: e.clientY }
    lpTimer.current = setTimeout(() => {
      lpFired.current = true
      if ('vibrate' in navigator) (navigator as Navigator & { vibrate: (d: number) => void }).vibrate(40)
      if (selectMode) {
        toggleSelect(track.id!)
      } else {
        setContextTrack({ track, idx, ptId })
      }
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
      <input ref={importInputRef} type="file" multiple accept={AUDIO_ACCEPT} className="hidden" onChange={handleImport} />

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

        {/* Header */}
        <div className="relative flex items-center gap-2 px-4 py-3 shrink-0">
          {selectMode ? (
            <>
              <button
                onClick={exitSelectMode}
                className="text-[#fc3c44] text-sm font-medium active:opacity-50"
              >
                Cancel
              </button>
              <span className="text-white/60 text-sm flex-1 text-center">{selected.size} selected</span>
              <button
                onClick={() => setSelected(new Set(displayPairs.map(p => p.track.id!)))}
                className="text-[#fc3c44] text-sm font-medium active:opacity-50"
              >
                Select All
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 relative" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

          {/* Hero — hidden in select mode */}
          {!selectMode && (
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
          )}

          {/* Play / Shuffle — hidden in select mode */}
          {!selectMode && tracks.length > 0 && (
            <div className="flex gap-3 px-5 pb-4">
              <button
                onClick={() => onPlayAll(displayPairs.map(p => p.track), 0)}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-black text-sm font-bold py-3 rounded-2xl active:scale-95 transition-transform"
              >
                <PlayIcon size={14} /> Play
              </button>
              <button
                onClick={() => onPlayShuffle(displayPairs.map(p => p.track))}
                className="flex-1 flex items-center justify-center gap-2 bg-white/[0.12] text-white text-sm font-bold py-3 rounded-2xl active:scale-95 transition-transform border border-white/10"
              >
                <ShuffleIcon size={14} /> Shuffle
              </button>
            </div>
          )}

          {/* Search */}
          <div className="px-4 pb-2 shrink-0">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search songs, artists, albums…"
              className="w-full bg-white/[0.08] text-white placeholder-gray-500 text-sm px-4 py-2.5 rounded-2xl outline-none focus:bg-white/12"
            />
          </div>

          {/* Sort menu + select button */}
          {!selectMode && (
            <div className="flex items-center gap-1 px-4 pb-3 shrink-0">
              <div className="relative flex-1">
                <button
                  onClick={() => setShowSortMenu(p => !p)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium bg-white/15 text-white flex items-center gap-1"
                >
                  {SORT_LABELS[sort]}
                  <span className="text-white/50 text-[10px]">▾</span>
                </button>
                {showSortMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1c1c1e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 min-w-[140px]">
                    {(['manual', 'alpha', 'newest', 'oldest'] as DisplaySort[]).map(opt => (
                      <button
                        key={opt}
                        onClick={() => { setSort(opt); setShowSortMenu(false) }}
                        className={`w-full text-left px-4 py-3 text-sm border-b border-white/[0.06] last:border-0 active:bg-white/10 ${
                          sort === opt ? 'text-[#fc3c44] font-semibold' : 'text-white'
                        }`}
                      >
                        {SORT_LABELS[opt]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectMode(true)}
                className="text-xs px-3 py-1.5 rounded-full text-white/35 active:bg-white/10 font-medium"
              >
                Select
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
          ) : displayPairs.length === 0 ? (
            <p className="text-gray-500 text-sm text-center mt-12">No results for "{search}"</p>
          ) : (
            <div className="mx-4 rounded-2xl overflow-hidden bg-white/[0.05]">
              {displayPairs.map(({ track, pt }, idx) => {
                const isActive = track.id === currentTrackId
                const isSelected = selected.has(track.id!)
                return (
                  <div
                    key={pt?.id ?? idx}
                    onClick={() => {
                      if (lpFired.current) return
                      if (selectMode) {
                        toggleSelect(track.id!)
                      } else {
                        onPlay(displayPairs.map(p => p.track), idx)
                      }
                    }}
                    onPointerDown={e => startLongPress(e, track, idx, pt?.id ?? 0)}
                    onPointerUp={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onPointerMove={moveLongPress}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none border-b border-white/[0.05] last:border-0 transition-colors ${
                      isSelected ? 'bg-[#fc3c44]/20' : isActive ? 'bg-white/[0.08]' : 'active:bg-white/[0.08]'
                    }`}
                  >
                    {selectMode ? (
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'border-[#fc3c44] bg-[#fc3c44]' : 'border-white/30'
                        }`}
                      >
                        {isSelected && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                      </div>
                    ) : (
                      <CoverArt blob={track.coverBlob} size={44} className="rounded-xl" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate leading-snug ${isActive && !selectMode ? 'text-[#fc3c44]' : 'text-white'}`}>
                        {isActive && playing && !selectMode && (
                          <span className="inline-block w-2 h-2 rounded-full bg-[#fc3c44] mr-1.5 mb-0.5 animate-pulse" />
                        )}
                        {track.title}
                      </p>
                      <p className="text-xs text-white/40 truncate mt-0.5">{track.artist}</p>
                    </div>
                    {!selectMode && (
                      <span className="text-xs text-white/30 shrink-0 tabular-nums">{formatDuration(track.duration)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="h-28" />
        </div>

        {/* Select mode action bar */}
        {selectMode && selected.size > 0 && (
          <div className="shrink-0 px-4 py-3 border-t border-white/[0.08] bg-black/80 flex flex-col gap-2 relative">
            <div className="flex gap-2">
              <button
                onClick={handleBulkAddToQueue}
                className="flex-1 bg-white/10 text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform text-sm"
              >
                Add to Queue
              </button>
              <button
                onClick={() => setAddingSelectedToPlaylist(true)}
                className="flex-1 bg-white/10 text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform text-sm"
              >
                Add to Playlist
              </button>
            </div>
            <button
              onClick={handleBulkRemove}
              className="w-full bg-red-600/80 text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform text-sm"
            >
              Remove {selected.size} {selected.size === 1 ? 'Song' : 'Songs'}
            </button>
          </div>
        )}
      </div>

      {contextTrack && (
        <TrackContextMenu
          track={contextTrack.track}
          onClose={() => setContextTrack(null)}
          onPlay={() => { onPlayAll(displayPairs.map(p => p.track), contextTrack.idx); setContextTrack(null) }}
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
        <AddToPlaylistModal trackIds={[addingTrackId]} onClose={() => setAddingTrackId(null)} />
      )}

      {addingSelectedToPlaylist && (
        <AddToPlaylistModal
          trackIds={[...selected]}
          onClose={() => { setAddingSelectedToPlaylist(false); exitSelectMode() }}
        />
      )}

      {showAddSongs && (
        <AddSongsModal playlistId={playlist.id!} onClose={() => setShowAddSongs(false)} />
      )}
    </>
  )
}
