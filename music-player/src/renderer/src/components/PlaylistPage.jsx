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

const activeButton = { ...button, background: 'var(--accent)', borderColor: 'var(--accent)' }

const NEXT_REPEAT = { off: 'all', all: 'one', one: 'off' }

function PlaylistPage({ playlistId, player, favourites, onDeleted }) {
  const { playlists, version, refresh, rename, remove, setMode, removeTrack, reorder } =
    usePlaylists()
  const playlist = playlists.find((p) => p.id === playlistId)

  const [tracks, setTracks] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState(null)

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

  const modes = { shuffle: playlist.shuffle, repeat: playlist.repeat }

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

  async function handleExport() {
    setNote(null)
    let result
    try {
      result = await window.api.exportPlaylistM3u(playlistId)
    } catch (err) {
      result = { ok: false, error: err.message }
    }
    if (result.canceled) return
    if (!result.ok) {
      setNote({ text: result.error, error: true })
      return
    }
    setNote({
      text: `Exported ${result.count} ${result.count === 1 ? 'song' : 'songs'} to ${result.filePath}`,
      error: false
    })
  }

  function handleReorder(from, to) {
    const next = [...tracks]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setTracks(next)
    setNote(null)

    reorder(
      playlistId,
      next.map((t) => t.id)
    )
      .then((result) => {
        if (result && result.ok === false) {
          setNote({ text: result.error, error: true })
          load()
        }
      })
      .catch(() => {
        setNote({ text: 'Could not save the new order.', error: true })
        load()
      })
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <button
          style={{ ...button, opacity: tracks.length === 0 ? 0.5 : 1 }}
          disabled={tracks.length === 0}
          onClick={() => player.playList(tracks, null, modes)}
        >
          Play
        </button>
        <button
          style={playlist.shuffle ? activeButton : button}
          onClick={() => setMode(playlistId, !playlist.shuffle, playlist.repeat)}
        >
          Shuffle: {playlist.shuffle ? 'on' : 'off'}
        </button>
        <button
          style={playlist.repeat !== 'off' ? activeButton : button}
          onClick={() => setMode(playlistId, playlist.shuffle, NEXT_REPEAT[playlist.repeat])}
        >
          Repeat: {playlist.repeat}
        </button>
        <button style={button} onClick={startRename} disabled={editing}>
          Rename
        </button>
        <button
          style={{ ...button, opacity: tracks.length === 0 ? 0.5 : 1 }}
          onClick={handleExport}
          disabled={tracks.length === 0}
        >
          Export M3U
        </button>
        <button style={button} onClick={handleDelete}>
          Delete playlist
        </button>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 12, opacity: 0.6 }}>
        Shuffle and repeat are saved for this playlist and used when you press Play or click a song
        here.
        {tracks.length > 1 && ' Drag the handle on the left of a song to change the order.'}
      </p>

      {note && (
        <p
          style={{
            color: note.error ? '#ff6b6b' : undefined,
            opacity: note.error ? 1 : 0.8,
            fontSize: 13
          }}
        >
          {note.text}
        </p>
      )}

      <TrackList
        tracks={tracks}
        player={player}
        favourites={favourites}
        onRemove={(track) => removeTrack(playlistId, track.id)}
        onReorder={handleReorder}
        onPlay={(track) => player.playList(tracks, track, modes)}
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
