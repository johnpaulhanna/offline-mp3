import type { Track } from '../db'

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

  // 'play' and 'pause' are deliberately left to the browser.
  //
  // A media session action handler *replaces* Safari's own handling of that
  // button, and a handler is JavaScript — it can only run while this page is
  // alive. Playing audio keeps the page alive, so pausing is fine. But once
  // paused and backgrounded there is nothing keeping it alive, iOS freezes the
  // page, and the play tap then called into a handler that could never run. The
  // music simply never came back.
  //
  // With no handler, Safari plays and pauses the <audio> element itself, at the
  // native level, exactly as it does for a plain audio tag — and that keeps
  // working while the page is frozen. Null them explicitly in case a previous
  // version of this session installed one.
  setHandler('play', null)
  setHandler('pause', null)

  // playbackState is left alone for the same reason. Setting it explicitly
  // overrides what Safari infers from the element, and a value that goes stale
  // while the page is frozen makes iOS send the wrong action — a play tap
  // arriving as 'pause' on already-paused audio, which is silence.
  navigator.mediaSession.playbackState = 'none'

  // These genuinely need us: they change which track is loaded, which Safari
  // cannot do on its own. They only work while the page is alive, which is the
  // case whenever audio is actually playing.
  setHandler('nexttrack', handlers.next)
  setHandler('previoustrack', handlers.prev)
  setHandler('seekto', details => {
    if (details.seekTime != null) handlers.seekTo(details.seekTime)
  })

  // Kept deliberately, unlike play/pause. Safari's default for 'stop' tears the
  // session down, and then there is nothing left to resume from. Registering a
  // handler suppresses that default — and if we are frozen and it never runs,
  // the action harmlessly does nothing, which is the outcome we want anyway.
  setHandler('stop', handlers.stop)
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
