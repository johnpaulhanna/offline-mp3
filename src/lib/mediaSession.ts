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
}

export function clearMediaSession() {
  if (!('mediaSession' in navigator)) return
  if (coverUrl) {
    URL.revokeObjectURL(coverUrl)
    coverUrl = null
  }
  navigator.mediaSession.metadata = null
}
