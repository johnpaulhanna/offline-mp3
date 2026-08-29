import { parseBlob } from 'music-metadata'
import { db, type Track } from '../db'

export async function importFiles(
  files: FileList,
  playlistId?: number,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  let imported = 0
  const importedIds: number[] = []
  const fileArray = Array.from(files)
  const total = fileArray.length

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i]
    try {
      const metadata = await parseBlob(file)
      const { common, format } = metadata

      const title = common.title || file.name.replace(/\.mp3$/i, '')
      const artist = common.artist || 'Unknown Artist'
      const album = common.album || 'Unknown Album'
      const duration = format.duration ?? 0

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
      imported++
    } catch (err) {
      console.error(`Failed to import ${file.name}:`, err)
    }
    onProgress?.(i + 1, total)
  }

  if (playlistId !== undefined && importedIds.length > 0) {
    const base = await db.playlistTracks.where('playlistId').equals(playlistId).count()
    await db.playlistTracks.bulkAdd(
      importedIds.map((trackId, i) => ({ playlistId, trackId, position: base + i }))
    )
  }

  return imported
}
