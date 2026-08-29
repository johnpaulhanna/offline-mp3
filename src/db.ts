import Dexie, { type Table } from 'dexie'

export interface Track {
  id?: number
  title: string
  artist: string
  album: string
  duration: number
  fileBlob?: Blob  // legacy: present on tracks imported before v4
  coverBlob?: Blob | null  // legacy: present on tracks imported before v5
  addedAt: number
  liked?: boolean
}

export interface TrackFile {
  id: number  // same as track id
  fileBlob: Blob
}

export interface TrackCover {
  id: number  // same as track id
  coverBlob: Blob
}

export interface Playlist {
  id?: number
  name: string
  coverBlob?: Blob | null
  createdAt: number
}

export interface PlaylistTrack {
  id?: number
  playlistId: number
  trackId: number
  position: number
}

class MusicDB extends Dexie {
  tracks!: Table<Track>
  trackFiles!: Table<TrackFile>
  trackCovers!: Table<TrackCover>
  playlists!: Table<Playlist>
  playlistTracks!: Table<PlaylistTrack>

  constructor() {
    super('MusicDB')
    this.version(1).stores({
      tracks: '++id, title, artist, album, addedAt',
    })
    this.version(2).stores({
      playlists: '++id, name, createdAt',
      playlistTracks: '++id, playlistId, trackId',
    })
    this.version(3).stores({
      tracks: '++id, title, artist, album, addedAt, liked',
    })
    this.version(4).stores({
      trackFiles: 'id',
    }).upgrade(async tx => {
      const ids = await tx.table('tracks').toCollection().primaryKeys() as number[]
      for (const id of ids) {
        const track = await tx.table<Track>('tracks').get(id)
        if (track?.fileBlob && track.id != null) {
          await tx.table('trackFiles').put({ id: track.id, fileBlob: track.fileBlob })
          await tx.table('tracks').update(track.id, { fileBlob: undefined })
        }
      }
    })
    this.version(5).stores({
      trackCovers: 'id',
    })
  }
}

export const db = new MusicDB()
