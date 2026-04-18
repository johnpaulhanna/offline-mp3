export type EQBand = 'bass' | 'mid' | 'treble'
export type EQGains = Record<EQBand, number>

export const EQ_PRESETS: Record<string, EQGains> = {
  Flat:        { bass:  0, mid:  0, treble:  0 },
  'Bass Boost':{ bass:  6, mid:  0, treble: -1 },
  Vocal:       { bass: -2, mid:  4, treble:  2 },
  Treble:      { bass: -1, mid:  0, treble:  6 },
  Rock:        { bass:  4, mid: -1, treble:  3 },
  Classical:   { bass:  2, mid: -2, treble:  3 },
}

const STORAGE_KEY = 'eq-gains'

function load(): EQGains {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return { bass: 0, mid: 0, treble: 0 }
}

function save(g: EQGains) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(g)) } catch {}
}

let audioEl: HTMLAudioElement | null = null
let ctx: AudioContext | null = null
let connected = false
let bassNode: BiquadFilterNode | null = null
let midNode: BiquadFilterNode | null = null
let trebleNode: BiquadFilterNode | null = null

// Store audio element reference without touching AudioContext — safe for background audio
export function setAudioElement(audio: HTMLAudioElement) {
  audioEl = audio
  connected = false
  ctx = null
  bassNode = null
  midNode = null
  trebleNode = null
}

// Called only when user opens EQ modal — creates AudioContext lazily
export function ensureEQConnected() {
  if (connected || !audioEl) return
  try {
    ctx = new AudioContext()

    bassNode = ctx.createBiquadFilter()
    bassNode.type = 'lowshelf'
    bassNode.frequency.value = 200

    midNode = ctx.createBiquadFilter()
    midNode.type = 'peaking'
    midNode.frequency.value = 1000
    midNode.Q.value = 1.0

    trebleNode = ctx.createBiquadFilter()
    trebleNode.type = 'highshelf'
    trebleNode.frequency.value = 8000

    const gains = load()
    bassNode.gain.value = gains.bass
    midNode.gain.value = gains.mid
    trebleNode.gain.value = gains.treble

    const src = ctx.createMediaElementSource(audioEl)
    src.connect(bassNode)
    bassNode.connect(midNode)
    midNode.connect(trebleNode)
    trebleNode.connect(ctx.destination)

    connected = true
  } catch (err) {
    console.error('EQ connect failed:', err)
    ctx = null; bassNode = null; midNode = null; trebleNode = null
  }
}

// Call before audio.play() — iOS suspends AudioContext until user gesture
export function resumeEQ() {
  ctx?.resume().catch(() => {})
}

export function setEQGain(band: EQBand, db: number) {
  const v = Math.max(-12, Math.min(12, db))
  if (band === 'bass' && bassNode) bassNode.gain.value = v
  if (band === 'mid' && midNode) midNode.gain.value = v
  if (band === 'treble' && trebleNode) trebleNode.gain.value = v
  const g = load()
  g[band] = v
  save(g)
}

export function applyPreset(preset: EQGains) {
  setEQGain('bass', preset.bass)
  setEQGain('mid', preset.mid)
  setEQGain('treble', preset.treble)
}

export function getEQGains(): EQGains {
  return load()
}
