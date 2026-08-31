import { parseBlob } from 'music-metadata'
import { db } from '../db'

export async function fixCoversIfNeeded() {
  if (localStorage.getItem('cover-fix-v3')) return
  localStorage.setItem('cover-fix-v3', '1')

  const trackIds = (await db.tracks.toCollection().primaryKeys()) as number[]
  const coveredIds = (await db.trackCovers.toCollection().primaryKeys()) as number[]
  const covered = new Set(coveredIds)

  for (const id of trackIds) {
    if (covered.has(id)) continue
    try {
      // Prefer re-extracting from the audio file (avoids any corruption from v4 migration)
      const trackFile = await db.trackFiles.get(id)
      if (trackFile?.fileBlob) {
        const meta = await parseBlob(trackFile.fileBlob)
        const pic = meta.common.picture?.[0]
        if (pic) {
          const slice = pic.data.buffer.slice(
            pic.data.byteOffset,
            pic.data.byteOffset + pic.data.byteLength
          ) as ArrayBuffer
          await db.trackCovers.put({ id, coverBlob: new Blob([slice], { type: pic.format }) })
          continue
        }
      }
      // Fallback: use the legacy inline coverBlob if it exists
      const track = await db.tracks.get(id)
      if (track?.coverBlob) {
        await db.trackCovers.put({ id, coverBlob: track.coverBlob })
      }
    } catch {
      // one unreadable track must not stop the rest of the pass
    }
  }
}
