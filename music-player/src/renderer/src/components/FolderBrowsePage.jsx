import { useCallback, useEffect, useState } from 'react'
import TrackList from './TrackList'
import AddAllToPlaylist from './AddAllToPlaylist'

const button = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function FolderIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      opacity="0.6"
      aria-hidden="true"
    >
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
    </svg>
  )
}

function FolderBrowsePage({ player, favourites }) {
  const [current, setCurrent] = useState(null) // null = the list of library folders
  const [data, setData] = useState(null)

  const load = useCallback(async (path) => {
    setData(await window.api.browseFolder(path))
  }, [])

  useEffect(() => {
    load(current)
  }, [load, current])

  useEffect(() => window.api.onLibraryChanged(() => load(current)), [load, current])

  if (!data) return null

  const title = data.atTop
    ? 'Browse Folders'
    : data.path.split(/[\\/]/).filter(Boolean).pop() || data.path

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {!data.atTop && (
        <button style={{ ...button, marginBottom: 12 }} onClick={() => setCurrent(data.parent)}>
          ← Back
        </button>
      )}

      <h2 style={{ margin: '0 0 4px' }}>{title}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7, ...ellipsis }}>
        {data.atTop ? 'The folders in your library' : data.path}
      </p>

      {data.tracks.length > 0 && (
        <div style={{ margin: '0 0 16px' }}>
          <AddAllToPlaylist tracks={data.tracks} />
        </div>
      )}

      {data.folders.map((folder) => (
        <div
          key={folder.path}
          onClick={() => setCurrent(folder.path)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 8px',
            margin: '0 -8px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          <FolderIcon />
          <div style={{ flex: 1, minWidth: 0, ...ellipsis }} title={folder.path}>
            {folder.name}
          </div>
          <div style={{ opacity: 0.6 }}>
            {folder.trackCount} {folder.trackCount === 1 ? 'song' : 'songs'}
          </div>
        </div>
      ))}

      {data.tracks.length > 0 && (
        <div style={{ marginTop: data.folders.length > 0 ? 12 : 0 }}>
          <TrackList tracks={data.tracks} player={player} favourites={favourites} />
        </div>
      )}

      {data.atTop && data.folders.length === 0 && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>Nothing here yet. Add a music folder first.</p>
      )}
      {!data.atTop && data.folders.length === 0 && data.tracks.length === 0 && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>This folder has no songs.</p>
      )}
    </div>
  )
}

export default FolderBrowsePage
