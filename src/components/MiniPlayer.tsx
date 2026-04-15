import type { PlayerState } from '../hooks/usePlayer'
import { CoverArt } from './CoverArt'
import { PlayIcon, PauseIcon, NextIcon } from './Icons'

interface Props {
  state: PlayerState
  onTogglePlay: () => void
  onNext: () => void
  onExpand: () => void
}

export function MiniPlayer({ state, onTogglePlay, onNext, onExpand }: Props) {
  const { currentTrack, playing, position, duration } = state
  if (!currentTrack) return null

  const pct = duration > 0 ? (position / duration) * 100 : 0

  return (
    <div
      className="shrink-0 bg-gray-900/95 backdrop-blur border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Thin progress bar */}
      <div className="h-[2px] bg-white/10">
        <div className="h-full bg-white/60 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center gap-3 px-4 py-2">
        {/* Track info — tapping expands */}
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer py-1" onClick={onExpand}>
          <CoverArt blob={currentTrack.coverBlob} size={44} className="rounded-lg" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{currentTrack.title}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{currentTrack.artist}</p>
          </div>
        </div>

        <button
          onClick={onTogglePlay}
          className="text-white w-10 h-10 flex items-center justify-center active:opacity-60"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
        </button>

        <button
          onClick={onNext}
          className="text-white w-10 h-10 flex items-center justify-center active:opacity-60"
          aria-label="Next"
        >
          <NextIcon size={24} />
        </button>
      </div>
    </div>
  )
}
