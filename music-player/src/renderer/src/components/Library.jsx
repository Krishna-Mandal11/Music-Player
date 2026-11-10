import { useCallback, useEffect, useState } from 'react'
import TrackList from './TrackList'

const button = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13
}

function Library({ player, favourites, refreshKey, onOpenFolders }) {
  const [folders, setFolders] = useState([])
  const [tracks, setTracks] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  const loadFolders = useCallback(async () => {
    setFolders(await window.api.getLibraryFolders())
  }, [])

  const loadTracks = useCallback(async (text) => {
    const result = await window.api.getTracks(text)
    setTracks(result.tracks)
    setTotal(result.total)
  }, [])

  useEffect(() => {
    loadFolders()
  }, [loadFolders, refreshKey])

  useEffect(() => {
    const timer = setTimeout(() => loadTracks(search), 200)
    return () => clearTimeout(timer)
  }, [search, loadTracks, refreshKey])

  useEffect(
    () =>
      window.api.onLibraryChanged(() => {
        loadFolders()
        loadTracks(search)
      }),
    [search, loadFolders, loadTracks]
  )

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 16px' }}>Songs</h2>

      {folders.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ opacity: 0.7, fontSize: 13, margin: '0 0 10px' }}>
            No folders yet. Add a music folder to build your library.
          </p>
          <button style={button} onClick={onOpenFolders}>
            Go to Music Folder
          </button>
        </div>
      )}

      <input
        type="search"
        placeholder="Search title, artist or album"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 12px',
          marginBottom: 12,
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.06)',
          color: 'inherit'
        }}
      />

      <TrackList tracks={tracks} player={player} favourites={favourites} />

      {total > tracks.length && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          Showing the first {tracks.length} of {total} tracks. Use search to narrow it down.
        </p>
      )}
      {total === 0 && folders.length > 0 && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>No tracks found.</p>
      )}
    </div>
  )
}

export default Library
