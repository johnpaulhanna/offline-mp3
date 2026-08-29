import { useState } from 'react'
import { readLog, clearLog, formatLog, isLogging, setLogging } from '../lib/debugLog'
import { XIcon } from './Icons'

interface Props {
  onClose: () => void
}

export function DiagnosticsSheet({ onClose }: Props) {
  const [text, setText] = useState(() => formatLog(readLog()))
  const [logging, setLoggingState] = useState(isLogging)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-white/[0.08]">
        <p className="text-white font-bold">Diagnostics</p>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          aria-label="Close diagnostics"
        >
          <XIcon size={18} />
        </button>
      </div>

      <div className="flex gap-2 px-4 py-3 shrink-0">
        <button
          onClick={copy}
          className="flex-1 bg-white/[0.08] text-white/80 text-xs font-semibold py-2.5 rounded-xl active:bg-white/[0.15]"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={() => { clearLog(); setText(formatLog([])) }}
          className="flex-1 bg-white/[0.08] text-white/80 text-xs font-semibold py-2.5 rounded-xl active:bg-white/[0.15]"
        >
          Clear
        </button>
        <button
          onClick={() => { const next = !logging; setLogging(next); setLoggingState(next) }}
          className={`flex-1 text-xs font-semibold py-2.5 rounded-xl ${
            logging ? 'bg-[#fc3c44] text-white' : 'bg-white/[0.08] text-white/50'
          }`}
        >
          {logging ? 'Recording' : 'Off'}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-8" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <pre className="text-[10px] leading-relaxed text-white/60 whitespace-pre font-mono" style={{ userSelect: 'text' }}>
          {text}
        </pre>
      </div>
    </div>
  )
}
