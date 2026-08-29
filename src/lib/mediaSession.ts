import type { Track } from '../db'

let coverUrl: string | null = null

export function updateMediaSession(
  track: Track,
  handlers: {
    play: () => void
    pause: () => void
    next: () => void
    prev: () => void
    seekTo: (time: number) => void
  }
) {
  if (!('mediaSession' in navigator)) return

  if (coverUrl) {
    URL.revokeObjectURL(coverUrl)
    coverUrl = null
  }

  const artwork: MediaImage[] = []
  if (track.coverBlob) {
    coverUrl = URL.createObjectURL(track.coverBlob)
    artwork.push({ src: coverUrl, sizes: '512x512', type: track.coverBlob.type })
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork,
  })

  navigator.mediaSession.setActionHandler('play', handlers.play)
  navigator.mediaSession.setActionHandler('pause', handlers.pause)
  navigator.mediaSession.setActionHandler('nexttrack', handlers.next)
  navigator.mediaSession.setActionHandler('previoustrack', handlers.prev)
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) handlers.seekTo(details.seekTime)
  })
  // Intercept stop so the browser doesn't clear the session — treat it as pause
  // so the user can still resume from the lock screen afterward.
  navigator.mediaSession.setActionHandler('stop', handlers.pause)
}

// iOS works out what a single AirPods tap means by reading playbackState: if it
// believes we are playing, the tap sends 'pause'. So this has to be true at all
// times, including while the page is suspended in the background — which is why
// callers set it synchronously rather than letting a React render get to it.
export function setPlaybackState(playing: boolean) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
}

export function clearMediaSession() {
  if (!('mediaSession' in navigator)) return
  if (coverUrl) {
    URL.revokeObjectURL(coverUrl)
    coverUrl = null
  }
  navigator.mediaSession.metadata = null
  navigator.mediaSession.playbackState = 'none'
}
