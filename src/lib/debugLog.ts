// Temporary instrumentation for the lock-screen resume bug.
//
// The failure only happens on a real phone, with the app backgrounded and the
// page frozen — which is exactly when a debugger is not attached and console
// output goes nowhere. So events are written synchronously to localStorage as
// they happen, and survive the page being frozen or torn down. Read them back
// from the Diagnostics sheet at the bottom of the Songs tab.

const KEY = 'debug-log'
const MAX = 400

export interface LogEntry {
  t: number
  tag: string
  detail?: string
}

// Off unless someone turns it on from the Diagnostics sheet. Recording writes
// to localStorage synchronously on every media event, which is not something to
// leave running for people who are just listening to music.
let enabled = false
try {
  enabled = localStorage.getItem('debug-log-on') === '1'
} catch {
  // storage blocked
}

export function isLogging(): boolean {
  return enabled
}

export function setLogging(on: boolean) {
  enabled = on
  try {
    localStorage.setItem('debug-log-on', on ? '1' : '0')
  } catch {
    // storage blocked
  }
}

export function logEvent(tag: string, detail?: string) {
  if (!enabled) return
  try {
    const raw = localStorage.getItem(KEY)
    const list: LogEntry[] = raw ? JSON.parse(raw) : []
    list.push({ t: Date.now(), tag, ...(detail ? { detail } : {}) })
    if (list.length > MAX) list.splice(0, list.length - MAX)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage full or blocked — diagnostics are best effort
  }
}

export function readLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as LogEntry[]) : []
  } catch {
    return []
  }
}

export function clearLog() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // storage blocked
  }
}

// Snapshot of everything worth knowing about the element at a given moment.
export function describeAudio(audio: HTMLAudioElement | null): string {
  if (!audio) return 'no element'
  return [
    `paused=${audio.paused}`,
    `ready=${audio.readyState}`,
    `net=${audio.networkState}`,
    `t=${audio.currentTime.toFixed(1)}`,
    `dur=${isFinite(audio.duration) ? audio.duration.toFixed(1) : '?'}`,
    `rate=${audio.playbackRate}`,
    `err=${audio.error ? audio.error.code : 'none'}`,
    `inDOM=${audio.isConnected}`,
  ].join(' ')
}

export function formatLog(entries: LogEntry[]): string {
  if (!entries.length) return '(empty)'
  const start = entries[0].t
  return entries
    .map(e => {
      const secs = ((e.t - start) / 1000).toFixed(1).padStart(7)
      return `${secs}s  ${e.tag}${e.detail ? '  ' + e.detail : ''}`
    })
    .join('\n')
}
