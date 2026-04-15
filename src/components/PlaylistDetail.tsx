import { usePlaylistTracks, removeFromPlaylist } from '../hooks/usePlaylists'
import type { Playlist, Track } from '../db'
import { CoverArt } from './CoverArt'
import { ChevronLeftIcon, PlayIcon, ShuffleIcon, XIcon } from './Icons'

interface Props {
  playlist: Playlist
  currentTrackId?: number
  playing: boolean
  onPlay: (tracks: Track[], index: number) => void
  onPlayShuffle: (tracks: Track[]) => void
  onBack: () => void
}

export function PlaylistDetail({ playlist, currentTrackId, playing, onPlay, onPlayShuffle, onBack }: Props) {
  const data = usePlaylistTracks(playlist.id!)

  const tracks = data?.tracks ?? []
  const pts = data?.pts ?? []

  const formatDuration = (s: number) => {
    if (!s || isNaN(s)) return '--:--'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleRemove = async (e: React.MouseEvent, ptId: number) => {
    e.stopPropagation()
    await removeFromPlaylist(ptId)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
        <button
          onClick={onBack}
          className="text-white w-9 h-9 flex items-center justify-center active:opacity-50"
          aria-label="Back"
        >
          <ChevronLeftIcon size={22} />
        </button>
        <p className="text-white font-bold text-base flex-1 truncate">{playlist.name}</p>
        <span className="text-gray-500 text-xs">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Play / Shuffle buttons */}
      {tracks.length > 0 && (
        <div className="flex gap-3 px-4 py-3 border-b border-white/5 shrink-0">
          <button
            onClick={() => onPlay(tracks, 0)}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-black text-sm font-semibold py-2.5 rounded-xl active:scale-95 transition-transform"
          >
            <PlayIcon size={16} />
            Play All
          </button>
          <button
            onClick={() => onPlayShuffle(tracks)}
            className="flex-1 flex items-center justify-center gap-2 bg-white/10 text-white text-sm font-semibold py-2.5 rounded-xl active:scale-95 transition-transform"
          >
            <ShuffleIcon size={16} />
            Shuffle
          </button>
        </div>
      )}

      {/* Track list */}
      <div className="overflow-y-auto flex-1">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
            <p className="text-white font-semibold">Empty playlist</p>
            <p className="text-gray-500 text-sm">Go to Songs and tap the playlist icon on a track to add music here.</p>
          </div>
        ) : (
          tracks.map((track, idx) => {
            const isActive = track.id === currentTrackId
            const pt = pts[idx]
            return (
              <div
                key={pt?.id ?? idx}
                onClick={() => onPlay(tracks, idx)}
                className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 active:bg-white/5 cursor-pointer ${isActive ? 'bg-white/5' : ''}`}
              >
                <CoverArt blob={track.coverBlob} size={48} className="rounded-lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate leading-snug">
                    {isActive && playing && (
                      <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1.5 mb-0.5 animate-pulse" />
                    )}
                    {track.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{track.artist}</p>
                </div>
                <span className="text-xs text-gray-600 shrink-0 tabular-nums">{formatDuration(track.duration)}</span>
                <button
                  onClick={e => pt?.id != null && handleRemove(e, pt.id)}
                  className="w-7 h-7 flex items-center justify-center text-white/20 active:text-red-400 transition-colors shrink-0 ml-0.5"
                  aria-label="Remove from playlist"
                >
                  <XIcon size={14} />
                </button>
              </div>
            )
          })
        )}
        <div className="h-2" />
      </div>
    </div>
  )
}
