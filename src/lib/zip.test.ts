import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { zipStore, unzipStore, type ZipEntry } from './zip'

let dir: string
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'zip-test-')) })
afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

async function writeArchive(entries: ZipEntry[], file: string): Promise<string> {
  const zip = await zipStore(entries)
  const path = join(dir, file)
  writeFileSync(path, Buffer.from(await zip.arrayBuffer()))
  return path
}

const UNICODE_NAME = 'audio/Café — Naïve.mp3'
const text = (s: string) => new Blob([s])
const bytes = (n: number) => {
  const a = new Uint8Array(n)
  for (let i = 0; i < n; i++) a[i] = (i * 7 + 13) & 0xff
  return a
}

describe('zipStore', () => {
  it('produces an archive the system unzip accepts', async () => {
    const path = await writeArchive(
      [
        { name: 'library.json', blob: text('{"version":1}') },
        { name: 'audio/song one.mp3', blob: new Blob([bytes(5000)]) },
        { name: UNICODE_NAME, blob: text('unicode filename') },
      ],
      'ok.zip'
    )
    const out = execFileSync('unzip', ['-t', path], { encoding: 'utf8' })
    expect(out).toContain('No errors detected')
    expect(out.match(/OK$/gm)).toHaveLength(3)

    // macOS unzip mangles UTF-8 names in its own console output; our reader must not.
    const read = await unzipStore(new Blob([readFileSync(path)]))
    expect(read.map(e => e.name)).toContain(UNICODE_NAME)
  })

  it('round-trips content through the system unzip, including CRCs', async () => {
    const path = await writeArchive([{ name: 'a/b.txt', blob: text('hello backup') }], 'content.zip')
    const out = execFileSync('unzip', ['-p', path, 'a/b.txt'], { encoding: 'utf8' })
    expect(out).toBe('hello backup')
  })

  it('handles empty files and an empty archive', async () => {
    const empty = await writeArchive([], 'empty.zip')
    expect(readFileSync(empty).length).toBe(22)
    expect(await unzipStore(new Blob([readFileSync(empty)]))).toEqual([])

    const withEmptyFile = await writeArchive([{ name: 'nothing.bin', blob: new Blob([]) }], 'zero.zip')
    expect(execFileSync('unzip', ['-t', withEmptyFile], { encoding: 'utf8' })).toContain('No errors detected')
  })
})

describe('unzipStore', () => {
  it('round-trips its own archives byte for byte', async () => {
    const payload = bytes(100_000)
    const entries: ZipEntry[] = [
      { name: 'library.json', blob: text('{"tracks":[]}') },
      { name: 'audio/0001.mp3', blob: new Blob([payload]) },
      { name: 'covers/0001.jpg', blob: new Blob([bytes(37)]) },
    ]
    const read = await unzipStore(await zipStore(entries))

    expect(read.map(e => e.name)).toEqual(entries.map(e => e.name))
    expect(await read[0].blob.text()).toBe('{"tracks":[]}')
    expect(new Uint8Array(await read[1].blob.arrayBuffer())).toEqual(payload)
    expect(read[2].blob.size).toBe(37)
  })

  it('reads a stored archive made by the system zip tool', async () => {
    writeFileSync(join(dir, 'outside.txt'), 'made by /usr/bin/zip')
    execFileSync('zip', ['-0', '-q', 'system.zip', 'outside.txt'], { cwd: dir })
    const read = await unzipStore(new Blob([readFileSync(join(dir, 'system.zip'))]))
    expect(read).toHaveLength(1)
    expect(read[0].name).toBe('outside.txt')
    expect(await read[0].blob.text()).toBe('made by /usr/bin/zip')
  })

  it('explains itself when handed a deflated archive', async () => {
    writeFileSync(join(dir, 'big.txt'), 'a'.repeat(10_000))
    execFileSync('zip', ['-9', '-q', 'deflated.zip', 'big.txt'], { cwd: dir })
    await expect(unzipStore(new Blob([readFileSync(join(dir, 'deflated.zip'))])))
      .rejects.toThrow(/only backups made by this app/)
  })

  it('rejects a file that is not an archive', async () => {
    await expect(unzipStore(new Blob(['just some bytes'])))
      .rejects.toThrow(/isn't a readable backup archive/)
  })
})
