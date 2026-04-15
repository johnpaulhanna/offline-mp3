import { useEffect, useState } from 'react'
import { usePlayer } from './hooks/usePlayer'
import { Library } from './components/Library'
import { NowPlaying } from './components/NowPlaying'
import { MiniPlayer } from './components/MiniPlayer'
import { ImportButton } from './components/ImportButton'
import { StorageInfo } from './components/StorageInfo'
import type { Track } from './db'

export default function App() {
  const { state, playQueue, togglePlay, seek, next, prev, toggleShuffle, cycleRepeat } = usePlayer()
  const [showNowPlaying, setShowNowPlaying] = useState(false)

  // Request persistent storage on first use
  useEffect(() => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      navigator.storage.persist().catch(() => {})
    }
  }, [])

  const handlePlay = (tracks: Track[], index: number) => {
    playQueue(tracks, index)
    setShowNowPlaying(true)
  }

  return (
    <div className="flex flex-col h-full bg-black text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <h1 className="text-lg font-bold">Music</h1>
        <ImportButton />
      </div>

      {/* Library */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Library
          onPlay={handlePlay}
          currentTrackId={state.currentTrack?.id}
          playing={state.playing}
        />
      </div>

      {/* Storage info */}
      <StorageInfo />

      {/* Mini player */}
      {state.currentTrack && !showNowPlaying && (
        <MiniPlayer
          state={state}
          onTogglePlay={togglePlay}
          onNext={next}
          onExpand={() => setShowNowPlaying(true)}
        />
      )}

      {/* Now Playing overlay */}
      {showNowPlaying && state.currentTrack && (
        <NowPlaying
          state={state}
          onTogglePlay={togglePlay}
          onNext={next}
          onPrev={prev}
          onSeek={seek}
          onToggleShuffle={toggleShuffle}
          onCycleRepeat={cycleRepeat}
          onClose={() => setShowNowPlaying(false)}
        />
      )}
    </div>
  )
}
