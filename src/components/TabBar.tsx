import { MusicNoteIcon, PlaylistIcon } from './Icons'

export type Tab = 'songs' | 'playlists'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <div
      className="shrink-0 rounded-t-3xl bg-gray-950/95 backdrop-blur border-t border-white/5"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {([
          { id: 'songs', label: 'Songs', Icon: MusicNoteIcon },
          { id: 'playlists', label: 'Playlists', Icon: PlaylistIcon },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors active:opacity-70 ${
              active === id ? 'text-white' : 'text-white/30'
            }`}
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
