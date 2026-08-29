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
const FLAT: EQGains = { bass: 0, mid: 0, treble: 0 }

function load(): EQGains {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return { ...FLAT }
    const parsed = JSON.parse(s) as Partial<EQGains>
    return {
      bass: clamp(parsed.bass),
      mid: clamp(parsed.mid),
      treble: clamp(parsed.treble),
    }
  } catch {
    return { ...FLAT } // unreadable or malformed — fall back to flat
  }
}

function save(g: EQGains) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(g))
  } catch {
    // storage blocked (private browsing) — the setting just won't survive a restart
  }
}

function clamp(db: number | undefined): number {
  if (typeof db !== 'number' || !isFinite(db)) return 0
  return Math.max(-12, Math.min(12, Math.round(db)))
}

export function isFlat(g: EQGains): boolean {
  return g.bass === 0 && g.mid === 0 && g.treble === 0
}

let audioEl: HTMLAudioElement | null = null
let ctx: AudioContext | null = null
let connected = false
// createMediaElementSource can only ever be called once for a given element.
// Once released we can never rebuild the graph, so don't keep trying.
let sourceCreated = false
let bassNode: BiquadFilterNode | null = null
let midNode: BiquadFilterNode | null = null
let trebleNode: BiquadFilterNode | null = null

// Store audio element reference without touching AudioContext — safe for background audio
export function setAudioElement(audio: HTMLAudioElement) {
  audioEl = audio
  connected = false
  sourceCreated = false
  ctx = null
  bassNode = null
  midNode = null
  trebleNode = null
}

// True once playback is routed through Web Audio. This is a one-way door for the
// life of the page: createMediaElementSource cannot be undone, and on iOS that
// routing is what puts background/lock-screen playback at risk. So we only walk
// through it when the user actually asks for a non-flat EQ — merely opening the
// equalizer to look at it costs nothing.
export function isEQActive(): boolean {
  return connected
}

function connect() {
  if (connected || sourceCreated || !audioEl) return
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

    const src = ctx.createMediaElementSource(audioEl)
    src.connect(bassNode)
    bassNode.connect(midNode)
    midNode.connect(trebleNode)
    trebleNode.connect(ctx.destination)

    sourceCreated = true
    connected = true
    apply(load())
  } catch (err) {
    console.error('EQ connect failed:', err)
    ctx = null; bassNode = null; midNode = null; trebleNode = null
  }
}

function apply(g: EQGains) {
  if (bassNode) bassNode.gain.value = g.bass
  if (midNode) midNode.gain.value = g.mid
  if (trebleNode) trebleNode.gain.value = g.treble
}

// Synchronously release the AudioContext so the audio element reverts to the
// default output path. Called when the page hides and before audio.play() in
// background contexts, where awaiting ctx.resume() would lose iOS's user gesture.
// This is a one-way door for the session: the element cannot be re-sourced, so
// the EQ stays inert until the app is reopened. Protecting lock-screen playback
// is worth more than keeping the filters alive.
export function releaseEQ() {
  if (!ctx) return
  try {
    ctx.close()
  } catch {
    // already closed
  }
  ctx = null
  connected = false
  bassNode = null
  midNode = null
  trebleNode = null
}

// True once the EQ has been released and cannot be rebuilt this session.
export function isEQSpent(): boolean {
  return sourceCreated && !connected
}

// Call before audio.play() — iOS suspends AudioContext until a user gesture.
// Also the point where a saved non-flat EQ from a previous session gets wired up;
// previously those settings silently did nothing until the panel was reopened.
export function resumeEQ() {
  if (!connected && !isFlat(load())) connect()
  ctx?.resume().catch(() => {
    // context can refuse to resume outside a gesture; playback still works
  })
}

export function setEQGain(band: EQBand, db: number) {
  const g = load()
  g[band] = clamp(db)
  save(g)
  if (!connected && !isFlat(g)) connect()
  apply(g)
}

export function applyPreset(preset: EQGains) {
  const g: EQGains = { bass: clamp(preset.bass), mid: clamp(preset.mid), treble: clamp(preset.treble) }
  save(g)
  if (!connected && !isFlat(g)) connect()
  apply(g)
}

export function getEQGains(): EQGains {
  return load()
}
