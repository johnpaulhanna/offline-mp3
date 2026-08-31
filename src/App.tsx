import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { usePlayer } from './hooks/usePlayer'
import { Library } from './components/Library'
import { NowPlaying } from './components/NowPlaying'
import { MiniPlayer } from './components/MiniPlayer'
import { ImportButton } from './components/ImportButton'
import { TabBar, type Tab } from './components/TabBar'
import { PlaylistList } from './components/PlaylistList'
import { PlaylistDetail } from './components/PlaylistDetail'
import { ArtistsView } from './components/ArtistsView'
import { AlbumsView } from './components/AlbumsView'
import { fixCoversIfNeeded } from './lib/fixCovers'
import { useState } from 'react'
import type { Track, Playlist } from './db'

// How often to look for a new build while the app is open. Fails harmlessly offline.
const SW_POLL_MS = 20_000

export default function App() {
  const { state, upcoming, playQueue, playNext, addToQueue, togglePlay, seek, next, prev, toggleShuffle, cycleRepeat, reorderQueue, removeFromQueue, jumpTo, setSpeed } = usePlayer()
  const [showNowPlaying, setShowNowPlaying] = useState(false)
  const [tab, setTab] = useState<Tab>('songs')
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)

  // SW update — checks immediately on load and every 20s while open
  // updateServiceWorker(true) handles the reload itself; no controllerchange handler needed
  const swPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, r) {
      r?.update()
      swPollRef.current = setInterval(() => r?.update(), SW_POLL_MS)
    },
  })

  useEffect(() => () => {
    if (swPollRef.current) clearInterval(swPollRef.current)
  }, [])

  // Request persistent storage — re-request on first user gesture since iOS ignores it on page load
  useEffect(() => {
    const request = () => {
      if ('storage' in navigator && 'persist' in navigator.storage) {
        navigator.storage.persist().catch(() => {})
      }
    }
    request()
    window.addEventListener('pointerdown', request, { once: true })
    return () => window.removeEventListener('pointerdown', request)
  }, [])

  // Re-extract covers for existing tracks into the new trackCovers table
  useEffect(() => {
    const t = setTimeout(() => fixCoversIfNeeded(), 3000)
    return () => clearTimeout(t)
  }, [])

  // These are stable so the memoised content below can actually stay memoised.
  const handlePlay = useCallback((tracks: Track[], index: number) => {
    playQueue(tracks, index)
  }, [playQueue])

  const handlePlayAndOpen = useCallback((tracks: Track[], index: number) => {
    playQueue(tracks, index)
    setShowNowPlaying(true)
  }, [playQueue])

  const shuffle = state.shuffle
  const handlePlayShuffle = useCallback((tracks: Track[]) => {
    if (!tracks.length) return
    // playQueue deals a fresh shuffled lap starting from this track.
    if (!shuffle) toggleShuffle()
    playQueue(tracks, Math.floor(Math.random() * tracks.length))
    setShowNowPlaying(true)
  }, [shuffle, toggleShuffle, playQueue])

  const handleTabChange = useCallback((t: Tab) => {
    setTab(t)
    if (t === 'songs') setSelectedPlaylist(null)
  }, [])

  const handleBack = useCallback(() => setSelectedPlaylist(null), [])

  const currentTrackId = state.currentTrack?.id
  const playing = state.playing
  const content = useMemo(() => (
    <>
      {tab === 'songs' && (
        <Library
          onPlay={handlePlay}
          onPlayAndOpen={handlePlayAndOpen}
          onPlayNext={playNext}
          onAddToQueue={addToQueue}
          currentTrackId={currentTrackId}
          playing={playing}
        />
      )}
      {tab === 'artists' && (
        <ArtistsView
          onPlay={handlePlay}
          onPlayAndOpen={handlePlayAndOpen}
          onPlayNext={playNext}
          onAddToQueue={addToQueue}
          currentTrackId={currentTrackId}
          playing={playing}
        />
      )}
      {tab === 'albums' && (
        <AlbumsView
          onPlay={handlePlay}
          onPlayAndOpen={handlePlayAndOpen}
          onPlayNext={playNext}
          onAddToQueue={addToQueue}
          currentTrackId={currentTrackId}
          playing={playing}
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
          currentTrackId={currentTrackId}
          playing={playing}
          onPlay={handlePlay}
          onPlayAll={handlePlayAndOpen}
          onPlayNext={playNext}
          onAddToQueue={addToQueue}
          onPlayShuffle={handlePlayShuffle}
          onBack={handleBack}
        />
      )}
    </>
  ), [tab, selectedPlaylist, currentTrackId, playing, handlePlay, handlePlayAndOpen,
      playNext, addToQueue, handlePlayShuffle, handleBack])

  return (
    <div className="flex flex-col h-full bg-black text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* Update prompt — stays user-triggered on purpose. A silent auto-update
          once wiped people's libraries (f1da2c9), so this asks rather than acts. */}
      {needRefresh && (
        <div className="shrink-0 mx-3 mt-2 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.08] px-4 py-2.5">
          <span className="text-[13px] text-white/70">A new version is ready</span>
          <button
            onClick={() => updateServiceWorker(true)}
            className="text-[13px] font-semibold text-[#fc3c44] active:opacity-50 transition-opacity"
          >
            Update
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <h1 className="text-xl font-bold tracking-tight">
          {tab === 'playlists' && selectedPlaylist ? selectedPlaylist.name : 'Music'}
        </h1>
        {(tab === 'songs') && <ImportButton />}
      </div>

      {/* Main content — memoised on what it actually depends on. The player's
          position updates several times a second, and without this every one of
          them re-rendered the whole library, artist and album lists. */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {content}
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
          upcoming={upcoming}
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
          onSetSpeed={setSpeed}
        />
      )}
    </div>
  )
}
