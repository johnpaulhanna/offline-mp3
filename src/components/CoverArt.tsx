import { useEffect, useState } from 'react'

interface Props {
  blob: Blob | null | undefined
  size?: number          // fixed px size (default mode)
  fluid?: boolean        // fills parent container width, maintains aspect ratio
  className?: string
  style?: React.CSSProperties
}

export function CoverArt({ blob, size, fluid = false, className = '', style }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) { setUrl(null); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  if (fluid) {
    const base = `aspect-square object-cover shrink-0 ${className}`
    return url
      ? <img src={url} alt="" className={base} style={style} />
      : (
        <div className={`aspect-square flex items-center justify-center bg-[#2c2c2e] shrink-0 ${className}`} style={style}>
          <span className="text-gray-500 text-[40%]">♪</span>
        </div>
      )
  }

  const sz = size ?? 48
  if (!url) {
    return (
      <div
        className={`flex items-center justify-center bg-[#2c2c2e] rounded shrink-0 ${className}`}
        style={{ width: sz, height: sz, ...style }}
      >
        <span className="text-gray-500" style={{ fontSize: sz * 0.4 }}>♪</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      className={`object-cover rounded shrink-0 ${className}`}
      style={{ width: sz, height: sz, ...style }}
    />
  )
}
