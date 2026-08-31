import { useEffect, useMemo } from 'react'

// Object URL for a blob, revoked when the blob changes or the component goes away.
//
// Derived during render rather than in an effect, so an image paints on the
// first commit instead of after a second render pass — with hundreds of covers
// on screen that second pass is the difference between a smooth and a janky list.
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])

  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  return url
}
