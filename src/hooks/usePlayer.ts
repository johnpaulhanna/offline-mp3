import { useRef, useState, useCallback, useEffect } from 'react'
import { db, type Track } from '../db'
import { updateMediaSession } from '../lib/mediaSession'
import { setAudioElement, resumeEQ, releaseEQ } from '../lib/audioEQ'

export type RepeatMode = 'none' | 'all' | 'one'

export interface PlayerState {
  currentTrack: Track | null
  queue: Track[]
  queueIndex: number
  playing: boolean
  position: number
  duration: number
  shuffle: boolean
  repeat: RepeatMode
  speed: number
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

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const pendingSeekRef = useRef<number | null>(null)
  const advanceRef = useRef<() => void>(() => {})
  const lastPositionRef = useRef(0)

  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    queueIndex: 0,
    playing: false,
    position: 0,
    duration: 0,
    shuffle: localStorage.getItem('shuffle') === 'true',
    repeat: 'none',
    speed: 1,
  })

  // Defined before effects so restore effect can call it directly
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

    const url = URL.createObjectURL(fileBlob)
    objectUrlRef.current = url
    audio.src = url
    audio.load()

    if (autoPlay) {
      resumeEQ()
      audio.play().catch(() => {})
    }
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
    const onEnded = () => advanceRef.current()
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
    audio.addEventListener('ended', onEnded)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (rafPending !== null) cancelAnimationFrame(rafPending)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      audio.pause()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

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

        await loadTrack(track, false)

        setState(s => ({
          ...s,
          queue: validTracks,
          queueIndex: idx,
          currentTrack: track,
          shuffle: session.shuffle ?? s.shuffle,
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
    setState(s => ({
      ...s,
      queue: tracks,
      queueIndex: startIndex,
      currentTrack: tracks[startIndex],
    }))
    loadTrack(tracks[startIndex], true)
  }, [loadTrack])

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
      if (!s.queue.length) return s
      let nextIndex: number
      if (s.shuffle) {
        nextIndex = Math.floor(Math.random() * s.queue.length)
      } else {
        nextIndex = s.queueIndex + 1
        if (nextIndex >= s.queue.length) {
          if (s.repeat === 'all') nextIndex = 0
          else return { ...s, playing: false }
        }
      }
      const track = s.queue[nextIndex]
      loadTrack(track, true)
      return { ...s, queueIndex: nextIndex, currentTrack: track }
    })
  }, [loadTrack])

  const prev = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    setState(s => {
      if (!s.queue.length) return s
      const prevIndex = s.queueIndex - 1 < 0 ? 0 : s.queueIndex - 1
      const track = s.queue[prevIndex]
      loadTrack(track, true)
      return { ...s, queueIndex: prevIndex, currentTrack: track }
    })
  }, [loadTrack])

  const toggleShuffle = useCallback(() => {
    setState(s => {
      const next = !s.shuffle
      try { localStorage.setItem('shuffle', String(next)) } catch {}
      return { ...s, shuffle: next }
    })
  }, [])

  const playNext = useCallback((track: Track) => {
    setState(s => {
      if (!s.currentTrack) {
        loadTrack(track, true)
        return { ...s, queue: [track], queueIndex: 0, currentTrack: track }
      }
      const newQueue = [...s.queue]
      newQueue.splice(s.queueIndex + 1, 0, track)
      return { ...s, queue: newQueue }
    })
  }, [loadTrack])

  const addToQueue = useCallback((track: Track) => {
    setState(s => {
      if (!s.currentTrack) {
        loadTrack(track, true)
        return { ...s, queue: [track], queueIndex: 0, currentTrack: track }
      }
      return { ...s, queue: [...s.queue, track] }
    })
  }, [loadTrack])

  const jumpTo = useCallback((index: number) => {
    setState(s => {
      if (index < 0 || index >= s.queue.length) return s
      const track = s.queue[index]
      loadTrack(track, true)
      return { ...s, queueIndex: index, currentTrack: track }
    })
  }, [loadTrack])

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setState(s => {
      if (fromIndex === toIndex) return s
      const newQueue = [...s.queue]
      const [moved] = newQueue.splice(fromIndex, 1)
      newQueue.splice(toIndex, 0, moved)
      let qi = s.queueIndex
      if (fromIndex === qi) qi = toIndex
      else if (fromIndex < qi && toIndex >= qi) qi--
      else if (fromIndex > qi && toIndex <= qi) qi++
      return { ...s, queue: newQueue, queueIndex: qi }
    })
  }, [])

  const removeFromQueue = useCallback((index: number) => {
    setState(s => {
      const newQueue = [...s.queue]
      newQueue.splice(index, 1)
      if (index === s.queueIndex) {
        if (newQueue.length === 0) {
          return { ...s, queue: [], queueIndex: 0, currentTrack: null, playing: false }
        }
        const nextIndex = Math.min(index, newQueue.length - 1)
        const track = newQueue[nextIndex]
        loadTrack(track, s.playing)
        return { ...s, queue: newQueue, queueIndex: nextIndex, currentTrack: track }
      }
      const qi = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex
      return { ...s, queue: newQueue, queueIndex: qi }
    })
  }, [loadTrack])

  const cycleRepeat = useCallback(() => {
    setState(s => {
      const modes: RepeatMode[] = ['none', 'all', 'one']
      const next = modes[(modes.indexOf(s.repeat) + 1) % modes.length]
      return { ...s, repeat: next }
    })
  }, [])

  const setSpeed = useCallback((speed: number) => {
    setState(s => ({ ...s, speed }))
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = state.speed
  }, [state.speed])

  // Wire advance logic — runs every render so it always captures fresh state
  useEffect(() => {
    advanceRef.current = () => {
      setState(s => {
        if (!s.queue.length) return s
        if (s.repeat === 'one') {
          loadTrack(s.queue[s.queueIndex], true)
          return s
        }
        let nextIndex: number
        if (s.shuffle) {
          nextIndex = Math.floor(Math.random() * s.queue.length)
        } else {
          nextIndex = s.queueIndex + 1
          if (nextIndex >= s.queue.length) {
            if (s.repeat === 'all') nextIndex = 0
            else return { ...s, playing: false }
          }
        }
        const track = s.queue[nextIndex]
        loadTrack(track, true)
        return { ...s, queueIndex: nextIndex, currentTrack: track }
      })
    }
  })

  // Update Media Session when track changes
  useEffect(() => {
    if (!state.currentTrack) return
    updateMediaSession(state.currentTrack, { play, pause, next, prev, seekTo: seek })
  }, [state.currentTrack, play, pause, next, prev, seek])

  // Sync Media Session playback state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused'
  }, [state.playing])

  return { state, playQueue, playNext, addToQueue, togglePlay, seek, next, prev, toggleShuffle, cycleRepeat, reorderQueue, removeFromQueue, jumpTo, setSpeed }
}
