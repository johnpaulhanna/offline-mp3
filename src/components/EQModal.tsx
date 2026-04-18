import { useState, useEffect, useRef } from 'react'
import { setEQGain, applyPreset, getEQGains, ensureEQConnected, EQ_PRESETS, type EQBand, type EQGains } from '../lib/audioEQ'
import { XIcon } from './Icons'

const MIN = -12
const MAX = 12
const TRACK_H = 160 // px

interface SliderProps {
  label: string
  value: number
  onChange: (v: number) => void
}

function VerticalSlider({ label, value, onChange }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const pct = (value - MIN) / (MAX - MIN) // 0 = bottom, 1 = top

  const fromPointer = (e: React.PointerEvent): number => {
    if (!trackRef.current) return value
    const rect = trackRef.current.getBoundingClientRect()
    const p = 1 - (e.clientY - rect.top) / rect.height
    const raw = MIN + Math.max(0, Math.min(1, p)) * (MAX - MIN)
    const rounded = Math.round(raw)
    // Snap to 0 within ±0.5
    return Math.abs(rounded) <= 0 ? 0 : rounded
  }

  // Fill runs from 0dB center to the thumb
  const thumbY = (1 - pct) * TRACK_H
  const centerY = TRACK_H / 2
  const fillTop = Math.min(thumbY, centerY)
  const fillHeight = Math.abs(thumbY - centerY)

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <span className="text-white/50 text-[11px] font-semibold uppercase tracking-wider">{label}</span>

      <div
        ref={trackRef}
        className="relative flex justify-center touch-none cursor-pointer"
        style={{ width: 44, height: TRACK_H }}
        onPointerDown={e => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          draggingRef.current = true
          setIsDragging(true)
          onChange(fromPointer(e))
        }}
        onPointerMove={e => {
          if (!draggingRef.current) return
          onChange(fromPointer(e))
        }}
        onPointerUp={() => { draggingRef.current = false; setIsDragging(false) }}
        onPointerCancel={() => { draggingRef.current = false; setIsDragging(false) }}
      >
        {/* Track background */}
        <div
          className="absolute rounded-full"
          style={{ width: 4, top: 0, height: TRACK_H, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.12)' }}
        />

        {/* 0dB center tick */}
        <div
          className="absolute"
          style={{ width: 10, height: 1, top: TRACK_H / 2, left: '50%', transform: 'translate(-50%, 0)', background: 'rgba(255,255,255,0.25)' }}
        />

        {/* Fill from 0dB to thumb */}
        {fillHeight > 1 && (
          <div
            className="absolute rounded-full"
            style={{ width: 4, top: fillTop, height: fillHeight, left: '50%', transform: 'translateX(-50%)', background: '#fc3c44' }}
          />
        )}

        {/* Thumb */}
        <div
          className="absolute rounded-full bg-white shadow-lg"
          style={{
            width: isDragging ? 26 : 22,
            height: isDragging ? 26 : 22,
            top: thumbY,
            left: '50%',
            transform: `translate(-50%, -50%)`,
            transition: isDragging ? 'width 0.1s ease, height 0.1s ease' : 'width 0.1s ease, height 0.1s ease, top 0.15s cubic-bezier(0.25,0.46,0.45,0.94)',
          }}
        />
      </div>

      {/* Value label */}
      <span className="text-white text-sm font-semibold tabular-nums w-10 text-center">
        {value > 0 ? `+${value}` : `${value}`}
      </span>
    </div>
  )
}

interface Props {
  onClose: () => void
}

export function EQModal({ onClose }: Props) {
  const [gains, setGains] = useState<EQGains>(getEQGains)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    ensureEQConnected()
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const close = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const handleGain = (band: EQBand, db: number) => {
    setGains(prev => ({ ...prev, [band]: db }))
    setEQGain(band, db)
  }

  const handlePreset = (preset: EQGains) => {
    setGains(preset)
    applyPreset(preset)
  }

  const isFlat = gains.bass === 0 && gains.mid === 0 && gains.treble === 0

  return (
    <div className="absolute inset-0 z-20 flex items-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 260ms ease' }}
        onClick={close}
      />

      <div
        className="relative w-full bg-[#1c1c1e] rounded-t-3xl"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
        }}
        onPointerDown={e => e.stopPropagation()}
        onPointerMove={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <p className="text-white font-bold text-lg">Equalizer</p>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Preset chips */}
        <div className="px-5 pb-5">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(EQ_PRESETS).map(([name, preset]) => {
              const active = name === 'Flat'
                ? isFlat
                : gains.bass === preset.bass && gains.mid === preset.mid && gains.treble === preset.treble
              return (
                <button
                  key={name}
                  onClick={() => handlePreset(preset)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors active:scale-95 ${
                    active ? 'bg-[#fc3c44] text-white' : 'bg-white/[0.08] text-white/60 active:bg-white/[0.12]'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sliders */}
        <div className="flex items-start justify-around px-6 pb-8">
          <VerticalSlider label="Bass" value={gains.bass} onChange={v => handleGain('bass', v)} />
          <VerticalSlider label="Mid" value={gains.mid} onChange={v => handleGain('mid', v)} />
          <VerticalSlider label="Treble" value={gains.treble} onChange={v => handleGain('treble', v)} />
        </div>
      </div>
    </div>
  )
}
