import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Playlist, type Track } from '../db'

export function usePlaylists() {
  return useLiveQuery(() => db.playlists.orderBy('createdAt').toArray(), [], []) as Playlist[]
}

export function usePlaylistTracks(playlistId: number) {
  return useLiveQuery(async () => {
    const pts = await db.playlistTracks
      .where('playlistId').equals(playlistId)
      .sortBy('position')
    const tracks = await db.tracks.bulkGet(pts.map(pt => pt.trackId))
    return {
      pts,
      tracks: tracks.filter((t): t is Track => t !== undefined),
    }
  }, [playlistId])
}

export async function createPlaylist(name: string): Promise<number> {
  return db.playlists.add({ name: name.trim(), createdAt: Date.now() })
}

export async function deletePlaylist(id: number) {
  await db.transaction('rw', db.playlists, db.playlistTracks, async () => {
    await db.playlists.delete(id)
    await db.playlistTracks.where('playlistId').equals(id).delete()
  })
}

export async function addTrackToPlaylist(playlistId: number, trackId: number) {
  const existing = await db.playlistTracks
    .where('playlistId').equals(playlistId)
    .and(pt => pt.trackId === trackId)
    .first()
  if (existing) return
  const count = await db.playlistTracks.where('playlistId').equals(playlistId).count()
  await db.playlistTracks.add({ playlistId, trackId, position: count })
}

export async function removeFromPlaylist(playlistTrackId: number) {
  await db.playlistTracks.delete(playlistTrackId)
}

export async function updatePlaylistCover(id: number, blob: Blob | null) {
  await db.playlists.update(id, { coverBlob: blob })
}

export async function getTrackPlaylistIds(trackId: number): Promise<number[]> {
  const pts = await db.playlistTracks.where('trackId').equals(trackId).toArray()
  return pts.map(pt => pt.playlistId)
}
