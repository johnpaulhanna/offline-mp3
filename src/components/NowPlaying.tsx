import { useRef, useState, useEffect } from 'react'
import type { PlayerState } from '../hooks/usePlayer'
import { CoverArt } from './CoverArt'
import {
  PlayIcon, PauseIcon, NextIcon, PrevIcon,
  ShuffleIcon, RepeatIcon, RepeatOneIcon, ChevronDownIcon
} from './Icons'

interface Props {
  state: PlayerState
  onTogglePlay: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (t: number) => void
  onToggleShuffle: () => void
  onCycleRepeat: () => void
  onClose: () => void
}

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function NowPlaying({
  state, onTogglePlay, onNext, onPrev, onSeek,
  onToggleShuffle, onCycleRepeat, onClose,
}: Props) {
  const { currentTrack, playing, position, duration, shuffle, repeat } = state

  // Blurred background URL
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!currentTrack?.coverBlob) { setBgUrl(null); return }
    const url = URL.createObjectURL(currentTrack.coverBlob)
    setBgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [currentTrack?.coverBlob])

  // Seek bar
  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [dragPct, setDragPct] = useState<number | null>(null)

  const pctFromPointer = (e: React.PointerEvent) => {
    if (!barRef.current) return 0
    const rect = barRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  const displayPct = dragPct !== null
    ? dragPct * 100
    : (duration > 0 ? (position / duration) * 100 : 0)

  // Swipe down to dismiss
  const swipeStartY = useRef<number | null>(null)
  const swipeAllowed = useRef(false)
  const [swipeY, setSwipeY] = useState(0)

  const onSwipeDown = (e: React.PointerEvent) => {
    // Only allow swipe from upper portion (cover art area), not controls
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
      onClose()
    } else {
      setSwipeY(0)
    }
    swipeStartY.current = null
    swipeAllowed.current = false
  }

  if (!currentTrack) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        transform: swipeY > 0 ? `translateY(${swipeY}px)` : undefined,
        transition: swipeY > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
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
            className="text-white w-9 h-9 flex items-center justify-center active:opacity-50 rounded-full bg-white/10"
            aria-label="Close"
          >
            <ChevronDownIcon size={20} />
          </button>
          <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">Now Playing</p>
          <div className="w-9" />
        </div>

        {/* Cover art */}
        <div className="flex-1 flex items-center justify-center px-8 py-2">
          <CoverArt
            blob={currentTrack.coverBlob}
            size={Math.min(320, window.innerWidth - 64)}
            className="rounded-2xl shadow-2xl"
          />
        </div>

        {/* Track info */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-white text-xl font-bold truncate">{currentTrack.title}</p>
          <p className="text-white/60 text-sm truncate mt-0.5">{currentTrack.artist}</p>
        </div>

        {/* Seek bar */}
        <div className="px-6 pb-1">
          <div
            ref={barRef}
            className="relative flex items-center touch-none cursor-pointer"
            style={{ height: 36 }}
            onPointerDown={e => {
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              dragging.current = true
              const pct = pctFromPointer(e)
              setDragPct(pct)
              onSeek(pct * (duration || 1))
            }}
            onPointerMove={e => {
              e.stopPropagation()
              if (!dragging.current) return
              const pct = pctFromPointer(e)
              setDragPct(pct)
              onSeek(pct * (duration || 1))
            }}
            onPointerUp={e => {
              e.stopPropagation()
              if (!dragging.current) return
              dragging.current = false
              const pct = pctFromPointer(e)
              setDragPct(null)
              onSeek(pct * (duration || 1))
            }}
            onPointerCancel={() => { dragging.current = false; setDragPct(null) }}
          >
            <div className="w-full h-1 bg-white/20 rounded-full relative">
              <div className="absolute inset-y-0 left-0 bg-white rounded-full" style={{ width: `${displayPct}%` }} />
            </div>
            <div
              className="absolute w-4 h-4 bg-white rounded-full shadow-lg top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `calc(${displayPct}% - 8px)` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>{formatTime(dragPct !== null ? dragPct * duration : position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-8 pb-4 pt-2">
          <button
            onClick={onToggleShuffle}
            className={`w-10 h-10 flex items-center justify-center active:opacity-50 transition-colors ${shuffle ? 'text-white' : 'text-white/30'}`}
          >
            <ShuffleIcon size={22} />
          </button>

          <button onClick={onPrev} className="w-12 h-12 flex items-center justify-center text-white active:opacity-50">
            <PrevIcon size={32} />
          </button>

          <button
            onClick={onTogglePlay}
            className="bg-white text-black rounded-full w-16 h-16 flex items-center justify-center active:scale-95 transition-transform shadow-lg"
          >
            {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
          </button>

          <button onClick={onNext} className="w-12 h-12 flex items-center justify-center text-white active:opacity-50">
            <NextIcon size={32} />
          </button>

          <button
            onClick={onCycleRepeat}
            className={`w-10 h-10 flex items-center justify-center active:opacity-50 transition-colors ${repeat !== 'none' ? 'text-white' : 'text-white/30'}`}
          >
            {repeat === 'one' ? <RepeatOneIcon size={22} /> : <RepeatIcon size={22} />}
          </button>
        </div>
      </div>
    </div>
  )
}
