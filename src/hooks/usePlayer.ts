import { useRef, useState, useCallback, useEffect } from 'react'
import type { Track } from '../db'
import { updateMediaSession } from '../lib/mediaSession'

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
}

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    queueIndex: 0,
    playing: false,
    position: 0,
    duration: 0,
    shuffle: localStorage.getItem('shuffle') === 'true',
    repeat: 'none',
  })

  // Track last-reported position to throttle timeupdate re-renders
  const lastPositionRef = useRef(0)

  // Init audio element once
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio

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
    const onEnded = () => {
      // advance handled below via state snapshot via ref
      advanceRef.current()
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      if (rafPending !== null) cancelAnimationFrame(rafPending)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  // Keep a ref to advance so the 'ended' listener always has fresh state
  const advanceRef = useRef<() => void>(() => {})

  const loadTrack = useCallback((track: Track, autoPlay = true) => {
    const audio = audioRef.current
    if (!audio) return

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    const url = URL.createObjectURL(track.fileBlob)
    objectUrlRef.current = url
    audio.src = url
    audio.load()

    if (autoPlay) {
      audio.play().catch(() => {})
    }
  }, [])

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
    audioRef.current?.play().catch(() => {})
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
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

  // Wire advance logic, which needs fresh state
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

  return { state, playQueue, playNext, addToQueue, togglePlay, seek, next, prev, toggleShuffle, cycleRepeat, reorderQueue, removeFromQueue, jumpTo }
}
