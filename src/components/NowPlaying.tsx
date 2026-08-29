import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { PlayerState, QueueEntry } from '../hooks/usePlayer'
import { useBlobUrl } from '../hooks/useBlobUrl'
import { toggleLike } from '../hooks/useTracks'
import { db } from '../db'
import { CoverArt } from './CoverArt'
import { QueueView } from './QueueView'
import { EQModal } from './EQModal'
import {
  PlayIcon, PauseIcon, NextIcon, PrevIcon,
  ShuffleIcon, RepeatIcon, RepeatOneIcon, ChevronDownIcon,
  HeartIcon, HeartFilledIcon, QueueIcon, EQIcon,
} from './Icons'

interface Props {
  state: PlayerState
  upcoming: QueueEntry[]
  visible: boolean
  onTogglePlay: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (t: number) => void
  onToggleShuffle: () => void
  onCycleRepeat: () => void
  onClose: () => void
  onJumpTo: (index: number) => void
  onRemoveFromQueue: (index: number) => void
  onReorderQueue: (from: number, to: number) => void
  onSetSpeed: (speed: number) => void
}

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function NowPlaying({
  state, upcoming, visible, onTogglePlay, onNext, onPrev, onSeek,
  onToggleShuffle, onCycleRepeat, onClose,
  onJumpTo, onRemoveFromQueue, onReorderQueue, onSetSpeed,
}: Props) {
  const { currentTrack, playing, position, duration, shuffle, repeat, speed } = state

  // Live cover — reacts when fixCovers populates trackCovers after startup
  const coverBlob = (useLiveQuery(
    () => currentTrack?.id != null
      ? db.trackCovers.get(currentTrack.id).then(tc => (tc?.coverBlob ?? currentTrack.coverBlob ?? null) as Blob | null)
      : Promise.resolve(null as Blob | null),
    [currentTrack?.id],
    null as Blob | null
  ) ?? null) as Blob | null

  // Blurred background
  const bgUrl = useBlobUrl(coverBlob)

  // Seek bar
  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [dragPct, setDragPct] = useState<number | null>(null)
  const [pendingSeek, setPendingSeek] = useState<{ pct: number; trackId: number | undefined } | null>(null)

  const pctFromPointer = (e: React.PointerEvent) => {
    if (!barRef.current) return 0
    const rect = barRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  // Hold the thumb at the seek target until playback catches up, so it doesn't
  // snap backwards for a frame. Adjusted during render rather than in an effect:
  // an effect would commit a stale frame first, which is the jump we're avoiding.
  if (
    pendingSeek &&
    (pendingSeek.trackId !== currentTrack?.id ||
      (duration > 0 && Math.abs(position / duration - pendingSeek.pct) < 0.02))
  ) {
    setPendingSeek(null)
  }

  const isDragging = dragPct !== null
  const displayPct = isDragging
    ? dragPct * 100
    : pendingSeek
      ? pendingSeek.pct * 100
      : (duration > 0 ? (position / duration) * 100 : 0)

  // Swipe down to dismiss
  const swipeStartY = useRef<number | null>(null)
  const swipeAllowed = useRef(false)
  const [swipeY, setSwipeY] = useState(0)

  const onSwipeDown = (e: React.PointerEvent) => {
    if (e.clientY > window.innerHeight * 0.65) return
    swipeStartY.current = e.clientY
    swipeAllowed.current = true
  }

  const onSwipeMove = (e: React.PointerEvent) => {
    if (!swipeAllowed.current || swipeStartY.current === null) return
    const dy = e.clientY - swipeStartY.current
    if (dy > 0) setSwipeY(dy)
  }

  const onSwipeEnd = () => {
    if (swipeY > 120) {
      setSwipeY(0)
      onClose()
    } else {
      setSwipeY(0)
    }
    swipeStartY.current = null
    swipeAllowed.current = false
  }

  // Reactive liked state
  const liked = useLiveQuery(
    () => currentTrack?.id != null
      ? db.tracks.get(currentTrack.id).then(t => !!t?.liked)
      : Promise.resolve(false),
    [currentTrack?.id],
    false
  ) ?? false

  // Heart pop animation — replay it each time the song becomes liked.
  const [likedShown, setLikedShown] = useState(liked)
  const [heartKey, setHeartKey] = useState(0)
  if (liked !== likedShown) {
    setLikedShown(liked)
    if (liked) setHeartKey(k => k + 1)
  }

  // Queue and EQ sheets — closed whenever Now Playing slides away.
  const [showQueue, setShowQueue] = useState(false)
  const [showEQ, setShowEQ] = useState(false)
  const [visibleShown, setVisibleShown] = useState(visible)
  if (visible !== visibleShown) {
    setVisibleShown(visible)
    if (!visible) {
      setShowQueue(false)
      setShowEQ(false)
    }
  }

  if (!currentTrack) return null

  // NowPlaying slide-up/down transition
  const transform = !visible
    ? 'translateY(100%)'
    : swipeY > 0
      ? `translateY(${swipeY}px)`
      : 'translateY(0)'
  const transition = swipeY > 0 ? 'none' : 'transform 0.42s cubic-bezier(0.32,0.72,0,1)'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        transform,
        transition,
      }}
      onPointerDown={onSwipeDown}
      onPointerMove={onSwipeMove}
      onPointerUp={onSwipeEnd}
      onPointerCancel={onSwipeEnd}
    >
      {/* Blurred background */}
      <div className="absolute inset-0 bg-black">
        {bgUrl && (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${bgUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(60px)',
                transform: 'scale(1.4)',
                opacity: 0.55,
              }}
            />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative flex flex-col flex-1 select-none">
        {/* Drag handle */}
        <div className="flex items-center justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2">
          <button
            onClick={onClose}
            className="text-white w-9 h-9 flex items-center justify-center active:opacity-50 rounded-full bg-white/10 transition-opacity"
            aria-label="Close"
          >
            <ChevronDownIcon size={20} />
          </button>
          <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">Now Playing</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const idx = SPEEDS.indexOf(speed)
                onSetSpeed(SPEEDS[(idx + 1) % SPEEDS.length])
              }}
              className={`h-9 px-2.5 flex items-center justify-center rounded-full transition-all active:opacity-50 text-xs font-bold tabular-nums ${speed !== 1 ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'}`}
              aria-label="Playback speed"
            >
              {speed === 1 ? '1×' : `${speed}×`}
            </button>
            <button
              onClick={() => { setShowEQ(q => !q); setShowQueue(false) }}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:opacity-50 ${showEQ ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'}`}
              aria-label="Equalizer"
            >
              <EQIcon size={18} />
            </button>
            <button
              onClick={() => { setShowQueue(q => !q); setShowEQ(false) }}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:opacity-50 ${showQueue ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'}`}
              aria-label="Queue"
            >
              <QueueIcon size={20} />
            </button>
          </div>
        </div>

        {/* Cover art — tap to toggle queue */}
        <div
          className="flex-1 flex items-center justify-center px-8 py-2 cursor-pointer"
          onClick={() => { setShowQueue(q => !q); setShowEQ(false) }}
        >
          <div className="relative w-full" style={{ maxWidth: 320 }}>
            <CoverArt
              blob={coverBlob}
              fluid
              eager
              className={`rounded-2xl shadow-2xl w-full transition-opacity duration-200 ${showQueue ? 'opacity-30' : 'opacity-100'}`}
            />
            {showQueue && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-sm font-semibold opacity-70">Tap to close queue</span>
              </div>
            )}
          </div>
        </div>

        {/* Track info + like */}
        <div className="flex items-center gap-3 px-6 pt-4 pb-2">
          <div className="flex-1 min-w-0">
            <p className="text-white text-xl font-bold truncate">{currentTrack.title}</p>
            <p className="text-white/60 text-sm truncate mt-0.5">{currentTrack.artist}</p>
          </div>
          <button
            onClick={() => currentTrack.id != null && toggleLike(currentTrack.id)}
            className="w-10 h-10 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            {liked
              ? <HeartFilledIcon key={heartKey} size={24} className="text-pink-400 animate-heart-pop" />
              : <HeartIcon size={24} className="text-white/40" />
            }
          </button>
        </div>

        {/* Seek bar */}
        <div className="px-6 pb-1">
          <div
            ref={barRef}
            className="relative flex items-center touch-none cursor-pointer"
            style={{ height: 44 }}
            onPointerDown={e => {
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              dragging.current = true
              setDragPct(pctFromPointer(e))
            }}
            onPointerMove={e => {
              e.stopPropagation()
              if (!dragging.current) return
              setDragPct(pctFromPointer(e))
            }}
            onPointerUp={e => {
              e.stopPropagation()
              if (!dragging.current) return
              const pct = pctFromPointer(e)
              dragging.current = false
              setDragPct(null)
              setPendingSeek({ pct, trackId: currentTrack.id })
              onSeek(pct * (duration || 1))
            }}
            onPointerCancel={() => { dragging.current = false; setDragPct(null); setPendingSeek(null) }}
          >
            {/* Track */}
            <div
              className="w-full rounded-full relative overflow-hidden"
              style={{
                height: isDragging ? 5 : 3,
                background: 'rgba(255,255,255,0.2)',
                transition: 'height 0.15s ease',
              }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-white rounded-full"
                style={{ width: `${displayPct}%` }}
              />
            </div>
            <div
              className="absolute bg-white rounded-full shadow-lg pointer-events-none top-1/2 -translate-y-1/2"
              style={{
                width: isDragging ? 22 : 14,
                height: isDragging ? 22 : 14,
                left: `calc(${displayPct}% - ${isDragging ? 11 : 7}px)`,
                transition: 'width 0.15s ease, height 0.15s ease, left 0s',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40 -mt-1">
            <span>{formatTime((displayPct / 100) * duration)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-8 pb-4 pt-2">
          <button
            onClick={onToggleShuffle}
            className={`w-10 h-10 flex items-center justify-center transition-colors active:opacity-50 ${shuffle ? 'text-white' : 'text-white/30'}`}
          >
            <ShuffleIcon size={22} />
          </button>

          <button onClick={onPrev} className="w-12 h-12 flex items-center justify-center text-white active:opacity-50 transition-opacity">
            <PrevIcon size={32} />
          </button>

          <button
            onClick={onTogglePlay}
            className="bg-white text-black rounded-full w-16 h-16 flex items-center justify-center active:scale-95 transition-transform shadow-lg"
          >
            {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
          </button>

          <button onClick={onNext} className="w-12 h-12 flex items-center justify-center text-white active:opacity-50 transition-opacity">
            <NextIcon size={32} />
          </button>

          <button
            onClick={onCycleRepeat}
            className={`w-10 h-10 flex items-center justify-center transition-colors active:opacity-50 ${repeat !== 'none' ? 'text-white' : 'text-white/30'}`}
          >
            {repeat === 'one' ? <RepeatOneIcon size={22} /> : <RepeatIcon size={22} />}
          </button>
        </div>
      </div>

      {/* Queue sheet — overlays NowPlaying content */}
      {showQueue && (
        <QueueView
          current={currentTrack}
          upcoming={upcoming}
          shuffle={shuffle}
          onClose={() => setShowQueue(false)}
          onJumpTo={idx => { onJumpTo(idx); setShowQueue(false) }}
          onRemove={onRemoveFromQueue}
          onReorder={onReorderQueue}
        />
      )}

      {/* EQ sheet — overlays NowPlaying content */}
      {showEQ && <EQModal onClose={() => setShowEQ(false)} />}
    </div>
  )
}
