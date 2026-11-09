import { useEffect, useState } from 'react'
import TrackList from './TrackList'

function CollectionPage({ kind, player, favourites }) {
  const isFavourites = kind === 'favourites'
  const [tracks, setTracks] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    const load = isFavourites ? window.api.getFavouriteTracks : window.api.getRecentTracks
    load().then((list) => {
      if (!alive) return
      setTracks(list)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [isFavourites, favourites.ids])

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 16px' }}>{isFavourites ? 'Favourites' : 'Recently Played'}</h2>
      {loaded && tracks.length === 0 && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          {isFavourites
            ? 'No favourites yet. Click the heart on a song to add it.'
            : 'Nothing played yet. Songs you play will show up here.'}
        </p>
      )}
      <TrackList tracks={tracks} player={player} favourites={favourites} />
    </div>
  )
}

export default CollectionPage
