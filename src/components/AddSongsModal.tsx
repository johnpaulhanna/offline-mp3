import { useState, useEffect } from 'react'
import { useTracks } from '../hooks/useTracks'
import { usePlaylistTracks, addTrackToPlaylist } from '../hooks/usePlaylists'
import { CoverArt } from './CoverArt'
import { XIcon } from './Icons'

interface Props {
  playlistId: number
  onClose: () => void
}

export function AddSongsModal({ playlistId, onClose }: Props) {
  const allTracks = useTracks('title')
  const playlistData = usePlaylistTracks(playlistId)
  const existingIds = new Set(playlistData?.pts.map(pt => pt.trackId) ?? [])

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const close = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const q = search.toLowerCase().trim()
  const filtered = q
    ? allTracks.filter(t => [t.title, t.artist, t.album].some(f => f.toLowerCase().includes(q)))
    : allTracks

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const newIds = [...selected].filter(id => !existingIds.has(id))

  const handleAdd = async () => {
    if (!newIds.length || saving) return
    setSaving(true)
    try {
      for (const id of newIds) {
        await addTrackToPlaylist(playlistId, id)
      }
      close()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 260ms ease' }}
        onClick={close}
      />

      <div
        className="relative w-full bg-[#1c1c1e] rounded-t-2xl flex flex-col"
        style={{
          maxHeight: '85vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08]">
          <p className="text-white font-semibold">Add Songs</p>
          <button
            onClick={close}
            className="text-white/40 w-7 h-7 flex items-center justify-center active:text-white/70 transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 shrink-0">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search songs, artists…"
            className="w-full bg-white/[0.08] text-white placeholder-gray-500 text-sm px-4 py-2 rounded-xl outline-none"
          />
        </div>

        {/* Track list */}
        <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {filtered.map(track => {
            const id = track.id!
            const alreadyIn = existingIds.has(id)
            const checked = selected.has(id) || alreadyIn
            return (
              <button
                key={id}
                onClick={() => !alreadyIn && toggle(id)}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/[0.05] border-b border-white/[0.05] last:border-0"
              >
                <CoverArt blob={track.coverBlob} size={44} className="rounded-xl shrink-0" />
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm font-semibold truncate ${alreadyIn ? 'text-white/40' : 'text-white'}`}>
                    {track.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{track.artist}</p>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    checked
                      ? alreadyIn
                        ? 'border-white/20 bg-white/[0.1]'
                        : 'border-[#fc3c44] bg-[#fc3c44]'
                      : 'border-white/30'
                  }`}
                >
                  {checked && (
                    <span className={`text-[10px] font-black leading-none ${alreadyIn ? 'text-white/40' : 'text-white'}`}>
                      ✓
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.08] shrink-0">
          {newIds.length > 0 ? (
            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full bg-[#fc3c44] text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
            >
              {saving ? 'Adding…' : `Add ${newIds.length} ${newIds.length === 1 ? 'Song' : 'Songs'}`}
            </button>
          ) : (
            <button
              onClick={close}
              className="w-full bg-white/[0.08] text-white/60 font-semibold py-3.5 rounded-2xl active:bg-white/[0.12] transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
