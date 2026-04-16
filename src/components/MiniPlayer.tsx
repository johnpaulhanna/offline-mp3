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
    <div className="shrink-0 px-3 pb-2">
      <div className="bg-gray-900 rounded-3xl overflow-hidden shadow-2xl shadow-black/60">
        {/* Thin progress bar */}
        <div className="h-[3px] bg-white/10">
          <div className="h-full bg-white/50 transition-[width] duration-75 ease-linear" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
            <CoverArt blob={currentTrack.coverBlob} size={42} className="rounded-xl" />
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
    </div>
  )
}
