import { useRef, useState } from 'react'
import { useTracks, deleteTrack, deleteTracks, toggleLike } from '../hooks/useTracks'
import type { Track } from '../db'
import { CoverArt } from './CoverArt'
import { MusicNoteIcon, HeartIcon, HeartFilledIcon } from './Icons'
import { AddToPlaylistModal } from './AddToPlaylistModal'
import { TrackContextMenu } from './TrackContextMenu'
import { StorageInfo } from './StorageInfo'
import { BackupBar } from './BackupBar'
import { DiagnosticsSheet } from './DiagnosticsSheet'
import { ConfirmDialog } from './ConfirmDialog'

type DisplaySort = 'alpha' | 'newest' | 'oldest'
const SORT_LABELS: Record<DisplaySort, string> = { alpha: 'A-Z', newest: 'Newest', oldest: 'Oldest' }

interface Props {
  onPlay: (tracks: Track[], index: number) => void
  onPlayAndOpen: (tracks: Track[], index: number) => void
  onPlayNext: (track: Track) => void
  onAddToQueue: (track: Track) => void
  currentTrackId?: number
  playing: boolean
}

const DELETE_SNAP = 80   // px: distance to snap to "delete button visible"
const DELETE_FULL = 160  // px: full swipe = instant delete

export function Library({ onPlay, onPlayAndOpen, onPlayNext, onAddToQueue, currentTrackId, playing }: Props) {
  const [sort, setSort] = useState<DisplaySort>('alpha')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [showLiked, setShowLiked] = useState(false)
  const [contextTrack, setContextTrack] = useState<{ track: Track; idx: number; all: Track[] } | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<number | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  // Deleting a track destroys the only copy of the audio. Every path that does
  // it goes through here first.
  const [confirming, setConfirming] = useState<
    { title: string; message?: string; confirmLabel: string; run: () => void } | null
  >(null)

  const confirmDeleteTrack = (track: Track) =>
    setConfirming({
      title: `Delete "${track.title}"?`,
      message: 'The song file is removed from this device. This cannot be undone.',
      confirmLabel: 'Delete Song',
      run: () => { void deleteTrack(track.id!) },
    })

  // Multi-select
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set<number>())
  const [addingSelectedToPlaylist, setAddingSelectedToPlaylist] = useState(false)

  // Swipe-to-delete
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null)
  const [swipeDrag, setSwipeDrag] = useState<{ id: number; x: number } | null>(null)
  const gestureRef = useRef<{
    id: number
    startX: number
    startY: number
    baseX: number
    mode: 'idle' | 'h' | 'v'
    pointerId: number
  } | null>(null)

  // Long-press
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpStart = useRef<{ x: number; y: number } | null>(null)
  const lpFired = useRef(false)

  const sortKey = sort === 'alpha' ? 'title' : sort === 'newest' ? 'addedAt' : 'addedAt_asc'
  const allTracks = useTracks(sortKey)
  const searched = search.trim()
    ? allTracks.filter(t =>
        [t.title, t.artist, t.album].some(f => f.toLowerCase().includes(search.toLowerCase()))
      )
    : allTracks
  const tracks = showLiked ? searched.filter(t => t.liked) : searched

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

  const handleBulkDelete = () => {
    if (selected.size === 0) return
    const ids = [...selected]
    setConfirming({
      title: `Delete ${ids.length} song${ids.length === 1 ? '' : 's'}?`,
      message: 'The song files are removed from this device. This cannot be undone.',
      confirmLabel: `Delete ${ids.length} Song${ids.length === 1 ? '' : 's'}`,
      run: () => { void deleteTracks(ids).then(exitSelectMode) },
    })
  }

  // Gesture handlers
  const onRowDown = (e: React.PointerEvent, track: Track, idx: number) => {
    // Close any other open swipe if tapping a different row
    if (openSwipeId !== null && openSwipeId !== track.id) {
      setOpenSwipeId(null)
      return
    }

    const baseX = openSwipeId === track.id ? -DELETE_SNAP : 0
    gestureRef.current = {
      id: track.id!,
      startX: e.clientX,
      startY: e.clientY,
      baseX,
      mode: 'idle',
      pointerId: e.pointerId,
    }

    lpFired.current = false
    lpStart.current = { x: e.clientX, y: e.clientY }
    lpTimer.current = setTimeout(() => {
      lpFired.current = true
      if (selectMode) {
        toggleSelect(track.id!)
      } else {
        if ('vibrate' in navigator) (navigator as Navigator & { vibrate: (d: number) => void }).vibrate(40)
        setContextTrack({ track, idx, all: tracks })
      }
    }, 500)
  }

  const onRowMove = (e: React.PointerEvent, track: Track) => {
    const g = gestureRef.current
    if (!g || g.id !== track.id!) return

    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (g.mode === 'idle') {
      if (absDx < 8 && absDy < 8) return
      if (absDx > absDy && absDx > 12) {
        g.mode = 'h'
        if (lpTimer.current) clearTimeout(lpTimer.current)
        lpStart.current = null
        e.currentTarget.setPointerCapture(e.pointerId)
      } else if (absDy > absDx) {
        g.mode = 'v'
        if (lpTimer.current) clearTimeout(lpTimer.current)
        lpStart.current = null
      }
      return
    }

    if (g.mode === 'h') {
      const rawX = g.baseX + dx
      const newX = Math.min(0, Math.max(-DELETE_FULL - 20, rawX))
      setSwipeDrag({ id: track.id!, x: newX })
    }
  }

  const onRowUp = (_e: React.PointerEvent, track: Track, idx: number) => {
    const g = gestureRef.current
    if (lpTimer.current) clearTimeout(lpTimer.current)

    if (g?.mode === 'h') {
      const currentX = (swipeDrag !== null && swipeDrag.id === track.id) ? swipeDrag.x : g.baseX
      setSwipeDrag(null)
      gestureRef.current = null

      if (currentX <= -DELETE_FULL) {
        // A full swipe asks rather than deletes — it is far too easy to trigger
        // by accident while scrolling, and there is no undo.
        setOpenSwipeId(null)
        confirmDeleteTrack(track)
      } else if (currentX <= -DELETE_SNAP / 2) {
        setOpenSwipeId(track.id!)
      } else {
        setOpenSwipeId(null)
      }
      return
    }

    gestureRef.current = null
    lpStart.current = null

    if (!lpFired.current) {
      if (selectMode) {
        toggleSelect(track.id!)
      } else if (openSwipeId === track.id) {
        setOpenSwipeId(null)
      } else {
        onPlay(tracks, idx)
      }
    }
  }

  const onRowCancel = () => {
    if (lpTimer.current) clearTimeout(lpTimer.current)
    gestureRef.current = null
    lpStart.current = null
    setSwipeDrag(null)
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
        </div>
        {/* Reachable with an empty library — this is the screen someone lands on
            after a reinstall, when restoring is the only thing they want to do. */}
        <div className="w-full max-w-xs">
          <BackupBar prominent />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Search — always visible */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search songs, artists, albums…"
            className="w-full bg-white/[0.08] text-white placeholder-gray-500 text-sm px-4 py-2.5 rounded-2xl outline-none focus:bg-white/12"
          />
        </div>

        {selectMode ? (
          /* Select mode header */
          <div className="flex items-center justify-between px-4 pb-2 shrink-0">
            <button
              onClick={exitSelectMode}
              className="text-[#fc3c44] text-sm font-medium active:opacity-50"
            >
              Cancel
            </button>
            <span className="text-white/60 text-sm">
              {selected.size} selected
            </span>
            <button
              onClick={() => setSelected(new Set(tracks.map(t => t.id!)))}
              className="text-[#fc3c44] text-sm font-medium active:opacity-50"
            >
              Select All
            </button>
          </div>
        ) : (
          /* Sort menu + liked filter + select */
          <div className="flex items-center gap-1 px-4 pb-2 shrink-0">
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
                  {(['alpha', 'newest', 'oldest'] as DisplaySort[]).map(opt => (
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
              onClick={() => setShowLiked(p => !p)}
              className={`px-2.5 py-1.5 rounded-full transition-colors ${
                showLiked ? 'bg-pink-500/20' : 'active:bg-white/10'
              }`}
              aria-label="Show liked songs"
            >
              {showLiked
                ? <HeartFilledIcon size={16} className="text-pink-400" />
                : <HeartIcon size={16} className="text-white/35" />
              }
            </button>
            <button
              onClick={() => setSelectMode(true)}
              className="text-xs px-3 py-1.5 rounded-full text-white/35 active:bg-white/10 font-medium"
            >
              Select
            </button>
          </div>
        )}

        {/* Track list */}
        <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {tracks.length === 0 ? (
            <p className="text-gray-500 text-sm text-center mt-12">
              {showLiked ? 'No liked songs yet' : `No results for "${search}"`}
            </p>
          ) : (
            tracks.map((track, idx) => {
              const isActive = track.id === currentTrackId
              const isSelected = selected.has(track.id!)
              const isDragging = swipeDrag !== null && swipeDrag.id === track.id
              const isOpen = !isDragging && openSwipeId === track.id
              const translateX = isDragging ? swipeDrag.x : isOpen ? -DELETE_SNAP : 0

              return (
                <div key={track.id} className="relative mx-3 mb-1.5">
                  {/* Red delete zone (behind the row) */}
                  {(isOpen || isDragging) && (
                    <div
                      className="absolute right-0 top-0 bottom-0 flex items-center justify-end rounded-2xl overflow-hidden"
                      style={{ width: DELETE_SNAP, background: '#ff3b30' }}
                      onClick={() => { setOpenSwipeId(null); confirmDeleteTrack(track) }}
                    >
                      <span className="text-white text-xs font-bold pr-4">Delete</span>
                    </div>
                  )}

                  {/* Track row */}
                  <div
                    onPointerDown={e => onRowDown(e, track, idx)}
                    onPointerMove={e => onRowMove(e, track)}
                    onPointerUp={e => onRowUp(e, track, idx)}
                    onPointerCancel={onRowCancel}
                    className={`library-row flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer select-none transition-colors ${
                      isSelected ? 'bg-[#fc3c44]/20' : isActive ? 'bg-white/10' : 'bg-white/[0.05] active:bg-white/10'
                    }`}
                    style={{
                      transform: `translateX(${translateX}px)`,
                      transition: isDragging ? 'none' : 'transform 0.25s ease',
                    }}
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
                      <CoverArt blob={track.coverBlob} size={48} className="rounded-xl" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate leading-snug">
                        {isActive && playing && !selectMode && (
                          <span className="inline-block w-2 h-2 rounded-full bg-[#fc3c44] mr-1.5 mb-0.5 animate-pulse" />
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
                    {!selectMode && track.liked && (
                      <HeartFilledIcon size={14} className="text-pink-400 shrink-0" />
                    )}
                    {!selectMode && (
                      <span className="text-xs text-gray-600 shrink-0 tabular-nums">
                        {formatDuration(track.duration)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <StorageInfo />
          <BackupBar />
          <button
            onClick={() => setShowDiagnostics(true)}
            className="mx-auto mt-2 block text-[10px] text-white/15 active:text-white/40"
          >
            Diagnostics
          </button>
          <div className="h-28" />
        </div>

        {/* Select mode action bar */}
        {selectMode && selected.size > 0 && (
          <div className="shrink-0 px-4 py-3 border-t border-white/[0.08] bg-black/80 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const selectedTracks = tracks.filter(t => selected.has(t.id!))
                  for (const t of selectedTracks) onAddToQueue(t)
                  exitSelectMode()
                }}
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
              onClick={handleBulkDelete}
              className="w-full bg-red-600/80 text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform text-sm"
            >
              Delete {selected.size} {selected.size === 1 ? 'Song' : 'Songs'}
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextTrack && (
        <TrackContextMenu
          track={contextTrack.track}
          onClose={() => setContextTrack(null)}
          onPlay={() => { onPlayAndOpen(contextTrack.all, contextTrack.idx); setContextTrack(null) }}
          onPlayNext={() => { onPlayNext(contextTrack.track); setContextTrack(null) }}
          onAddToQueue={() => { onAddToQueue(contextTrack.track); setContextTrack(null) }}
          onAddToPlaylist={() => { setAddingTrackId(contextTrack.track.id!); setContextTrack(null) }}
          onToggleLike={async () => {
            await toggleLike(contextTrack.track.id!)
            setContextTrack(null)
          }}
          onDelete={() => { const t = contextTrack.track; setContextTrack(null); confirmDeleteTrack(t) }}
        />
      )}

      {showDiagnostics && <DiagnosticsSheet onClose={() => setShowDiagnostics(false)} />}

      {confirming && (
        <ConfirmDialog
          title={confirming.title}
          message={confirming.message}
          confirmLabel={confirming.confirmLabel}
          onConfirm={confirming.run}
          onClose={() => setConfirming(null)}
        />
      )}

      {addingTrackId != null && (
        <AddToPlaylistModal
          trackIds={[addingTrackId]}
          onClose={() => setAddingTrackId(null)}
        />
      )}

      {addingSelectedToPlaylist && (
        <AddToPlaylistModal
          trackIds={[...selected]}
          onClose={() => { setAddingSelectedToPlaylist(false); exitSelectMode() }}
        />
      )}
    </>
  )
}
