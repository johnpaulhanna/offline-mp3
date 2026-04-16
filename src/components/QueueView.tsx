import { useRef, useState } from 'react'
import type { Track } from '../db'
import { CoverArt } from './CoverArt'
import { XIcon, DragHandleIcon } from './Icons'

const ROW_H = 64 // px — must match row height below

interface Props {
  queue: Track[]
  queueIndex: number
  onClose: () => void
  onJumpTo: (index: number) => void
  onRemove: (index: number) => void
  onReorder: (from: number, to: number) => void
}

interface DragState {
  fromLocal: number   // index within "next up" list
  fromQueue: number   // actual queue index
  startY: number
  dy: number
}

export function QueueView({ queue, queueIndex, onClose, onJumpTo, onRemove, onReorder }: Props) {
  const current = queue[queueIndex]
  const nextUp = queue.slice(queueIndex + 1)

  const [drag, setDrag] = useState<DragState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // How many rows the dragged item has shifted (clamped to list bounds)
  const dragDelta = drag
    ? Math.max(-drag.fromLocal, Math.min(nextUp.length - 1 - drag.fromLocal, Math.round(drag.dy / ROW_H)))
    : 0
  const toLocal = drag ? drag.fromLocal + dragDelta : -1

  const startDrag = (e: React.PointerEvent, localIdx: number) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ fromLocal: localIdx, fromQueue: queueIndex + 1 + localIdx, startY: e.clientY, dy: 0 })
  }

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return
    e.stopPropagation()
    setDrag(d => d ? { ...d, dy: e.clientY - d.startY } : null)
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return
    e.stopPropagation()
    const finalTo = drag.fromQueue + dragDelta
    if (dragDelta !== 0) onReorder(drag.fromQueue, finalTo)
    setDrag(null)
  }

  // Compute the display transform for each "next up" row
  const rowTransform = (localIdx: number): string => {
    if (!drag) return 'translateY(0)'
    if (localIdx === drag.fromLocal) return `translateY(${drag.dy}px)`
    // Shift other rows to make room
    if (dragDelta > 0 && localIdx > drag.fromLocal && localIdx <= toLocal)
      return `translateY(-${ROW_H}px)`
    if (dragDelta < 0 && localIdx < drag.fromLocal && localIdx >= toLocal)
      return `translateY(${ROW_H}px)`
    return 'translateY(0)'
  }

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col animate-sheet-in"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={() => setDrag(null)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <p className="text-white font-bold text-lg tracking-tight">Queue</p>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
          aria-label="Close queue"
        >
          <XIcon size={18} />
        </button>
      </div>

      <div className="overflow-y-auto flex-1" ref={containerRef}>
        {/* Now Playing */}
        {current && (
          <div className="px-4 pb-2">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest px-1 pb-2">Now Playing</p>
            <div className="flex items-center gap-3 bg-white/[0.08] rounded-2xl px-4 py-3">
              <CoverArt blob={current.coverBlob} size={44} className="rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{current.title}</p>
                <p className="text-white/50 text-xs truncate mt-0.5">{current.artist}</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
            </div>
          </div>
        )}

        {/* Next Up */}
        <div className="px-4 pt-3 pb-6">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest px-1 pb-2">
            {nextUp.length > 0 ? 'Next Up' : 'Queue is empty'}
          </p>

          <div className="relative" style={{ minHeight: nextUp.length * ROW_H }}>
            {nextUp.map((track, localIdx) => {
              const qIdx = queueIndex + 1 + localIdx
              const isDraggingThis = drag?.fromLocal === localIdx
              return (
                <div
                  key={`${qIdx}-${track.id}`}
                  className={`absolute left-0 right-0 flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer select-none transition-colors ${
                    isDraggingThis ? 'bg-white/15 z-10' : 'bg-white/[0.04] active:bg-white/[0.08]'
                  }`}
                  style={{
                    top: localIdx * ROW_H,
                    height: ROW_H,
                    transform: rowTransform(localIdx),
                    transition: isDraggingThis ? 'none' : 'transform 0.18s ease',
                    zIndex: isDraggingThis ? 10 : 1,
                  }}
                  onClick={() => { if (!drag) onJumpTo(qIdx) }}
                >
                  <CoverArt blob={track.coverBlob} size={44} className="rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{track.title}</p>
                    <p className="text-white/50 text-xs truncate mt-0.5">{track.artist}</p>
                  </div>
                  <button
                    onPointerDown={e => {
                      e.stopPropagation()
                      onRemove(qIdx)
                    }}
                    onClick={e => e.stopPropagation()}
                    className="w-7 h-7 flex items-center justify-center text-white/30 active:text-white/70 shrink-0"
                    aria-label="Remove from queue"
                  >
                    <XIcon size={16} />
                  </button>
                  <div
                    onPointerDown={e => startDrag(e, localIdx)}
                    onClick={e => e.stopPropagation()}
                    className="w-8 h-8 flex items-center justify-center text-white/25 active:text-white/60 cursor-grab active:cursor-grabbing shrink-0 touch-none"
                    aria-label="Drag to reorder"
                  >
                    <DragHandleIcon size={20} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
