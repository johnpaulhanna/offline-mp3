import type { PlayerState } from '../hooks/usePlayer'
import { CoverArt } from './CoverArt'

interface Props {
  state: PlayerState
  onTogglePlay: () => void
  onNext: () => void
  onExpand: () => void
}

export function MiniPlayer({ state, onTogglePlay, onNext, onExpand }: Props) {
  const { currentTrack, playing } = state
  if (!currentTrack) return null

  return (
    <div
      className="flex items-center gap-3 px-4 bg-gray-900 border-t border-gray-800"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))', paddingTop: '0.75rem' }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
        <CoverArt blob={currentTrack.coverBlob} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
          <p className="text-xs text-gray-400 truncate">{currentTrack.artist}</p>
        </div>
      </div>

      <button
        onClick={onTogglePlay}
        className="text-white text-2xl w-10 h-10 flex items-center justify-center"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? '⏸' : '▶'}
      </button>

      <button
        onClick={onNext}
        className="text-white text-xl w-10 h-10 flex items-center justify-center"
        aria-label="Next"
      >
        ⏭
      </button>
    </div>
  )
}
