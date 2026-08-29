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
  quota: number | null
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
      let quota: number | null = null
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const est = await navigator.storage.estimate()
        used = est.usage ?? null
        quota = est.quota ?? null
      }
      const persisted = (await navigator.storage?.persisted?.()) ?? false
      if (!cancelled) setInfo({ tracks, used, quota, persisted })
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
    <div className="text-center text-xs text-gray-600 px-4">
      {info.tracks} track{info.tracks !== 1 ? 's' : ''}
      {info.used != null && ` · ${formatBytes(info.used)} used`}
      {info.quota != null && ` of ${formatBytes(info.quota)}`}
      {!info.persisted && info.tracks > 0 && (
        <p className="text-amber-500/60 mt-1 leading-relaxed">
          Your phone hasn't marked this storage as protected yet. Keep a backup.
        </p>
      )}
    </div>
  )
}
