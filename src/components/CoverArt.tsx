import { useEffect, useRef, useState } from 'react'
import { useBlobUrl } from '../hooks/useBlobUrl'

// Constant for the life of the page, so it belongs outside the component.
const CAN_OBSERVE = typeof IntersectionObserver !== 'undefined'

interface Props {
  blob: Blob | null | undefined
  size?: number          // fixed px size (default mode)
  fluid?: boolean        // fills parent container width, maintains aspect ratio
  eager?: boolean        // skip the viewport check (for the one big Now Playing cover)
  className?: string
  style?: React.CSSProperties
}

export function CoverArt({ blob, size, fluid = false, eager = false, className = '', style }: Props) {
  const holderRef = useRef<HTMLDivElement | null>(null)
  const [near, setNear] = useState(!CAN_OBSERVE)
  const show = eager || near

  // A long library holds one object URL per visible cover instead of one per
  // track. Without this, scrolling a few hundred songs into view keeps every
  // decoded cover alive at once, which is what pushes iOS Safari to evict the tab.
  useEffect(() => {
    if (show) return
    const el = holderRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) setNear(true)
      },
      { rootMargin: '300px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [show])

  const url = useBlobUrl(show ? blob : null)

  const placeholderSize = fluid ? '40%' : (size ?? 48) * 0.4

  if (fluid) {
    return url ? (
      <img src={url} alt="" className={`aspect-square object-cover shrink-0 ${className}`} style={style} />
    ) : (
      <div
        ref={holderRef}
        className={`aspect-square flex items-center justify-center bg-[#2c2c2e] shrink-0 ${className}`}
        style={style}
      >
        {!blob && <span className="text-gray-500" style={{ fontSize: placeholderSize }}>♪</span>}
      </div>
    )
  }

  const sz = size ?? 48
  if (!url) {
    return (
      <div
        ref={holderRef}
        className={`flex items-center justify-center bg-[#2c2c2e] rounded shrink-0 ${className}`}
        style={{ width: sz, height: sz, ...style }}
      >
        {!blob && <span className="text-gray-500" style={{ fontSize: placeholderSize }}>♪</span>}
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
