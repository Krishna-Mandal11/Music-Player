import { useCallback, useEffect, useRef, useState } from 'react'
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

const field = {
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: '#1f1f27',
  color: 'inherit',
  fontSize: 13,
  colorScheme: 'dark'
}

const SORT_OPTIONS = [
  ['default', 'Artist / album (default)'],
  ['title', 'Title'],
  ['artist', 'Artist'],
  ['album', 'Album'],
  ['year', 'Year'],
  ['duration', 'Duration'],
  ['added', 'Date added']
]

function Library({ player, favourites, refreshKey, onOpenFolders }) {
  const [folders, setFolders] = useState([])
  const [tracks, setTracks] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('default')
  const [dir, setDir] = useState('asc')
  const [genre, setGenre] = useState('')
  const [year, setYear] = useState('')
  const [onlyFavourites, setOnlyFavourites] = useState(false)
  const [options, setOptions] = useState({ genres: [], years: [] })

  const query = {
    search,
    sort,
    dir,
    genre,
    year: year === '' ? null : Number(year),
    favouritesOnly: onlyFavourites
  }
  const queryRef = useRef(query)
  queryRef.current = query

  // When viewing favourites only, reload as hearts are toggled
  const favouriteTick = onlyFavourites ? favourites.ids.size : -1

  const loadFolders = useCallback(async () => {
    setFolders(await window.api.getLibraryFolders())
  }, [])

  const loadOptions = useCallback(async () => {
    setOptions(await window.api.getFilterOptions())
  }, [])

  const loadTracks = useCallback(async (q) => {
    const result = await window.api.getTracks(q)
    setTracks(result.tracks)
    setTotal(result.total)
  }, [])

  useEffect(() => {
    loadFolders()
    loadOptions()
  }, [loadFolders, loadOptions, refreshKey])

  useEffect(() => {
    const timer = setTimeout(() => loadTracks(queryRef.current), 200)
    return () => clearTimeout(timer)
  }, [search, sort, dir, genre, year, onlyFavourites, favouriteTick, loadTracks, refreshKey])

  useEffect(
    () =>
      window.api.onLibraryChanged(() => {
        loadFolders()
        loadOptions()
        loadTracks(queryRef.current)
      }),
    [loadFolders, loadOptions, loadTracks]
  )

  const filtersActive = genre !== '' || year !== '' || onlyFavourites || sort !== 'default'

  function clearFilters() {
    setSort('default')
    setDir('asc')
    setGenre('')
    setYear('')
    setOnlyFavourites(false)
  }

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

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          fontSize: 13
        }}
      >
        <label style={{ opacity: 0.7 }}>Sort</label>
        <select style={field} value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          style={{ ...button, opacity: sort === 'default' ? 0.5 : 1 }}
          disabled={sort === 'default'}
          onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}
          title="Switch between ascending and descending"
        >
          {dir === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
        </button>

        <select style={field} value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">All genres</option>
          {options.genres.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select style={field} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All years</option>
          {options.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={onlyFavourites}
            onChange={(e) => setOnlyFavourites(e.target.checked)}
          />
          Favourites only
        </label>

        {filtersActive && (
          <button style={button} onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <TrackList tracks={tracks} player={player} favourites={favourites} />

      {total > tracks.length && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          Showing the first {tracks.length} of {total} tracks. Use search or filters to narrow it
          down.
        </p>
      )}
      {total === 0 && folders.length > 0 && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          {search || filtersActive ? 'No songs match your search or filters.' : 'No tracks found.'}
        </p>
      )}
    </div>
  )
}

export default Library
