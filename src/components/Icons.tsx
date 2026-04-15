// Unicode text symbols for all buttons — no SVG, renders consistently on iOS

const T = '\uFE0E' // variation selector-15: force text (not emoji) rendering

interface IconProps {
  size?: number
  className?: string
}

function Sym({ ch, size = 24, className = '' }: { ch: string; size?: number; className?: string }) {
  return (
    <span
      className={`leading-none select-none ${className}`}
      style={{ fontSize: Math.round(size * 0.8) }}
      aria-hidden="true"
    >
      {ch}
    </span>
  )
}

export const PlayIcon          = (p: IconProps) => <Sym ch="▶"         {...p} />
export const PauseIcon         = (p: IconProps) => <Sym ch={`⏸${T}`}   {...p} />
export const NextIcon          = (p: IconProps) => <Sym ch={`⏭${T}`}   {...p} />
export const PrevIcon          = (p: IconProps) => <Sym ch={`⏮${T}`}   {...p} />
export const ShuffleIcon       = (p: IconProps) => <Sym ch="⇄"         {...p} />
export const RepeatIcon        = (p: IconProps) => <Sym ch="↺"         {...p} />
export const ChevronDownIcon   = (p: IconProps) => <Sym ch="⌄"         {...p} />
export const ChevronLeftIcon   = (p: IconProps) => <Sym ch="‹"         {...p} />
export const MusicNoteIcon     = (p: IconProps) => <Sym ch="♪"         {...p} />
export const PlaylistIcon      = (p: IconProps) => <Sym ch="≡"         {...p} />
export const AddToPlaylistIcon = (p: IconProps) => <Sym ch="⊕"         {...p} />
export const PlusIcon          = (p: IconProps) => <Sym ch="+"         {...p} />
export const XIcon             = (p: IconProps) => <Sym ch="×"         {...p} />
export const TrashIcon         = (p: IconProps) => <Sym ch="✕"         {...p} />

export function RepeatOneIcon({ size = 24, className = '' }: IconProps) {
  return (
    <span className={`leading-none select-none ${className}`} aria-hidden="true">
      <span style={{ fontSize: Math.round(size * 0.8) }}>↺</span>
      <span style={{ fontSize: Math.round(size * 0.45), verticalAlign: 'super' }}>1</span>
    </span>
  )
}
