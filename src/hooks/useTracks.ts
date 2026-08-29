import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Track } from '../db'

export type SortKey = 'title' | 'artist' | 'album' | 'addedAt' | 'addedAt_asc'

export function useTracks(sort: SortKey = 'title') {
  return useLiveQuery(async () => {
    let tracks: Track[]
    if (sort === 'addedAt') {
      tracks = await db.tracks.orderBy('addedAt').reverse().toArray()
    } else if (sort === 'addedAt_asc') {
      tracks = await db.tracks.orderBy('addedAt').toArray()
    } else {
      tracks = await db.tracks.toArray()
    }
    const covers = await db.trackCovers.bulkGet(tracks.map(t => t.id!))
    const withCovers = tracks.map((t, i) => ({
      ...t,
      coverBlob: covers[i]?.coverBlob ?? t.coverBlob ?? null,
    }))
    if (sort === 'addedAt' || sort === 'addedAt_asc') return withCovers
    return withCovers.sort((a, b) => {
      const av = (a[sort] ?? '').toLowerCase()
      const bv = (b[sort] ?? '').toLowerCase()
      return av.localeCompare(bv)
    })
  }, [sort], []) as Track[]
}

export async function deleteTrack(id: number) {
  await db.transaction('rw', db.tracks, db.trackFiles, db.trackCovers, db.playlistTracks, async () => {
    await db.tracks.delete(id)
    await db.trackFiles.delete(id)
    await db.trackCovers.delete(id)
    await db.playlistTracks.where('trackId').equals(id).delete()
  })
}

export async function deleteTracks(ids: number[]) {
  await db.transaction('rw', db.tracks, db.trackFiles, db.trackCovers, db.playlistTracks, async () => {
    await db.tracks.bulkDelete(ids)
    await db.trackFiles.bulkDelete(ids)
    await db.trackCovers.bulkDelete(ids)
    await db.playlistTracks.where('trackId').anyOf(ids).delete()
  })
}

export async function updateTrack(id: number, updates: Partial<Pick<Track, 'title' | 'artist' | 'album'>>) {
  await db.tracks.update(id, updates)
}

export async function toggleLike(id: number) {
  const track = await db.tracks.get(id)
  if (!track) return
  // Store true when liking, remove the field when unliking (undefined = not liked)
  await db.tracks.update(id, { liked: track.liked ? undefined : true })
}
