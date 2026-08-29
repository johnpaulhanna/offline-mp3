import { useRef, useState } from 'react'
import type { Track } from '../db'
import type { QueueEntry } from '../hooks/usePlayer'
import { CoverArt } from './CoverArt'
import { XIcon, DragHandleIcon } from './Icons'

const ROW_H = 64

interface Props {
  current: Track | null
  upcoming: QueueEntry[]
  shuffle: boolean
  onClose: () => void
  onJumpTo: (queueIndex: number) => void
  onRemove: (queueIndex: number) => void
  onReorder: (from: number, to: number) => void
}

interface DragState {
  fromLocal: number
  startY: number
  dy: number
}

export function QueueView({ current, upcoming, shuffle, onClose, onJumpTo, onRemove, onReorder }: Props) {
  // Ref holds current drag state for stale-closure-free access in event handlers.
  // useState drives rendering.
  const dragRef = useRef<DragState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const didDrag = useRef(false)

  // Hand-ordering a shuffled lap has no meaning — the order is already random,
  // and a drag would fight the next reshuffle. Apple Music hides it too.
  const reorderable = !shuffle

  const clampDelta = (d: DragState) =>
    Math.max(-d.fromLocal, Math.min(upcoming.length - 1 - d.fromLocal, Math.round(d.dy / ROW_H)))

  const dragDelta = drag ? clampDelta(drag) : 0
  const toLocal = drag ? drag.fromLocal + dragDelta : -1

  const startDrag = (e: React.PointerEvent, localIdx: number) => {
    e.stopPropagation()
    // Capture on the handle so all subsequent pointer events come here even when
    // the finger moves outside the small handle area
    e.currentTarget.setPointerCapture(e.pointerId)
    didDrag.current = false
    const d: DragState = { fromLocal: localIdx, startY: e.clientY, dy: 0 }
    dragRef.current = d
    setDrag(d)
  }

  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    e.stopPropagation()
    const dy = e.clientY - d.startY
    if (Math.abs(dy) > 4) didDrag.current = true
    const updated = { ...d, dy }
    dragRef.current = updated
    setDrag(updated)
  }

  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    e.stopPropagation()
    const delta = clampDelta(d)
    if (delta !== 0) {
      const from = upcoming[d.fromLocal]
      const to = upcoming[d.fromLocal + delta]
      if (from && to) onReorder(from.queueIndex, to.queueIndex)
    }
    dragRef.current = null
    setDrag(null)
  }

  const cancelDrag = () => {
    dragRef.current = null
    setDrag(null)
  }

  const rowTransform = (localIdx: number): string => {
    if (!drag) return 'translateY(0)'
    if (localIdx === drag.fromLocal) return `translateY(${drag.dy}px)`
    if (dragDelta > 0 && localIdx > drag.fromLocal && localIdx <= toLocal)
      return `translateY(-${ROW_H}px)`
    if (dragDelta < 0 && localIdx < drag.fromLocal && localIdx >= toLocal)
      return `translateY(${ROW_H}px)`
    return 'translateY(0)'
  }

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col animate-sheet-in"
      style={{
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pb-3 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
      >
        <div>
          <p className="text-white font-bold text-lg tracking-tight">Queue</p>
          {shuffle && <p className="text-white/40 text-[11px] mt-0.5">Shuffled</p>}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
          aria-label="Close queue"
        >
          <XIcon size={18} />
        </button>
      </div>

      <div
        className="overflow-y-auto flex-1"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {/* Now Playing */}
        {current && (
          <div className="px-4 pb-2">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest px-1 pb-2">
              Now Playing
            </p>
            <div className="flex items-center gap-3 bg-white/[0.08] rounded-2xl px-4 py-3">
              <CoverArt blob={current.coverBlob} size={44} className="rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{current.title}</p>
                <p className="text-white/50 text-xs truncate mt-0.5">{current.artist}</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#fc3c44] animate-pulse shrink-0" />
            </div>
          </div>
        )}

        {/* Next Up */}
        <div className="px-4 pt-3 pb-6">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest px-1 pb-2">
            {upcoming.length > 0 ? 'Next Up' : 'Nothing up next'}
          </p>

          <div className="relative" style={{ minHeight: upcoming.length * ROW_H }}>
            {upcoming.map(({ track, queueIndex }, localIdx) => {
              const isDraggingThis = drag?.fromLocal === localIdx
              return (
                <div
                  key={`${queueIndex}-${track.id}`}
                  className={`absolute left-0 right-0 flex items-center gap-3 px-3 py-3 rounded-2xl select-none ${
                    isDraggingThis ? 'bg-white/[0.12]' : 'bg-white/[0.04]'
                  }`}
                  style={{
                    top: localIdx * ROW_H,
                    height: ROW_H,
                    transform: rowTransform(localIdx),
                    transition: isDraggingThis
                      ? 'background-color 0.1s ease'
                      : 'transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94)',
                    zIndex: isDraggingThis ? 10 : 1,
                    willChange: isDraggingThis ? 'transform' : undefined,
                  }}
                  onClick={() => {
                    if (didDrag.current) { didDrag.current = false; return }
                    onJumpTo(queueIndex)
                  }}
                >
                  <CoverArt blob={track.coverBlob} size={44} className="rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{track.title}</p>
                    <p className="text-white/50 text-xs truncate mt-0.5">{track.artist}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onRemove(queueIndex) }}
                    className="w-7 h-7 flex items-center justify-center text-white/30 active:text-white/70 transition-colors shrink-0"
                    aria-label="Remove from queue"
                  >
                    <XIcon size={16} />
                  </button>
                  {/* Drag handle — captures pointer directly so events don't rely on
                      bubbling to a container element, which is unreliable on iOS */}
                  {reorderable && (
                    <div
                      onPointerDown={e => startDrag(e, localIdx)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={cancelDrag}
                      onClick={e => e.stopPropagation()}
                      className="w-8 h-8 flex items-center justify-center text-white/25 active:text-white/60 cursor-grab shrink-0 touch-none"
                      aria-label="Drag to reorder"
                    >
                      <DragHandleIcon size={20} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
