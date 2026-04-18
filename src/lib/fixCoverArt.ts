import { parseBlob } from 'music-metadata'
import { db } from '../db'

export async function fixCoverArtIfNeeded() {
  if (localStorage.getItem('cover-fix-v2')) return
  const tracks = await db.tracks.toArray()
  for (const track of tracks) {
    if (!track.id || !track.fileBlob) continue
    try {
      const meta = await parseBlob(track.fileBlob)
      const pic = meta.common.picture?.[0]
      if (!pic) continue
      const slice = pic.data.buffer.slice(
        pic.data.byteOffset,
        pic.data.byteOffset + pic.data.byteLength
      ) as ArrayBuffer
      await db.tracks.update(track.id, { coverBlob: new Blob([slice], { type: pic.format }) })
    } catch {}
  }
  localStorage.setItem('cover-fix-v2', '1')
}
