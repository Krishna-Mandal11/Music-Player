import { useCallback, useEffect, useState } from 'react'
import TrackList from './TrackList'
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

function PlaylistPage({ playlistId, player, favourites, onDeleted }) {
  const { playlists, version, refresh, rename, remove, removeTrack } = usePlaylists()
  const playlist = playlists.find((p) => p.id === playlistId)

  const [tracks, setTracks] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setTracks(await window.api.getPlaylistTracks(playlistId))
    setLoaded(true)
  }, [playlistId])

  useEffect(() => {
    load()
  }, [load, version])

  // If songs disappear from the library, the playlist updates too
  useEffect(
    () =>
      window.api.onLibraryChanged(() => {
        load()
        refresh()
      }),
    [load, refresh]
  )

  if (!playlist) return null

  function startRename() {
    setDraft(playlist.name)
    setError('')
    setEditing(true)
  }

  async function saveRename() {
    const result = await rename(playlistId, draft)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEditing(false)
    setError('')
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the playlist "${playlist.name}"? Your songs are not deleted.`))
      return
    await remove(playlistId)
    onDeleted()
  }

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {editing ? (
        <div style={{ marginBottom: 8 }}>
          <input
            autoFocus
            value={draft}
            maxLength={100}
            onChange={(e) => {
              setDraft(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename()
              if (e.key === 'Escape') setEditing(false)
            }}
            style={{
              fontSize: 22,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.06)',
              color: 'inherit',
              userSelect: 'text',
              width: 320,
              maxWidth: '100%'
            }}
          />
          <button style={{ ...button, marginLeft: 8 }} onClick={saveRename}>
            Save
          </button>
          <button style={{ ...button, marginLeft: 8 }} onClick={() => setEditing(false)}>
            Cancel
          </button>
          {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginTop: 6 }}>{error}</div>}
        </div>
      ) : (
        <h2 style={{ margin: '0 0 8px' }}>{playlist.name}</h2>
      )}

      <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7 }}>
        {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          style={{ ...button, opacity: tracks.length === 0 ? 0.5 : 1 }}
          disabled={tracks.length === 0}
          onClick={() => player.play(tracks[0], tracks)}
        >
          Play
        </button>
        <button style={button} onClick={startRename} disabled={editing}>
          Rename
        </button>
        <button style={button} onClick={handleDelete}>
          Delete playlist
        </button>
      </div>

      <TrackList
        tracks={tracks}
        player={player}
        favourites={favourites}
        onRemove={(track) => removeTrack(playlistId, track.id)}
      />

      {loaded && tracks.length === 0 && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          This playlist is empty. Use the + button on any song to add it here.
        </p>
      )}
    </div>
  )
}

export default PlaylistPage
