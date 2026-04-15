import { parseBlob } from 'music-metadata'
import { db, type Track } from '../db'

export async function importFiles(files: FileList): Promise<number> {
  let imported = 0

  for (const file of Array.from(files)) {
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
        coverBlob = new Blob([pic.data.buffer as ArrayBuffer], { type: pic.format })
      }

      const track: Track = {
        title,
        artist,
        album,
        duration,
        fileBlob: file,
        coverBlob,
        addedAt: Date.now(),
      }

      await db.tracks.add(track)
      imported++
    } catch (err) {
      console.error(`Failed to import ${file.name}:`, err)
    }
  }

  return imported
}
