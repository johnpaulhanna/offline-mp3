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
  if (!currentTrack) return null

  const pct = duration > 0 ? (position / duration) * 100 : 0

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col z-50 select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Drag handle / close */}
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

      {/* Cover art — fills available space */}
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

      {/* Seek bar */}
      <div className="px-6 pb-2">
        <div className="relative h-1 bg-white/20 rounded-full mb-1 cursor-pointer"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = (e.clientX - rect.left) / rect.width
            onSeek(ratio * (duration || 1))
          }}
        >
          <div
            className="absolute inset-y-0 left-0 bg-white rounded-full"
            style={{ width: `${pct}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow"
            style={{ left: `calc(${pct}% - 6px)` }}
          />
        </div>
        {/* Hidden range for touch scrubbing */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.5}
          value={position}
          onChange={e => onSeek(parseFloat(e.target.value))}
          className="absolute opacity-0 w-[calc(100%-3rem)] h-5 -mt-3 cursor-pointer"
          style={{ left: '1.5rem' }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-8 pb-4 pt-2">
        <button
          onClick={onToggleShuffle}
          className={`w-10 h-10 flex items-center justify-center transition-colors active:opacity-50 ${
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
          className={`w-10 h-10 flex items-center justify-center transition-colors active:opacity-50 ${
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
