import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { db, type Track } from '../db'
import { updateMediaSession, clearMediaSession } from '../lib/mediaSession'
import { setAudioElement, resumeEQ, releaseEQ } from '../lib/audioEQ'
import {
  identityOrder,
  shuffledOrder,
  remapReorder,
  orderAfterInsert,
  orderAfterRemove,
  advanceOrder,
} from '../lib/queue'

export type RepeatMode = 'none' | 'all' | 'one'

// State updates stay pure: instead of touching the <audio> element inside a
// setState updater, they leave a request here that a single effect carries out.
type PlayerEffect =
  | { kind: 'load'; autoPlay: boolean }
  | { kind: 'pause' }
  | { kind: 'stop' }
  | null

export interface PlayerState {
  currentTrack: Track | null
  queue: Track[]
  queueIndex: number    // index into queue
  order: number[]       // play order: a permutation of queue indices
  orderPos: number      // position within order; order[orderPos] === queueIndex
  playing: boolean
  position: number
  duration: number
  shuffle: boolean
  repeat: RepeatMode
  speed: number
  effect: PlayerEffect
}

export interface QueueEntry {
  track: Track
  queueIndex: number
}

const SESSION_KEY = 'player-session'

interface SavedSession {
  queueIds: number[]
  queueIndex: number
  position: number
  shuffle: boolean
  repeat: RepeatMode
  speed: number
}

function readShuffle(): boolean {
  try {
    return localStorage.getItem('shuffle') === 'true'
  } catch {
    return false // storage blocked (private browsing)
  }
}

function readRepeat(): RepeatMode {
  try {
    const v = localStorage.getItem('repeat')
    return v === 'all' || v === 'one' ? v : 'none'
  } catch {
    return 'none' // storage blocked (private browsing)
  }
}

// Move to `orderPos` in `order` and ask the effect to load whatever lands there.
function playAt(s: PlayerState, order: number[], orderPos: number, autoPlay = true): PlayerState {
  const queueIndex = order[orderPos]
  return {
    ...s,
    order,
    orderPos,
    queueIndex,
    currentTrack: s.queue[queueIndex],
    position: 0,
    effect: { kind: 'load', autoPlay },
  }
}

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const pendingSeekRef = useRef<number | null>(null)
  const lastPositionRef = useRef(0)

  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    queueIndex: 0,
    order: [],
    orderPos: 0,
    playing: false,
    position: 0,
    duration: 0,
    shuffle: readShuffle(),
    repeat: readRepeat(),
    speed: 1,
    effect: null,
  })

  const loadTrack = useCallback(async (track: Track, autoPlay = true) => {
    const audio = audioRef.current
    if (!audio) return

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    const fileBlob = track.id
      ? ((await db.trackFiles.get(track.id))?.fileBlob ?? track.fileBlob)
      : track.fileBlob
    if (!fileBlob) return

    lastPositionRef.current = 0
    const url = URL.createObjectURL(fileBlob)
    objectUrlRef.current = url
    audio.src = url
    audio.load()

    if (autoPlay) {
      resumeEQ()
      audio.play().catch(() => {}) // autoplay rejection: the UI still shows paused
    }
  }, [])

  // What to do when the current track runs out. Stable, so the 'ended' listener
  // can be wired up once at mount without a mutable ref.
  const advance = useCallback(() => {
    setState(s => {
      if (!s.order.length) return s
      if (s.repeat === 'one') return playAt(s, s.order, s.orderPos)
      const next = advanceOrder(s.order, s.orderPos, s.shuffle, s.repeat === 'all')
      if (!next) return { ...s, playing: false, effect: { kind: 'pause' } }
      return playAt(s, next.order, next.orderPos)
    })
  }, [])

  // Init audio element once
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio
    setAudioElement(audio)

    let rafPending: number | null = null
    const onTimeUpdate = () => {
      if (rafPending !== null) return
      rafPending = requestAnimationFrame(() => {
        rafPending = null
        const t = audio.currentTime
        if (Math.abs(t - lastPositionRef.current) < 0.25) return
        lastPositionRef.current = t
        setState(s => ({ ...s, position: t }))
      })
    }
    const onDurationChange = () => setState(s => ({ ...s, duration: audio.duration || 0 }))
    const onPlay = () => setState(s => ({ ...s, playing: true }))
    const onPause = () => setState(s => ({ ...s, playing: false }))
    const onLoadedMetadata = () => {
      if (pendingSeekRef.current !== null) {
        audio.currentTime = Math.min(pendingSeekRef.current, Math.max(0, audio.duration - 0.5))
        pendingSeekRef.current = null
      }
    }

    // Release EQ whenever the page goes hidden so ctx.close() has time to
    // complete long before the user might press play from the lock screen.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') releaseEQ()
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', advance)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (rafPending !== null) cancelAnimationFrame(rafPending)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', advance)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      audio.pause()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [advance])

  // The one place that touches the audio element in response to state changes.
  const { effect, currentTrack } = state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !effect) return

    if (effect.kind === 'pause') {
      audio.pause()
      return
    }

    if (effect.kind === 'stop' || !currentTrack) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      return
    }

    loadTrack(currentTrack, effect.autoPlay)
  }, [effect, currentTrack, loadTrack])

  // Restore last session on mount — loads track paused at saved position
  useEffect(() => {
    const restore = async () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (!raw) return
        const session: SavedSession = JSON.parse(raw)
        if (!session.queueIds?.length) return

        const tracks = await db.tracks.bulkGet(session.queueIds)
        const covers = await db.trackCovers.bulkGet(session.queueIds)
        const originalId = session.queueIds[session.queueIndex]

        const validTracks: Track[] = []
        for (let i = 0; i < tracks.length; i++) {
          const t = tracks[i]
          if (t) validTracks.push({ ...t, coverBlob: covers[i]?.coverBlob ?? t.coverBlob ?? null })
        }
        if (!validTracks.length) return

        const idx = Math.max(0, validTracks.findIndex(t => t.id === originalId))
        const track = validTracks[idx]

        if (session.position > 2) pendingSeekRef.current = session.position

        // Loaded directly rather than through the effect, so the restored track
        // stays paused and the saved position survives.
        await loadTrack(track, false)

        const shuffle = session.shuffle ?? readShuffle()
        const order = shuffle
          ? shuffledOrder(validTracks.length, idx)
          : identityOrder(validTracks.length)

        setState(s => ({
          ...s,
          queue: validTracks,
          queueIndex: idx,
          order,
          orderPos: shuffle ? 0 : idx,
          currentTrack: track,
          shuffle,
          repeat: (session.repeat as RepeatMode) ?? s.repeat,
          speed: session.speed ?? 1,
        }))
      } catch { /* ignore corrupt saved state */ }
    }
    restore()
  }, [loadTrack])

  // Save session whenever relevant state changes
  useEffect(() => {
    if (!state.currentTrack?.id) return
    try {
      const session: SavedSession = {
        queueIds: state.queue.map(t => t.id!).filter(Boolean),
        queueIndex: state.queueIndex,
        position: state.position,
        shuffle: state.shuffle,
        repeat: state.repeat,
        speed: state.speed,
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch { /* ignore quota errors */ }
  }, [state.currentTrack?.id, state.queue, state.queueIndex, state.position, state.shuffle, state.repeat, state.speed])

  const playQueue = useCallback((tracks: Track[], startIndex: number) => {
    setState(s => {
      if (!tracks.length) return s
      const start = Math.max(0, Math.min(tracks.length - 1, startIndex))
      const order = s.shuffle ? shuffledOrder(tracks.length, start) : identityOrder(tracks.length)
      return playAt({ ...s, queue: tracks }, order, s.shuffle ? 0 : start)
    })
  }, [])

  const play = useCallback(() => {
    // Must stay synchronous — iOS loses the Media Session user gesture context
    // across await boundaries, causing audio.play() to silently fail.
    if (document.visibilityState === 'hidden') {
      releaseEQ() // synchronously free AudioContext so audio routes to speakers
    } else {
      resumeEQ() // fire-and-forget resume in foreground (no await)
    }
    audioRef.current?.play().catch(() => {})
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    // Release the AudioContext now, while we have time before the user presses
    // play again. ctx.close() is async at the native level — doing it here
    // (seconds before play) ensures it's fully closed by the time play() runs.
    if (document.visibilityState === 'hidden') releaseEQ()
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      resumeEQ()
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [])

  const seek = useCallback((time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time
  }, [])

  const next = useCallback(() => {
    setState(s => {
      if (!s.order.length) return s
      // A manual skip ignores repeat-one — the user asked for a different song.
      const adv = advanceOrder(s.order, s.orderPos, s.shuffle, s.repeat === 'all')
      if (!adv) return { ...s, playing: false, effect: { kind: 'pause' } }
      return playAt(s, adv.order, adv.orderPos)
    })
  }, [])

  const prev = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    setState(s => {
      if (!s.order.length) return s
      return playAt(s, s.order, s.orderPos > 0 ? s.orderPos - 1 : 0)
    })
  }, [])

  const toggleShuffle = useCallback(() => {
    setState(s => {
      const shuffle = !s.shuffle
      if (!s.queue.length) return { ...s, shuffle, order: [], orderPos: 0 }
      // Re-deal the lap around whatever is playing now; the current track keeps going.
      const order = shuffle
        ? shuffledOrder(s.queue.length, s.queueIndex)
        : identityOrder(s.queue.length)
      return { ...s, shuffle, order, orderPos: shuffle ? 0 : s.queueIndex }
    })
  }, [])

  const cycleRepeat = useCallback(() => {
    setState(s => {
      const modes: RepeatMode[] = ['none', 'all', 'one']
      return { ...s, repeat: modes[(modes.indexOf(s.repeat) + 1) % modes.length] }
    })
  }, [])

  const playNext = useCallback((track: Track) => {
    setState(s => {
      if (!s.currentTrack || !s.queue.length) return playAt({ ...s, queue: [track] }, [0], 0)
      const at = s.queueIndex + 1
      const queue = [...s.queue]
      queue.splice(at, 0, track)
      const order = orderAfterInsert(s.order, at, s.orderPos + 1)
      return { ...s, queue, order, queueIndex: order[s.orderPos] }
    })
  }, [])

  const addToQueue = useCallback((track: Track) => {
    setState(s => {
      if (!s.currentTrack || !s.queue.length) return playAt({ ...s, queue: [track] }, [0], 0)
      const queue = [...s.queue, track]
      const order = orderAfterInsert(s.order, queue.length - 1, s.order.length)
      return { ...s, queue, order, queueIndex: order[s.orderPos] }
    })
  }, [])

  const jumpTo = useCallback((queueIndex: number) => {
    setState(s => {
      const pos = s.order.indexOf(queueIndex)
      if (pos < 0) return s
      return playAt(s, s.order, pos)
    })
  }, [])

  const reorderQueue = useCallback((from: number, to: number) => {
    setState(s => {
      const n = s.queue.length
      if (from === to || from < 0 || from >= n || to < 0 || to >= n) return s
      const queue = [...s.queue]
      const [moved] = queue.splice(from, 1)
      queue.splice(to, 0, moved)
      const order = s.order.map(i => remapReorder(i, from, to))
      return { ...s, queue, order, queueIndex: order[s.orderPos] }
    })
  }, [])

  const removeFromQueue = useCallback((queueIndex: number) => {
    setState(s => {
      if (queueIndex < 0 || queueIndex >= s.queue.length) return s
      const queue = s.queue.filter((_, i) => i !== queueIndex)
      const order = orderAfterRemove(s.order, queueIndex)
      if (!order.length) {
        return {
          ...s,
          queue: [],
          order: [],
          orderPos: 0,
          queueIndex: 0,
          currentTrack: null,
          playing: false,
          effect: { kind: 'stop' },
        }
      }
      if (queueIndex === s.queueIndex) {
        // Whatever slid into this slot becomes the current track.
        const orderPos = Math.min(s.orderPos, order.length - 1)
        return playAt({ ...s, queue }, order, orderPos, s.playing)
      }
      const removedPos = s.order.indexOf(queueIndex)
      const orderPos = removedPos < s.orderPos ? s.orderPos - 1 : s.orderPos
      return { ...s, queue, order, orderPos, queueIndex: order[orderPos] }
    })
  }, [])

  const setSpeed = useCallback((speed: number) => {
    setState(s => ({ ...s, speed }))
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = state.speed
  }, [state.speed])

  // What plays after the current track, in play order — this is what the queue
  // sheet shows, so it follows the shuffled lap rather than the raw queue.
  const upcoming = useMemo<QueueEntry[]>(
    () =>
      state.order
        .slice(state.orderPos + 1)
        .map(i => ({ track: state.queue[i], queueIndex: i }))
        .filter((e): e is QueueEntry => e.track !== undefined),
    [state.order, state.orderPos, state.queue]
  )

  // Persist playback preferences outside the updaters, so the updaters stay pure.
  useEffect(() => {
    try {
      localStorage.setItem('shuffle', String(state.shuffle))
    } catch {
      // storage blocked (private browsing) — the setting just won't survive a restart
    }
  }, [state.shuffle])

  useEffect(() => {
    try {
      localStorage.setItem('repeat', state.repeat)
    } catch {
      // storage blocked (private browsing)
    }
  }, [state.repeat])

  // Update Media Session when track changes
  useEffect(() => {
    if (!currentTrack) {
      clearMediaSession()
      return
    }
    updateMediaSession(currentTrack, { play, pause, next, prev, seekTo: seek })
  }, [currentTrack, play, pause, next, prev, seek])

  // Sync Media Session playback state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused'
  }, [state.playing])

  return {
    state,
    upcoming,
    playQueue,
    playNext,
    addToQueue,
    togglePlay,
    seek,
    next,
    prev,
    toggleShuffle,
    cycleRepeat,
    reorderQueue,
    removeFromQueue,
    jumpTo,
    setSpeed,
  }
}
