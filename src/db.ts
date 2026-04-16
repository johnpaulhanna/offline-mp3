import Dexie, { type Table } from 'dexie'

export interface Track {
  id?: number
  title: string
  artist: string
  album: string
  duration: number
  fileBlob: Blob
  coverBlob: Blob | null
  addedAt: number
  liked?: boolean
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
  }
}

export const db = new MusicDB()
