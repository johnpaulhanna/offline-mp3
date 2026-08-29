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
    const covers = await db.trackCovers.bulkGet(pts.map(pt => pt.trackId))
    const pairs = pts
      .map((pt, i) => ({ pt, track: tracks[i], cover: covers[i] }))
      .filter((p): p is { pt: typeof pts[0]; track: Track; cover: typeof covers[0] } => p.track !== undefined)
    return {
      pts: pairs.map(p => p.pt),
      tracks: pairs.map(p => ({
        ...p.track,
        coverBlob: p.cover?.coverBlob ?? p.track.coverBlob ?? null,
      })),
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

// Positions must stay a dense 0..n-1 run: they are the sort key, and a gap left
// by a removal used to collide with the next appended track, leaving the order
// of those two arbitrary.
export async function renumberPlaylist(playlistId: number) {
  const rows = await db.playlistTracks.where('playlistId').equals(playlistId).sortBy('position')
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].position !== i && rows[i].id != null) {
      await db.playlistTracks.update(rows[i].id!, { position: i })
    }
  }
}

export async function addTrackToPlaylist(playlistId: number, trackId: number) {
  // One transaction so a double-tap cannot slip two rows past the existence check.
  await db.transaction('rw', db.playlistTracks, async () => {
    const rows = await db.playlistTracks.where('playlistId').equals(playlistId).sortBy('position')
    if (rows.some(pt => pt.trackId === trackId)) return
    const position = rows.length ? rows[rows.length - 1].position + 1 : 0
    await db.playlistTracks.add({ playlistId, trackId, position })
  })
}

export async function removeFromPlaylist(playlistTrackId: number) {
  await db.transaction('rw', db.playlistTracks, async () => {
    const row = await db.playlistTracks.get(playlistTrackId)
    if (!row) return
    await db.playlistTracks.delete(playlistTrackId)
    await renumberPlaylist(row.playlistId)
  })
}

export async function renamePlaylist(id: number, name: string) {
  await db.playlists.update(id, { name: name.trim() })
}

export async function updatePlaylistCover(id: number, blob: Blob | null) {
  await db.playlists.update(id, { coverBlob: blob })
}
