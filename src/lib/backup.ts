import { db, type Track } from '../db'
import { findDuplicateTrackId } from './importTracks'
import { zipStore, unzipStore, type ZipEntry } from './zip'

// A backup is an ordinary .zip: the audio files as they were imported, their
// cover art, and a library.json describing titles, likes and playlists. It opens
// in any unzip tool, so the music is recoverable even without this app.

const FORMAT = 'offline-mp3-backup'
const MANIFEST = 'library.json'

interface BackupTrack {
  file: string
  cover: string | null
  title: string
  artist: string
  album: string
  duration: number
  addedAt: number
  liked?: boolean
}

interface BackupPlaylist {
  name: string
  createdAt: number
  cover: string | null
  tracks: string[]
}

interface BackupManifest {
  format: typeof FORMAT
  version: 1
  exportedAt: number
  tracks: BackupTrack[]
  playlists: BackupPlaylist[]
}

export interface Progress {
  phase: 'reading' | 'packing' | 'restoring'
  done: number
  total: number
}

const AUDIO_EXT: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a', 'audio/flac': 'flac', 'audio/x-flac': 'flac', 'audio/wav': 'wav',
  'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/aiff': 'aiff', 'audio/x-aiff': 'aiff',
}

const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
}

function extFor(map: Record<string, string>, type: string, fallback: string): string {
  return map[type.toLowerCase()] ?? fallback
}

// Zip entry names have to survive every filesystem the user might extract onto.
function safeName(s: string): string {
  const cleaned = Array.from(s)
    .map(ch => (ch.charCodeAt(0) < 0x20 || '/\\:*?"<>|'.includes(ch) ? '_' : ch))
    .join('')
    .trim()
  return (cleaned || 'untitled').slice(0, 80)
}

export async function exportLibrary(onProgress?: (p: Progress) => void): Promise<Blob> {
  // Fetch IDs first and load one track at a time — the same shape as the cover
  // art migration, so a large library never sits in memory all at once.
  const ids = (await db.tracks.toCollection().primaryKeys()) as number[]
  const entries: ZipEntry[] = []
  const tracks: BackupTrack[] = []
  const fileById = new Map<number, string>()

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const track = await db.tracks.get(id)
    if (!track) continue

    // Audio and cover art moved into their own tables in db v4/v5. Rows imported
    // before that still carry the blobs inline, so fall back to them.
    const fileBlob = (await db.trackFiles.get(id))?.fileBlob ?? track.fileBlob
    if (!fileBlob) continue
    const coverBlob = (await db.trackCovers.get(id))?.coverBlob ?? track.coverBlob ?? null

    const stem = `${String(id).padStart(4, '0')}-${safeName(track.title)}`
    const file = `audio/${stem}.${extFor(AUDIO_EXT, fileBlob.type, 'mp3')}`
    entries.push({ name: file, blob: fileBlob })
    fileById.set(id, file)

    let cover: string | null = null
    if (coverBlob) {
      cover = `covers/${stem}.${extFor(IMAGE_EXT, coverBlob.type, 'jpg')}`
      entries.push({ name: cover, blob: coverBlob })
    }

    tracks.push({
      file,
      cover,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      addedAt: track.addedAt,
      ...(track.liked ? { liked: true } : {}),
    })
    onProgress?.({ phase: 'reading', done: i + 1, total: ids.length })
  }

  const playlists: BackupPlaylist[] = []
  for (const pl of await db.playlists.orderBy('createdAt').toArray()) {
    if (pl.id == null) continue
    const pts = await db.playlistTracks.where('playlistId').equals(pl.id).sortBy('position')
    let cover: string | null = null
    if (pl.coverBlob) {
      cover = `playlists/${String(pl.id).padStart(4, '0')}-${safeName(pl.name)}.${extFor(IMAGE_EXT, pl.coverBlob.type, 'jpg')}`
      entries.push({ name: cover, blob: pl.coverBlob })
    }
    playlists.push({
      name: pl.name,
      createdAt: pl.createdAt,
      cover,
      tracks: pts.map(pt => fileById.get(pt.trackId)).filter((f): f is string => !!f),
    })
  }

  const manifest: BackupManifest = {
    format: FORMAT,
    version: 1,
    exportedAt: Date.now(),
    tracks,
    playlists,
  }
  entries.unshift({ name: MANIFEST, blob: new Blob([JSON.stringify(manifest, null, 2)]) })

  return zipStore(entries, (done, total) => onProgress?.({ phase: 'packing', done, total }))
}

export interface RestoreResult {
  tracksAdded: number
  tracksSkipped: number
  playlistsTouched: number
}

export async function restoreLibrary(
  archive: Blob,
  onProgress?: (p: Progress) => void
): Promise<RestoreResult> {
  const entries = await unzipStore(archive)
  const byName = new Map(entries.map(e => [e.name, e.blob]))

  const manifestBlob = byName.get(MANIFEST)
  if (!manifestBlob) throw new Error("That zip file doesn't contain a library backup.")

  let manifest: BackupManifest
  try {
    manifest = JSON.parse(await manifestBlob.text())
  } catch {
    throw new Error('The backup index is unreadable.')
  }
  if (manifest.format !== FORMAT || !Array.isArray(manifest.tracks)) {
    throw new Error("That zip file doesn't contain a library backup.")
  }

  // Restore is additive: existing music is never touched, and anything already
  // present is skipped rather than duplicated.
  const idByFile = new Map<string, number>()
  let tracksAdded = 0
  let tracksSkipped = 0

  for (let i = 0; i < manifest.tracks.length; i++) {
    const t = manifest.tracks[i]
    onProgress?.({ phase: 'restoring', done: i + 1, total: manifest.tracks.length })

    const fileBlob = t.file ? byName.get(t.file) : undefined
    if (!fileBlob) continue

    const existing = await findDuplicateTrackId(t.title, fileBlob.size)
    if (existing != null) {
      idByFile.set(t.file, existing)
      tracksSkipped++
      continue
    }

    const track: Track = {
      title: t.title || 'Untitled',
      artist: t.artist || 'Unknown Artist',
      album: t.album || 'Unknown Album',
      duration: Number(t.duration) || 0,
      addedAt: Number(t.addedAt) || Date.now(),
      ...(t.liked ? { liked: true as const } : {}),
    }
    const id = (await db.tracks.add(track)) as number
    await db.trackFiles.put({ id, fileBlob })
    const coverBlob = (t.cover && byName.get(t.cover)) || null
    if (coverBlob) await db.trackCovers.put({ id, coverBlob })
    idByFile.set(t.file, id)
    tracksAdded++
  }

  let playlistsTouched = 0
  for (const pl of manifest.playlists ?? []) {
    const name = (pl.name || '').trim()
    if (!name) continue
    const trackIds = (pl.tracks ?? [])
      .map(f => idByFile.get(f))
      .filter((id): id is number => id != null)

    const existing = await db.playlists.where('name').equals(name).first()
    const playlistId =
      existing?.id ??
      ((await db.playlists.add({
        name,
        createdAt: Number(pl.createdAt) || Date.now(),
        coverBlob: (pl.cover && byName.get(pl.cover)) || null,
      })) as number)

    const already = new Set(
      (await db.playlistTracks.where('playlistId').equals(playlistId).toArray()).map(pt => pt.trackId)
    )
    let position = already.size
    const additions = trackIds
      .filter(id => !already.has(id))
      .map(trackId => ({ playlistId, trackId, position: position++ }))
    if (additions.length) await db.playlistTracks.bulkAdd(additions)
    playlistsTouched++
  }

  return { tracksAdded, tracksSkipped, playlistsTouched }
}

export function backupFilename(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `music-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`
}

// Hand the file to the user. The share sheet is the only route that reliably
// lands in Files on an iOS home-screen app, but it needs a user gesture that a
// long export may have outlived — so fall back to a plain download.
export async function offerFile(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'application/zip' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (err) {
      // AbortError means the user dismissed the sheet — don't then force a download.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'downloaded'
}
