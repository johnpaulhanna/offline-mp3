import type { Track } from '../db'
import { logEvent } from './debugLog'

let coverUrl: string | null = null

type Handler = MediaSessionActionHandler | null

function setHandler(action: MediaSessionAction, handler: Handler) {
  try {
    navigator.mediaSession.setActionHandler(action, handler)
  } catch {
    // action unsupported on this browser
  }
}

export function updateMediaSession(
  track: Track,
  handlers: {
    play: () => void
    pause: () => void
    next: () => void
    prev: () => void
    seekTo: (time: number) => void
    stop: () => void
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

  // Handlers are registered again. Dropping them so Safari would drive the
  // element natively did not fix the lock screen, and it risks the opposite
  // problem: if Safari has no default action for a web page's media element,
  // play would do nothing even in the foreground. Each one logs, so the
  // diagnostics sheet shows whether the action reached us at all.
  setHandler('play', () => {
    logEvent('mediasession:play')
    handlers.play()
  })
  setHandler('pause', () => {
    logEvent('mediasession:pause')
    handlers.pause()
  })
  setHandler('nexttrack', () => {
    logEvent('mediasession:next')
    handlers.next()
  })
  setHandler('previoustrack', () => {
    logEvent('mediasession:prev')
    handlers.prev()
  })
  setHandler('seekto', details => {
    logEvent('mediasession:seekto', String(details.seekTime))
    if (details.seekTime != null) handlers.seekTo(details.seekTime)
  })

  // Kept deliberately, unlike play/pause. Safari's default for 'stop' tears the
  // session down, and then there is nothing left to resume from. Registering a
  // handler suppresses that default — and if we are frozen and it never runs,
  // the action harmlessly does nothing, which is the outcome we want anyway.
  setHandler('stop', () => {
    logEvent('mediasession:stop')
    handlers.stop()
  })
}

// Anchor the lock-screen scrubber. Without this iOS estimates position itself
// and drifts, and the elapsed time can disagree with the app.
export function updatePositionState(position: number, duration: number, playbackRate: number) {
  if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return
  if (!isFinite(duration) || duration <= 0) return
  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: playbackRate > 0 ? playbackRate : 1,
      position: Math.max(0, Math.min(position, duration)),
    })
  } catch {
    // Safari throws on inconsistent values; it just falls back to its own estimate
  }
}

// iOS picks which action a single AirPods tap sends by reading playbackState,
// so it has to be right even while the page is frozen. Callers set it
// synchronously rather than waiting for a React render.
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
  // Drop the handlers too, or the lock screen keeps offering controls for a
  // queue that no longer exists.
  const actions: MediaSessionAction[] = ['play', 'pause', 'nexttrack', 'previoustrack', 'seekto', 'stop']
  for (const action of actions) setHandler(action, null)
}
