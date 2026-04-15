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
  await db.tracks.delete(id)
}
