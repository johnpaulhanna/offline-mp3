import { parseBlob } from 'music-metadata'
import { db } from '../db'

export async function fixCoverArtIfNeeded() {
  if (localStorage.getItem('cover-fix-v2')) return
  // Write flag immediately — prevents crash-loop if we OOM mid-migration
  localStorage.setItem('cover-fix-v2', '1')

  // Fetch only IDs to avoid pulling all blobs into memory at once
  const ids = (await db.tracks.toCollection().primaryKeys()) as number[]

  for (const id of ids) {
    try {
      const track = await db.tracks.get(id)
      if (!track?.fileBlob) continue
      const meta = await parseBlob(track.fileBlob)
      const pic = meta.common.picture?.[0]
      if (!pic) continue
      const slice = pic.data.buffer.slice(
        pic.data.byteOffset,
        pic.data.byteOffset + pic.data.byteLength
      ) as ArrayBuffer
      await db.tracks.update(id, { coverBlob: new Blob([slice], { type: pic.format }) })
    } catch {}
  }
}
