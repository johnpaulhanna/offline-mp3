import { useState, useEffect } from 'react'

interface Props {
  title: string
  message?: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

/**
 * Confirmation for actions that destroy something the user cannot get back.
 *
 * Deleting a track removes the audio file itself, and for most of this library
 * there is no other copy anywhere. Every delete path used to fire immediately —
 * including a full swipe, which is easy to trigger while scrolling.
 */
export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onClose }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const close = () => {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  const confirm = () => {
    onConfirm()
    close()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 240ms ease' }}
        onClick={close}
      />

      <div
        className="relative w-full"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 280ms cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <div className="mx-3 mb-2 bg-[#1c1c1e] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 text-center border-b border-white/[0.08]">
            <p className="text-white font-semibold text-sm">{title}</p>
            {message && <p className="text-gray-400 text-xs mt-1 leading-relaxed">{message}</p>}
          </div>
          <button
            onClick={confirm}
            className="w-full py-4 text-red-400 text-base font-semibold active:bg-white/5"
          >
            {confirmLabel}
          </button>
        </div>

        <button
          onClick={close}
          className="mx-3 w-[calc(100%-1.5rem)] bg-[#1c1c1e] rounded-2xl py-4 text-white font-semibold text-base active:bg-[#2c2c2e] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
