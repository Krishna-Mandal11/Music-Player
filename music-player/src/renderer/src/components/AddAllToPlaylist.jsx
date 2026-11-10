import { useState } from 'react'
import { usePlaylists } from '../PlaylistsContext'

const button = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13
}

const menuItem = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '7px 8px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
}

// tracks = the songs of the album, artist or genre currently shown
function AddAllToPlaylist({ tracks }) {
  const { playlists, create, addTracks } = usePlaylists()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState('')

  function close() {
    setOpen(false)
    setNewName('')
    setMessage('')
  }

  async function addTo(playlist) {
    const ids = tracks.map((t) => t.id)
    const result = await addTracks(playlist.id, ids)
    if (result.ok === false) {
      setMessage(result.error)
      return
    }
    const already = ids.length - result.added
    let text = `Added ${result.added} ${result.added === 1 ? 'song' : 'songs'} to ${playlist.name}`
    if (already > 0) text += ` (${already} already there)`
    setMessage(text)
    setTimeout(close, 1600)
  }

  async function createAndAdd() {
    const created = await create(newName)
    if (!created.ok) {
      setMessage(created.error)
      return
    }
    await addTo(created.playlist)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        style={{ ...button, opacity: tracks.length === 0 ? 0.5 : 1 }}
        disabled={tracks.length === 0}
        onClick={() => setOpen(true)}
      >
        Add all to playlist
      </button>

      {open && (
        <>
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '100%',
              marginTop: 4,
              zIndex: 21,
              width: 240,
              maxHeight: 280,
              overflowY: 'auto',
              padding: 8,
              borderRadius: 8,
              border: '1px solid #33333d',
              background: '#1f1f27',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.6, padding: '0 8px 6px' }}>
              ADD {tracks.length} {tracks.length === 1 ? 'SONG' : 'SONGS'} TO
            </div>

            {playlists.length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.7, padding: '0 8px 8px' }}>
                No playlists yet. Create one below.
              </div>
            )}

            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                style={menuItem}
                title={playlist.name}
                onClick={() => addTo(playlist)}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {playlist.name}
              </button>
            ))}

            <div style={{ display: 'flex', gap: 6, padding: '8px 0 0' }}>
              <input
                placeholder="New playlist"
                value={newName}
                maxLength={100}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setMessage('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createAndAdd()
                  if (e.key === 'Escape') close()
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'inherit',
                  fontSize: 13,
                  userSelect: 'text'
                }}
              />
              <button style={{ ...button, padding: '6px 10px' }} onClick={createAndAdd}>
                Create
              </button>
            </div>

            {message && <div style={{ fontSize: 12, opacity: 0.85, paddingTop: 8 }}>{message}</div>}
          </div>
        </>
      )}
    </div>
  )
}

export default AddAllToPlaylist
