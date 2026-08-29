import { parseBlob } from 'music-metadata'
import { db, type Track } from '../db'

// Everything music-metadata can read and Safari can play, not just MP3.
//
// Spelled out rather than 'audio/*' on purpose: iOS reads a wildcard as "any
// media" and puts Photo Library and Take Photo in the picker. Naming each type
// keeps the sheet on Files, where the music actually is.
export const AUDIO_ACCEPT = [
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
  'audio/flac', 'audio/x-flac', 'audio/wav', 'audio/x-wav',
  'audio/aiff', 'audio/x-aiff', 'audio/ogg',
  '.mp3', '.m4a', '.aac', '.flac', '.wav', '.aiff', '.ogg',
].join(',')

export interface ImportResult {
  imported: number
  skipped: number
  failed: number
}

// Same title and same byte length means the same file, for any purpose the user
// cares about. Goes through the title index, so this reads a handful of rows
// rather than scanning the library.
export async function findDuplicateTrackId(title: string, size: number): Promise<number | undefined> {
  const matches = await db.tracks.where('title').equals(title).toArray()
  for (const t of matches) {
    if (t.id == null) continue
    // Audio moved to its own table in db v4; older rows still carry it inline.
    const blob = (await db.trackFiles.get(t.id))?.fileBlob ?? t.fileBlob
    if (blob?.size === size) return t.id
  }
  return undefined
}

export async function importFiles(
  files: FileList,
  playlistId?: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0 }
  const importedIds: number[] = []
  const fileArray = Array.from(files)
  const total = fileArray.length

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i]
    try {
      const metadata = await parseBlob(file)
      const { common, format } = metadata

      const title = common.title || file.name.replace(/\.[a-z0-9]+$/i, '')
      const artist = common.artist || 'Unknown Artist'
      const album = common.album || 'Unknown Album'
      const duration = format.duration ?? 0

      // Re-picking the same file from Files is easy to do by accident.
      const duplicate = await findDuplicateTrackId(title, file.size)
      if (duplicate != null) {
        result.skipped++
        importedIds.push(duplicate)
        onProgress?.(i + 1, total)
        continue
      }

      let coverBlob: Blob | null = null
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0]
        // Use pic.data (Uint8Array view) directly — pic.data.buffer is the full backing
        // ArrayBuffer which may extend far beyond the image if it's a subarray view
        const slice = pic.data.buffer.slice(pic.data.byteOffset, pic.data.byteOffset + pic.data.byteLength) as ArrayBuffer
        coverBlob = new Blob([slice], { type: pic.format })
      }

      const track: Track = {
        title,
        artist,
        album,
        duration,
        addedAt: Date.now(),
      }

      const id = await db.tracks.add(track)
      await db.trackFiles.put({ id: id as number, fileBlob: file })
      if (coverBlob) {
        await db.trackCovers.put({ id: id as number, coverBlob })
      }
      importedIds.push(id as number)
      result.imported++
    } catch (err) {
      console.error(`Failed to import ${file.name}:`, err)
      result.failed++
    }
    onProgress?.(i + 1, total)
  }

  if (playlistId !== undefined && importedIds.length > 0) {
    // Skipped duplicates may already be in this playlist; appending by count()
    // would also collide with any gap left by an earlier removal.
    const already = new Set(
      (await db.playlistTracks.where('playlistId').equals(playlistId).toArray()).map(pt => pt.trackId)
    )
    let position = already.size
    const additions = importedIds
      .filter(id => !already.has(id))
      .map(trackId => ({ playlistId, trackId, position: position++ }))
    if (additions.length) await db.playlistTracks.bulkAdd(additions)
  }

  return result
}
