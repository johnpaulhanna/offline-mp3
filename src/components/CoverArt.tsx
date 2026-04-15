import { useEffect, useState } from 'react'

interface Props {
  blob: Blob | null | undefined
  size: number
  className?: string
}

export function CoverArt({ blob, size, className = '' }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) { setUrl(null); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-800 rounded shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-gray-500" style={{ fontSize: size * 0.4 }}>♪</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      className={`object-cover rounded shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
