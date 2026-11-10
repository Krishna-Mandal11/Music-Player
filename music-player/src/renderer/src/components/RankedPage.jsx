import { useEffect, useState } from 'react'
import TrackList from './TrackList'

const CONFIG = {
  added: {
    title: 'Recently Added',
    note: 'The 200 songs most recently added to your library, newest first.',
    empty: 'Nothing here yet. Add a music folder first.',
    load: () => window.api.getRecentlyAdded()
  },
  played: {
    title: 'Most Played',
    note: 'Your 100 most played songs, most played first.',
    empty: 'Play some songs and they will show up here.',
    load: () => window.api.getMostPlayed()
  }
}

function RankedPage({ kind, player, favourites }) {
  const config = CONFIG[kind]
  const [tracks, setTracks] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () =>
      config.load().then((list) => {
        if (!alive) return
        setTracks(list)
        setLoaded(true)
      })
    load()
    const stop = window.api.onLibraryChanged(load)
    return () => {
      alive = false
      stop()
    }
  }, [config])

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 4px' }}>{config.title}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7 }}>{config.note}</p>
      <TrackList tracks={tracks} player={player} favourites={favourites} />
      {loaded && tracks.length === 0 && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>{config.empty}</p>
      )}
    </div>
  )
}

export default RankedPage
