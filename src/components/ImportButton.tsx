import { useRef, useState } from 'react'
import { importFiles } from '../lib/importTracks'
import { PlusIcon } from './Icons'

export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setProgress({ done: 0, total: files.length })
    try {
      await importFiles(files, undefined, (done, total) => setProgress({ done, total }))
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
        accept="audio/mpeg,audio/mp3,.mp3"
        className="hidden"
        onChange={handleChange}
      />
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
    </>
  )
}
