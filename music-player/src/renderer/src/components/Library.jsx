import { useCallback, useEffect, useRef, useState } from 'react'
import TrackList from './TrackList'
import Banner from './Banner'

const SORT_OPTIONS = [
  ['default', 'Artist / album (default)'],
  ['title', 'Title'],
  ['artist', 'Artist'],
  ['album', 'Album'],
  ['year', 'Year'],
  ['duration', 'Duration'],
  ['added', 'Date added']
]

const BANNER_QUERY = {
  search: '',
  sort: 'default',
  dir: 'asc',
  genre: '',
  year: null,
  favouritesOnly: false
}

function pickBanner(tracks) {
  const seen = new Set()
  const withArt = []
  for (const t of tracks) {
    if (t.artwork && !seen.has(t.artwork)) {
      seen.add(t.artwork)
      withArt.push(t)
    }
  }
  for (let i = withArt.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[withArt[i], withArt[j]] = [withArt[j], withArt[i]]
  }
  return withArt.slice(0, 8)
}

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
  const [banner, setBanner] = useState({ items: [], pool: [] })

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

  const loadBanner = useCallback(async () => {
    const result = await window.api.getTracks(BANNER_QUERY)
    setBanner({ items: pickBanner(result.tracks), pool: result.tracks })
  }, [])

  useEffect(() => {
    loadFolders()
    loadOptions()
    loadBanner()
  }, [loadFolders, loadOptions, loadBanner, refreshKey])

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
  const showBanner = !search && !filtersActive && banner.items.length >= 2

  function clearFilters() {
    setSort('default')
    setDir('asc')
    setGenre('')
    setYear('')
    setOnlyFavourites(false)
  }

  return (
    <div className="page-scroll">
      <h2 className="page-heading">Songs</h2>

      {folders.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ opacity: 0.7, fontSize: 13, margin: '0 0 10px' }}>
            No folders yet. Add a music folder to build your library.
          </p>
          <button className="glass-btn" onClick={onOpenFolders}>
            Go to Music Folder
          </button>
        </div>
      )}

      {showBanner && <Banner items={banner.items} pool={banner.pool} player={player} />}

      <input
        type="search"
        className="search-box"
        placeholder="Search title, artist or album"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-row">
        <label style={{ opacity: 0.7 }}>Sort</label>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          className="glass-btn"
          style={{ opacity: sort === 'default' ? 0.5 : 1 }}
          disabled={sort === 'default'}
          onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}
          title="Switch between ascending and descending"
        >
          {dir === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
        </button>

        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">All genres</option>
          {options.genres.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All years</option>
          {options.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={onlyFavourites}
            onChange={(e) => setOnlyFavourites(e.target.checked)}
          />
          Favourites only
        </label>

        {filtersActive && (
          <button className="glass-btn" onClick={clearFilters}>
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
