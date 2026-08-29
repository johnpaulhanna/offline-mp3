import { useRef, useState } from 'react'
import { exportLibrary, restoreLibrary, backupFilename, offerFile, type Progress } from '../lib/backup'
import { ImportIcon, PlusIcon } from './Icons'

function describe(p: Progress): string {
  const label = p.phase === 'packing' ? 'Packing' : p.phase === 'restoring' ? 'Restoring' : 'Reading'
  return `${label} ${p.done}/${p.total}…`
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export function BackupBar() {
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const restoreRef = useRef<HTMLInputElement>(null)

  // Progress fires per track; repainting every one of several hundred is pure jank.
  const report = (p: Progress) => {
    if (p.done === p.total || p.done % 5 === 0) setBusy(describe(p))
  }

  const handleExport = async () => {
    setBusy('Preparing…')
    setMessage(null)
    try {
      const blob = await exportLibrary(report)
      const how = await offerFile(blob, backupFilename())
      setMessage(
        how === 'shared'
          ? 'Backup ready — choose "Save to Files" to keep it.'
          : 'Backup saved to your downloads.'
      )
    } catch (err) {
      setMessage(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy('Reading backup…')
    setMessage(null)
    try {
      const result = await restoreLibrary(file, report)
      const parts = [`Added ${result.tracksAdded} song${result.tracksAdded === 1 ? '' : 's'}`]
      if (result.tracksSkipped) parts.push(`${result.tracksSkipped} already in your library`)
      setMessage(`${parts.join(', ')}.`)
    } catch (err) {
      setMessage(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="px-4 pt-3 pb-1">
      <input
        ref={restoreRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={handleRestore}
      />

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-white/[0.06] text-white/70 text-xs font-semibold py-2.5 rounded-xl active:bg-white/[0.12] disabled:opacity-40 transition-colors"
        >
          <ImportIcon size={14} />
          Back up library
        </button>
        <button
          onClick={() => restoreRef.current?.click()}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-white/[0.06] text-white/70 text-xs font-semibold py-2.5 rounded-xl active:bg-white/[0.12] disabled:opacity-40 transition-colors"
        >
          <PlusIcon size={14} />
          Restore backup
        </button>
      </div>

      {(busy || message) && (
        <p className="text-center text-[11px] text-gray-500 mt-2 leading-relaxed" role="status">
          {busy ?? message}
        </p>
      )}
    </div>
  )
}
