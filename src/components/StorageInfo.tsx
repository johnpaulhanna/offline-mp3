import { useEffect, useState } from 'react'
import { db } from '../db'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function StorageInfo() {
  const [trackCount, setTrackCount] = useState(0)
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null)

  useEffect(() => {
    const update = async () => {
      const count = await db.tracks.count()
      setTrackCount(count)
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const est = await navigator.storage.estimate()
        setUsage({ used: est.usage ?? 0, quota: est.quota ?? 0 })
      }
    }
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="text-center text-xs text-gray-600 py-2 px-4">
      {trackCount} track{trackCount !== 1 ? 's' : ''}
      {usage && ` · ${formatBytes(usage.used)} used of ${formatBytes(usage.quota)}`}
    </div>
  )
}
