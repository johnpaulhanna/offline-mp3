import { useState, useEffect } from 'react'
import { updateTrack } from '../hooks/useTracks'
import type { Track } from '../db'

interface Props {
  track: Track
  onClose: () => void
}

export function EditTrackModal({ track, onClose }: Props) {
  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist)
  const [album, setAlbum] = useState(track.album)
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const close = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const handleSave = async () => {
    if (!track.id || saving) return
    setSaving(true)
    try {
      await updateTrack(track.id, {
        title: title.trim() || track.title,
        artist: artist.trim() || track.artist,
        album: album.trim() || track.album,
      })
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
        className="relative w-full bg-[#1c1c1e] rounded-t-2xl"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-5 pt-2 pb-4">
          <p className="text-white font-semibold text-base mb-4">Edit Track Info</p>

          {[
            { label: 'Title', value: title, onChange: setTitle },
            { label: 'Artist', value: artist, onChange: setArtist },
            { label: 'Album', value: album, onChange: setAlbum },
          ].map(({ label, value, onChange }) => (
            <div key={label} className="mb-3">
              <p className="text-white/40 text-xs font-medium mb-1.5">{label.toUpperCase()}</p>
              <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-white/[0.08] text-white rounded-xl px-4 py-3 text-sm outline-none border border-white/[0.08] focus:border-white/30 transition-colors"
                placeholder={label}
              />
            </div>
          ))}

          <div className="flex gap-2 mt-4">
            <button
              onClick={close}
              className="flex-1 py-3 rounded-xl bg-white/[0.06] text-white/60 text-sm font-medium active:opacity-70"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#fc3c44] text-white text-sm font-semibold active:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
