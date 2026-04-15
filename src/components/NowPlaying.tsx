import type { PlayerState, RepeatMode } from '../hooks/usePlayer'
import { CoverArt } from './CoverArt'

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

function repeatLabel(mode: RepeatMode) {
  if (mode === 'one') return '🔂'
  if (mode === 'all') return '🔁'
  return '🔁'
}

export function NowPlaying({
  state,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onClose,
}: Props) {
  const { currentTrack, playing, position, duration, shuffle, repeat } = state

  if (!currentTrack) return null

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col z-50"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="text-white text-2xl w-10 h-10 flex items-center justify-center">
          ⌄
        </button>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Now Playing</p>
        <div className="w-10" />
      </div>

      {/* Cover art */}
      <div className="flex-1 flex items-center justify-center px-8">
        <CoverArt
          blob={currentTrack.coverBlob}
          size={Math.min(300, window.innerWidth - 64)}
          className="rounded-xl shadow-2xl"
        />
      </div>

      {/* Track info */}
      <div className="px-6 py-2">
        <p className="text-white text-xl font-bold truncate">{currentTrack.title}</p>
        <p className="text-gray-400 text-sm truncate">{currentTrack.artist} — {currentTrack.album}</p>
      </div>

      {/* Seek bar */}
      <div className="px-6 pb-1">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.5}
          value={position}
          onChange={e => onSeek(parseFloat(e.target.value))}
          className="w-full accent-white"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-8 py-4">
        <button
          onClick={onToggleShuffle}
          className={`text-2xl ${shuffle ? 'text-green-400' : 'text-gray-500'}`}
          aria-label="Shuffle"
        >
          🔀
        </button>

        <button onClick={onPrev} className="text-white text-3xl">⏮</button>

        <button
          onClick={onTogglePlay}
          className="bg-white text-black rounded-full w-16 h-16 flex items-center justify-center text-2xl"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : '▶'}
        </button>

        <button onClick={onNext} className="text-white text-3xl">⏭</button>

        <button
          onClick={onCycleRepeat}
          className={`text-2xl ${repeat !== 'none' ? 'text-green-400' : 'text-gray-500'}`}
          aria-label="Repeat"
        >
          {repeatLabel(repeat)}
          {repeat === 'one' && <span className="text-xs align-super">1</span>}
        </button>
      </div>
    </div>
  )
}
