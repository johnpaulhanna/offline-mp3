import { useEffect, useState } from 'react'
import { db } from '../db'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

interface Info {
  tracks: number
  used: number | null
  persisted: boolean
}

export function StorageInfo() {
  const [info, setInfo] = useState<Info | null>(null)

  useEffect(() => {
    let cancelled = false

    const update = async () => {
      if (document.hidden) return
      const tracks = await db.tracks.count()
      let used: number | null = null
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        used = (await navigator.storage.estimate()).usage ?? null
      }
      const persisted = (await navigator.storage?.persisted?.()) ?? false
      if (!cancelled) setInfo({ tracks, used, persisted })
    }

    update()
    // Only while the app is on screen — this used to poll every 10s forever.
    const id = setInterval(update, 30_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  if (!info) return null

  return (
    <div className="text-center text-[11px] text-white/25 px-4">
      {info.tracks} song{info.tracks !== 1 ? 's' : ''}
      {info.used != null && ` · ${formatBytes(info.used)}`}
      {!info.persisted && info.tracks > 0 && (
        <p className="text-amber-500/40 mt-1">Storage isn't protected yet — keep a backup.</p>
      )}
    </div>
  )
}
