import { MusicNoteIcon, PlaylistIcon } from './Icons'

export type Tab = 'songs' | 'playlists'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <div
      className="flex border-t border-white/8 bg-black/80 backdrop-blur shrink-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {([
        { id: 'songs', label: 'Songs', Icon: MusicNoteIcon },
        { id: 'playlists', label: 'Playlists', Icon: PlaylistIcon },
      ] as const).map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors active:opacity-70 ${
            active === id ? 'text-white' : 'text-white/30'
          }`}
        >
          <Icon size={22} />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      ))}
    </div>
  )
}
