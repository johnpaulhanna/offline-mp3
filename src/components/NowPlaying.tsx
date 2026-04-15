import { useRef, useState } from 'react'
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

  // Seek bar — pointer events for reliable iOS touch scrubbing
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

  if (!currentTrack) return null

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col z-50 select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Drag handle */}
      <div className="flex items-center justify-center pt-2 pb-1">
        <div className="w-10 h-1 rounded-full bg-white/20" />
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
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Now Playing</p>
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
        <p className="text-gray-400 text-sm truncate mt-0.5">{currentTrack.artist}</p>
      </div>

      {/* Seek bar — touch-friendly pointer-event scrubber */}
      <div className="px-6 pb-1">
        {/* Tall invisible hit area so finger doesn't have to land exactly on the thin bar */}
        <div
          ref={barRef}
          className="relative flex items-center touch-none cursor-pointer"
          style={{ height: 36 }}
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId)
            dragging.current = true
            const pct = pctFromPointer(e)
            setDragPct(pct)
            onSeek(pct * (duration || 1))
          }}
          onPointerMove={e => {
            if (!dragging.current) return
            const pct = pctFromPointer(e)
            setDragPct(pct)
            onSeek(pct * (duration || 1))
          }}
          onPointerUp={e => {
            if (!dragging.current) return
            dragging.current = false
            const pct = pctFromPointer(e)
            setDragPct(null)
            onSeek(pct * (duration || 1))
          }}
          onPointerCancel={() => {
            dragging.current = false
            setDragPct(null)
          }}
        >
          {/* Track */}
          <div className="w-full h-1 bg-white/20 rounded-full relative">
            <div
              className="absolute inset-y-0 left-0 bg-white rounded-full"
              style={{ width: `${displayPct}%` }}
            />
          </div>
          {/* Thumb */}
          <div
            className="absolute w-4 h-4 bg-white rounded-full shadow-lg top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `calc(${displayPct}% - 8px)` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatTime(dragPct !== null ? dragPct * duration : position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-8 pb-4 pt-2">
        <button
          onClick={onToggleShuffle}
          className={`w-10 h-10 flex items-center justify-center active:opacity-50 transition-colors ${
            shuffle ? 'text-white' : 'text-white/30'
          }`}
          aria-label="Shuffle"
        >
          <ShuffleIcon size={22} />
        </button>

        <button
          onClick={onPrev}
          className="w-12 h-12 flex items-center justify-center text-white active:opacity-50"
          aria-label="Previous"
        >
          <PrevIcon size={32} />
        </button>

        <button
          onClick={onTogglePlay}
          className="bg-white text-black rounded-full w-16 h-16 flex items-center justify-center active:scale-95 transition-transform shadow-lg"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
        </button>

        <button
          onClick={onNext}
          className="w-12 h-12 flex items-center justify-center text-white active:opacity-50"
          aria-label="Next"
        >
          <NextIcon size={32} />
        </button>

        <button
          onClick={onCycleRepeat}
          className={`w-10 h-10 flex items-center justify-center active:opacity-50 transition-colors ${
            repeat !== 'none' ? 'text-white' : 'text-white/30'
          }`}
          aria-label="Repeat"
        >
          {repeat === 'one' ? <RepeatOneIcon size={22} /> : <RepeatIcon size={22} />}
        </button>
      </div>
    </div>
  )
}
