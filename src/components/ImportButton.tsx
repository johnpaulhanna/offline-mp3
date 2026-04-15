import { useRef, useState } from 'react'
import { importFiles } from '../lib/importTracks'

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
        className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2 rounded-full disabled:opacity-50 active:scale-95 transition-transform"
      >
        {importing ? (
          <>
            <span className="animate-spin text-base">↻</span> Importing…
          </>
        ) : (
          <>
            <span className="text-base">+</span> Add Music
          </>
        )}
      </button>
    </>
  )
}
