import { useEffect, useState } from 'react'
import ArtThumb from './ArtThumb'
import TrackList from './TrackList'

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const backButton = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13,
  marginBottom: 12
}

const CONFIG = {
  artists: {
    title: 'Artists',
    loadGroups: () => window.api.getArtistGroups(),
    loadTracks: (g) => window.api.getTracksByArtist(g.name)
  },
  albums: {
    title: 'Albums',
    loadGroups: () => window.api.getAlbumGroups(),
    loadTracks: (g) => window.api.getTracksByAlbum(g.name, g.artist)
  },
  genres: {
    title: 'Genres',
    loadGroups: () => window.api.getGenreGroups(),
    loadTracks: (g) => window.api.getTracksByGenre(g.name)
  }
}

function BrowsePage({ kind, player, favourites }) {
  const config = CONFIG[kind]
  const isAlbums = kind === 'albums'
  const [groups, setGroups] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState(null)
  const [tracks, setTracks] = useState([])

  useEffect(() => {
    let alive = true
    config.loadGroups().then((list) => {
      if (!alive) return
      setGroups(list)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [config])

  useEffect(() => {
    if (!selected) return
    let alive = true
    config.loadTracks(selected).then((list) => {
      if (alive) setTracks(list)
    })
    return () => {
      alive = false
    }
  }, [selected, config])

  if (selected) {
    return (
      <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
        <button
          style={backButton}
          onClick={() => {
            setSelected(null)
            setTracks([])
          }}
        >
          ← Back to {config.title}
        </button>
        <h2 style={{ margin: '0 0 4px' }}>{selected.name}</h2>
        {isAlbums && selected.artist && (
          <div style={{ fontSize: 13, opacity: 0.7 }}>{selected.artist}</div>
        )}
        <div style={{ height: 16 }} />
        <TrackList tracks={tracks} player={player} favourites={favourites} />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 16px' }}>{config.title}</h2>
      {loaded && groups.length === 0 && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>Nothing here yet. Add a music folder first.</p>
      )}
      {groups.map((group) => (
        <div
          key={`${group.name}|${group.artist || ''}`}
          onClick={() => setSelected(group)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '6px 8px',
            margin: '0 -8px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          <ArtThumb file={group.artwork} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={ellipsis}>{group.name}</div>
            {isAlbums && group.artist && (
              <div style={{ ...ellipsis, opacity: 0.6 }}>{group.artist}</div>
            )}
          </div>
          <div style={{ opacity: 0.6 }}>
            {group.trackCount} {group.trackCount === 1 ? 'song' : 'songs'}
          </div>
        </div>
      ))}
    </div>
  )
}

export default BrowsePage
