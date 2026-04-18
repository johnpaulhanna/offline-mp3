import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { usePlayer } from './hooks/usePlayer'
import { Library } from './components/Library'
import { NowPlaying } from './components/NowPlaying'
import { MiniPlayer } from './components/MiniPlayer'
import { ImportButton } from './components/ImportButton'
import { TabBar, type Tab } from './components/TabBar'
import { PlaylistList } from './components/PlaylistList'
import { PlaylistDetail } from './components/PlaylistDetail'
import type { Track, Playlist } from './db'
import { fixCoverArtIfNeeded } from './lib/fixCoverArt'

export default function App() {
  const { state, playQueue, playNext, addToQueue, togglePlay, seek, next, prev, toggleShuffle, cycleRepeat, reorderQueue, removeFromQueue, jumpTo } = usePlayer()
  const [showNowPlaying, setShowNowPlaying] = useState(false)
  const [tab, setTab] = useState<Tab>('songs')
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)

  // SW update — checks immediately on load and every 20s while open
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, r) {
      r?.update()
      setInterval(() => r?.update(), 20_000)
    },
  })

  // When a new SW takes control (skipWaiting fires), reload to get fresh assets
  useEffect(() => {
    const handler = () => window.location.reload()
    navigator.serviceWorker?.addEventListener('controllerchange', handler)
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', handler)
  }, [])

  // Request persistent storage on first use
  useEffect(() => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      navigator.storage.persist().catch(() => {})
    }
  }, [])

  // One-time background migration to fix cover art for existing tracks
  useEffect(() => { fixCoverArtIfNeeded() }, [])

  const handlePlay = (tracks: Track[], index: number) => {
    playQueue(tracks, index)
  }

  const handlePlayAndOpen = (tracks: Track[], index: number) => {
    playQueue(tracks, index)
    setShowNowPlaying(true)
  }

  const handlePlayShuffle = (tracks: Track[]) => {
    const idx = Math.floor(Math.random() * tracks.length)
    if (!state.shuffle) toggleShuffle()
    playQueue(tracks, idx)
    setShowNowPlaying(true)
  }

  const handleTabChange = (t: Tab) => {
    setTab(t)
    if (t === 'songs') setSelectedPlaylist(null)
  }

  return (
    <div className="flex flex-col h-full bg-black text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* Update banner — shown when a new version is waiting */}
      {needRefresh && (
        <div className="shrink-0 bg-blue-600 flex items-center justify-between px-4 py-2 text-sm">
          <span>New version available</span>
          <button
            onClick={() => updateServiceWorker(true)}
            className="font-bold bg-white text-blue-600 px-3 py-1 rounded-full text-xs"
          >
            Update now
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <h1 className="text-xl font-bold tracking-tight">
          {tab === 'playlists' && selectedPlaylist ? selectedPlaylist.name : 'Music'}
        </h1>
        {tab === 'songs' && <ImportButton />}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tab === 'songs' && (
          <Library
            onPlay={handlePlay}
            onPlayAndOpen={handlePlayAndOpen}
            onPlayNext={playNext}
            onAddToQueue={addToQueue}
            currentTrackId={state.currentTrack?.id}
            playing={state.playing}
          />
        )}
        {tab === 'playlists' && !selectedPlaylist && (
          <PlaylistList
            onSelect={setSelectedPlaylist}
            onPlayAll={handlePlayAndOpen}
            onPlayShuffle={handlePlayShuffle}
          />
        )}
        {tab === 'playlists' && selectedPlaylist && (
          <PlaylistDetail
            playlist={selectedPlaylist}
            currentTrackId={state.currentTrack?.id}
            playing={state.playing}
            onPlay={handlePlay}
            onPlayAll={handlePlayAndOpen}
            onPlayNext={playNext}
            onAddToQueue={addToQueue}
            onPlayShuffle={handlePlayShuffle}
            onBack={() => setSelectedPlaylist(null)}
          />
        )}
      </div>

      {/* Mini player */}
      {state.currentTrack && !showNowPlaying && (
        <MiniPlayer
          state={state}
          onTogglePlay={togglePlay}
          onNext={next}
          onExpand={() => setShowNowPlaying(true)}
        />
      )}

      {/* Tab bar */}
      <TabBar active={tab} onChange={handleTabChange} />

      {/* Now Playing overlay — always mounted when a track exists so slide animation works */}
      {state.currentTrack && (
        <NowPlaying
          state={state}
          visible={showNowPlaying}
          onTogglePlay={togglePlay}
          onNext={next}
          onPrev={prev}
          onSeek={seek}
          onToggleShuffle={toggleShuffle}
          onCycleRepeat={cycleRepeat}
          onClose={() => setShowNowPlaying(false)}
          onJumpTo={jumpTo}
          onRemoveFromQueue={removeFromQueue}
          onReorderQueue={reorderQueue}
        />
      )}
    </div>
  )
}
