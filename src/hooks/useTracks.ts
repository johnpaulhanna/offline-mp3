import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Track } from '../db'

export type SortKey = 'title' | 'artist' | 'album' | 'addedAt'

export function useTracks(sort: SortKey = 'title') {
  return useLiveQuery(
    () => db.tracks.orderBy(sort).toArray(),
    [sort],
    []
  ) as Track[]
}

export async function deleteTrack(id: number) {
  await db.transaction('rw', db.tracks, db.playlistTracks, async () => {
    await db.tracks.delete(id)
    await db.playlistTracks.where('trackId').equals(id).delete()
  })
}

export async function toggleLike(id: number) {
  const track = await db.tracks.get(id)
  if (!track) return
  // Store true when liking, remove the field when unliking (undefined = not liked)
  await db.tracks.update(id, { liked: track.liked ? undefined : true })
}
