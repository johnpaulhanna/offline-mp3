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
}

class MusicDB extends Dexie {
  tracks!: Table<Track>

  constructor() {
    super('MusicDB')
    this.version(1).stores({
      tracks: '++id, title, artist, album, addedAt',
    })
  }
}

export const db = new MusicDB()
