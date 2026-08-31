import { useRef, useState } from 'react'
import { importFiles, AUDIO_ACCEPT } from '../lib/importTracks'
import { PlusIcon } from './Icons'

export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setProgress({ done: 0, total: files.length })
    setNote(null)
    try {
      const result = await importFiles(files, undefined, (done, total) => setProgress({ done, total }))
      const parts: string[] = []
      if (result.imported) parts.push(`Added ${result.imported}`)
      if (result.skipped) parts.push(`${result.skipped} already here`)
      if (result.failed) parts.push(`${result.failed} couldn't be read`)
      setNote(parts.join(' · ') || null)
    } finally {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const importing = progress !== null

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex items-center gap-2">
        {note && !importing && (
          <button onClick={() => setNote(null)} className="text-[11px] text-gray-500 max-w-36 truncate" role="status">
            {note}
          </button>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-1.5 bg-white text-black text-sm font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-40 active:scale-95 transition-transform"
        >
          {importing && progress ? (
            <span className="text-xs">{progress.done} / {progress.total}</span>
          ) : (
            <>
              <PlusIcon size={15} />
              <span>Add Music</span>
            </>
          )}
        </button>
      </div>
    </>
  )
}
