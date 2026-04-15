import { useRef, useState } from 'react'
import { importFiles } from '../lib/importTracks'
import { PlusIcon } from './Icons'

export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setImporting(true)
    try {
      await importFiles(files)
    } finally {
      setImporting(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

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
        {importing ? (
          <span className="text-xs">Importing…</span>
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
