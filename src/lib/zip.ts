// Minimal ZIP reader/writer, stored (uncompressed) entries only.
//
// Deliberately dependency-free: this app's whole point is working offline, and
// a backup format the user can open with any unzip tool is worth more than a
// smaller file. MP3s are already compressed, so deflate would buy ~nothing.

export interface ZipEntry {
  name: string
  blob: Blob
}

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50
const UTF8_FLAG = 0x0800
const STORED = 0
const LOCAL_HEADER_LEN = 30
const CENTRAL_HEADER_LEN = 46
const EOCD_LEN = 22
const ZIP32_MAX = 0xffffffff
const CHUNK = 1 << 20

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32Update(crc: number, bytes: Uint8Array): number {
  let c = crc
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return c
}

// Hashed a megabyte at a time so a large track is never fully resident.
async function crc32OfBlob(blob: Blob): Promise<number> {
  let crc = ~0
  for (let start = 0; start < blob.size; start += CHUNK) {
    const slice = blob.slice(start, Math.min(start + CHUNK, blob.size))
    crc = crc32Update(crc, new Uint8Array(await slice.arrayBuffer()))
  }
  return (~crc) >>> 0
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear())
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

interface HeaderFields {
  name: Uint8Array
  crc: number
  size: number
  time: number
  date: number
}

function localHeader(f: HeaderFields): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(LOCAL_HEADER_LEN + f.name.length)
  const v = new DataView(buf)
  v.setUint32(0, LOCAL_SIG, true)
  v.setUint16(4, 20, true)            // version needed to extract
  v.setUint16(6, UTF8_FLAG, true)
  v.setUint16(8, STORED, true)
  v.setUint16(10, f.time, true)
  v.setUint16(12, f.date, true)
  v.setUint32(14, f.crc, true)
  v.setUint32(18, f.size, true)       // compressed size
  v.setUint32(22, f.size, true)       // uncompressed size
  v.setUint16(26, f.name.length, true)
  v.setUint16(28, 0, true)            // extra field length
  new Uint8Array(buf, LOCAL_HEADER_LEN).set(f.name)
  return new Uint8Array(buf)
}

function centralHeader(f: HeaderFields, offset: number): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(CENTRAL_HEADER_LEN + f.name.length)
  const v = new DataView(buf)
  v.setUint32(0, CENTRAL_SIG, true)
  v.setUint16(4, 20, true)            // version made by
  v.setUint16(6, 20, true)            // version needed
  v.setUint16(8, UTF8_FLAG, true)
  v.setUint16(10, STORED, true)
  v.setUint16(12, f.time, true)
  v.setUint16(14, f.date, true)
  v.setUint32(16, f.crc, true)
  v.setUint32(20, f.size, true)
  v.setUint32(24, f.size, true)
  v.setUint16(28, f.name.length, true)
  v.setUint16(30, 0, true)            // extra
  v.setUint16(32, 0, true)            // comment
  v.setUint16(34, 0, true)            // disk number start
  v.setUint16(36, 0, true)            // internal attributes
  v.setUint32(38, 0, true)            // external attributes
  v.setUint32(42, offset, true)
  new Uint8Array(buf, CENTRAL_HEADER_LEN).set(f.name)
  return new Uint8Array(buf)
}

function endOfCentralDirectory(count: number, size: number, offset: number): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(EOCD_LEN)
  const v = new DataView(buf)
  v.setUint32(0, EOCD_SIG, true)
  v.setUint16(4, 0, true)             // this disk
  v.setUint16(6, 0, true)             // disk with central directory
  v.setUint16(8, count, true)
  v.setUint16(10, count, true)
  v.setUint32(12, size, true)
  v.setUint32(16, offset, true)
  v.setUint16(20, 0, true)            // comment length
  return new Uint8Array(buf)
}

export async function zipStore(
  entries: ZipEntry[],
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  const encoder = new TextEncoder()
  const parts: BlobPart[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  const now = dosDateTime(new Date())
  let offset = 0

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const name = encoder.encode(entry.name)
    const fields: HeaderFields = {
      name,
      crc: await crc32OfBlob(entry.blob),
      size: entry.blob.size,
      time: now.time,
      date: now.date,
    }
    const header = localHeader(fields)
    // Push the Blob itself, not its bytes — the browser keeps a reference
    // rather than a copy, so the whole library never sits in memory at once.
    parts.push(header, entry.blob)
    central.push(centralHeader(fields, offset))
    offset += header.length + entry.blob.size
    if (offset > ZIP32_MAX) {
      throw new Error('Library is too large for a single backup file (over 4 GB).')
    }
    onProgress?.(i + 1, entries.length)
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0)
  parts.push(...central, endOfCentralDirectory(entries.length, centralSize, offset))
  return new Blob(parts, { type: 'application/zip' })
}

async function view(blob: Blob, start: number, length: number): Promise<DataView> {
  const buf = await blob.slice(start, start + length).arrayBuffer()
  return new DataView(buf)
}

export async function unzipStore(archive: Blob): Promise<ZipEntry[]> {
  // The end-of-central-directory record lives in the last 22 bytes, unless the
  // archive carries a trailing comment (up to 64 KB).
  const tailLen = Math.min(archive.size, EOCD_LEN + 0xffff)
  const tail = new DataView(await archive.slice(archive.size - tailLen).arrayBuffer())
  let eocd = -1
  for (let i = tailLen - EOCD_LEN; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD_SIG) { eocd = i; break }
  }
  if (eocd < 0) throw new Error("That file isn't a readable backup archive.")

  const count = tail.getUint16(eocd + 10, true)
  const cdSize = tail.getUint32(eocd + 12, true)
  const cdOffset = tail.getUint32(eocd + 16, true)

  const cd = new DataView(await archive.slice(cdOffset, cdOffset + cdSize).arrayBuffer())
  const decoder = new TextDecoder()
  const entries: ZipEntry[] = []
  let p = 0

  for (let i = 0; i < count; i++) {
    if (p + CENTRAL_HEADER_LEN > cd.byteLength || cd.getUint32(p, true) !== CENTRAL_SIG) {
      throw new Error('Backup archive is damaged (bad directory entry).')
    }
    const method = cd.getUint16(p + 10, true)
    const size = cd.getUint32(p + 20, true)
    const nameLen = cd.getUint16(p + 28, true)
    const extraLen = cd.getUint16(p + 30, true)
    const commentLen = cd.getUint16(p + 32, true)
    const localOffset = cd.getUint32(p + 42, true)
    const name = decoder.decode(new Uint8Array(cd.buffer, p + CENTRAL_HEADER_LEN, nameLen))

    if (method !== STORED) {
      throw new Error(`"${name}" is compressed; only backups made by this app can be restored.`)
    }

    // The local header repeats the name and may carry a different extra field,
    // so the data offset has to come from the local header, not the directory.
    const lh = await view(archive, localOffset, LOCAL_HEADER_LEN)
    if (lh.getUint32(0, true) !== LOCAL_SIG) {
      throw new Error('Backup archive is damaged (bad file header).')
    }
    const dataStart = localOffset + LOCAL_HEADER_LEN + lh.getUint16(26, true) + lh.getUint16(28, true)

    entries.push({ name, blob: archive.slice(dataStart, dataStart + size) })
    p += CENTRAL_HEADER_LEN + nameLen + extraLen + commentLen
  }

  return entries
}
