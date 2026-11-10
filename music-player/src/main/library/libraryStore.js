import { sep, join, dirname } from 'path'
import { getDb } from '../database/connection'

const TRACK_FIELDS = `t.id, t.title, t.artist, t.album, t.track_no, t.disc_no, t.year, t.duration, t.artwork`
const ARTIST_EXPR = `COALESCE(NULLIF(t.artist, ''), 'Unknown artist')`
const ALBUM_EXPR = `COALESCE(NULLIF(t.album, ''), 'Unknown album')`
const ALBUM_ARTIST_EXPR = `COALESCE(NULLIF(t.album_artist, ''), NULLIF(t.artist, ''), '')`
const GENRE_EXPR = `COALESCE(NULLIF(t.genre, ''), 'Unknown genre')`
const COMPOSER_EXPR = `COALESCE(NULLIF(t.composer, ''), 'Unknown composer')`
const YEAR_EXPR = `CASE WHEN t.year IS NULL OR t.year = 0 THEN 'Unknown year' ELSE CAST(t.year AS TEXT) END`
const BY_ARTIST_ORDER = `t.artist COLLATE NOCASE, t.album COLLATE NOCASE, t.disc_no, t.track_no, t.title COLLATE NOCASE`

function toFolder(row) {
  return { id: row.id, path: row.path, recursive: !!row.recursive, trackCount: row.trackCount ?? 0 }
}

export function listFolders() {
  return getDb()
    .prepare(
      `SELECT f.id, f.path, f.recursive, COUNT(t.id) AS trackCount
       FROM library_folders f LEFT JOIN tracks t ON t.folder_id = f.id
       GROUP BY f.id ORDER BY f.added_at, f.id`
    )
    .all()
    .map(toFolder)
}

export function getFolder(id) {
  const row = getDb()
    .prepare('SELECT id, path, recursive FROM library_folders WHERE id = ?')
    .get(id)
  return row ? toFolder(row) : null
}

function withSep(p) {
  const lower = p.toLowerCase()
  return lower.endsWith(sep) ? lower : lower + sep
}

export function addFolder(path) {
  const wanted = withSep(path)
  for (const existing of listFolders()) {
    const other = withSep(existing.path)
    if (wanted.startsWith(other) || other.startsWith(wanted)) {
      return { ok: false, error: 'This folder overlaps with one already in your library.' }
    }
  }
  const db = getDb()
  db.prepare('INSERT INTO library_folders (path, recursive, added_at) VALUES (?, 1, ?)').run(
    path,
    Date.now()
  )
  const row = db.prepare('SELECT id, path, recursive FROM library_folders WHERE path = ?').get(path)
  return { ok: true, folder: toFolder(row) }
}

export function removeFolder(id) {
  // tracks are removed automatically (ON DELETE CASCADE); your files are never touched
  getDb().prepare('DELETE FROM library_folders WHERE id = ?').run(id)
}

export function setRecursive(id, recursive) {
  getDb()
    .prepare('UPDATE library_folders SET recursive = ? WHERE id = ?')
    .run(recursive ? 1 : 0, id)
}

const MAX_ROWS = 2000

const SORT_COLUMNS = {
  title: `title COLLATE NOCASE`,
  artist: `COALESCE(artist, '') COLLATE NOCASE`,
  album: `COALESCE(album, '') COLLATE NOCASE`,
  year: `COALESCE(year, 0)`,
  duration: `COALESCE(duration, 0)`,
  added: `added_at`
}
const DEFAULT_ORDER = `COALESCE(artist, '') COLLATE NOCASE, COALESCE(album, '') COLLATE NOCASE,
                COALESCE(disc_no, 0), COALESCE(track_no, 0), title COLLATE NOCASE`

// input: a search string, or { search, sort, dir, genre, year, favouritesOnly }
export function getTracks(input) {
  const db = getDb()
  const opts =
    typeof input === 'string' ? { search: input } : input && typeof input === 'object' ? input : {}

  const text = typeof opts.search === 'string' ? opts.search.trim().toLowerCase().slice(0, 100) : ''
  const clauses = []
  const args = []

  if (text) {
    clauses.push(
      `instr(lower(title || ' ' || COALESCE(artist, '') || ' ' || COALESCE(album, '')), ?) > 0`
    )
    args.push(text)
  }
  if (typeof opts.genre === 'string' && opts.genre) {
    clauses.push(`COALESCE(NULLIF(genre, ''), 'Unknown genre') = ?`)
    args.push(opts.genre.slice(0, 200))
  }
  if (Number.isInteger(opts.year)) {
    clauses.push(`COALESCE(year, 0) = ?`)
    args.push(opts.year)
  }
  if (opts.favouritesOnly === true) {
    clauses.push(`id IN (SELECT track_id FROM favourites)`)
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const column = Object.hasOwn(SORT_COLUMNS, opts.sort) ? SORT_COLUMNS[opts.sort] : null
  const direction = opts.dir === 'desc' ? 'DESC' : 'ASC'
  const order = column ? `${column} ${direction}, ${DEFAULT_ORDER}` : DEFAULT_ORDER

  const total = db.prepare(`SELECT COUNT(*) AS n FROM tracks ${where}`).get(...args).n
  const tracks = db
    .prepare(
      `SELECT id, title, artist, album, track_no, disc_no, year, duration, artwork
       FROM tracks ${where}
       ORDER BY ${order}
       LIMIT ${MAX_ROWS}`
    )
    .all(...args)
    .map((row) => ({ ...row }))
  return { tracks, total }
}

export function getFilterOptions() {
  const db = getDb()
  const genres = db
    .prepare(
      `SELECT ${GENRE_EXPR} AS name FROM tracks t GROUP BY name ORDER BY name COLLATE NOCASE`
    )
    .all()
    .map((row) => row.name)
  const years = db
    .prepare(
      `SELECT DISTINCT year FROM tracks WHERE year IS NOT NULL AND year > 0 ORDER BY year DESC`
    )
    .all()
    .map((row) => row.year)
  return { genres, years }
}

export function getTrackPath(id) {
  const row = getDb().prepare('SELECT path FROM tracks WHERE id = ?').get(id)
  return row ? row.path : null
}

export function getTrack(id) {
  const row = getDb()
    .prepare(
      `SELECT id, title, artist, album, track_no, disc_no, year, duration, artwork
       FROM tracks WHERE id = ?`
    )
    .get(id)
  return row ? { ...row } : null
}

export function getFavouriteIds() {
  return getDb()
    .prepare('SELECT track_id FROM favourites')
    .all()
    .map((row) => row.track_id)
}

// Returns true if the track is now a favourite, false if it was removed.
export function toggleFavourite(id) {
  const db = getDb()
  if (db.prepare('SELECT 1 FROM favourites WHERE track_id = ?').get(id)) {
    db.prepare('DELETE FROM favourites WHERE track_id = ?').run(id)
    return false
  }
  if (!db.prepare('SELECT 1 FROM tracks WHERE id = ?').get(id)) return false
  db.prepare('INSERT INTO favourites (track_id, added_at) VALUES (?, ?)').run(id, Date.now())
  return true
}

export function getFavouriteTracks() {
  return getDb()
    .prepare(
      `SELECT ${TRACK_FIELDS} FROM favourites f
       JOIN tracks t ON t.id = f.track_id
       ORDER BY f.added_at DESC`
    )
    .all()
    .map((row) => ({ ...row }))
}

export function recordPlay(id) {
  const db = getDb()
  if (!db.prepare('SELECT 1 FROM tracks WHERE id = ?').get(id)) return
  db.prepare(
    `INSERT INTO play_history (track_id, played_at, play_count) VALUES (?, ?, 1)
     ON CONFLICT(track_id) DO UPDATE SET
       played_at = excluded.played_at,
       play_count = play_history.play_count + 1`
  ).run(id, Date.now())
}

export function getRecentTracks() {
  return getDb()
    .prepare(
      `SELECT ${TRACK_FIELDS} FROM play_history h
       JOIN tracks t ON t.id = h.track_id
       ORDER BY h.played_at DESC
       LIMIT 100`
    )
    .all()
    .map((row) => ({ ...row }))
}

export function getMostPlayed() {
  return getDb()
    .prepare(
      `SELECT ${TRACK_FIELDS} FROM play_history h
       JOIN tracks t ON t.id = h.track_id
       ORDER BY h.play_count DESC, h.played_at DESC
       LIMIT 100`
    )
    .all()
    .map((row) => ({ ...row }))
}

export function getRecentlyAdded() {
  return getDb()
    .prepare(
      `SELECT ${TRACK_FIELDS} FROM tracks t
       ORDER BY t.added_at DESC, t.id DESC
       LIMIT 200`
    )
    .all()
    .map((row) => ({ ...row }))
}

export function getArtistGroups() {
  return getDb()
    .prepare(
      `SELECT ${ARTIST_EXPR} AS name, COUNT(*) AS trackCount, MIN(t.artwork) AS artwork
       FROM tracks t
       GROUP BY name
       ORDER BY name COLLATE NOCASE`
    )
    .all()
    .map((row) => ({ ...row }))
}

export function getAlbumGroups() {
  return getDb()
    .prepare(
      `SELECT ${ALBUM_EXPR} AS name, ${ALBUM_ARTIST_EXPR} AS artist,
              COUNT(*) AS trackCount, MIN(t.artwork) AS artwork
       FROM tracks t
       GROUP BY name, artist
       ORDER BY name COLLATE NOCASE`
    )
    .all()
    .map((row) => ({ ...row }))
}

export function getTracksByArtist(name) {
  return getDb()
    .prepare(
      `SELECT ${TRACK_FIELDS} FROM tracks t
       WHERE ${ARTIST_EXPR} = ?
       ORDER BY t.album COLLATE NOCASE, t.disc_no, t.track_no, t.title COLLATE NOCASE`
    )
    .all(name)
    .map((row) => ({ ...row }))
}

export function getTracksByAlbum(name, artist) {
  return getDb()
    .prepare(
      `SELECT ${TRACK_FIELDS} FROM tracks t
       WHERE ${ALBUM_EXPR} = ? AND ${ALBUM_ARTIST_EXPR} = ?
       ORDER BY t.disc_no, t.track_no, t.title COLLATE NOCASE`
    )
    .all(name, artist)
    .map((row) => ({ ...row }))
}

export function getGenreGroups() {
  return getDb()
    .prepare(
      `SELECT ${GENRE_EXPR} AS name, COUNT(*) AS trackCount, MIN(t.artwork) AS artwork
       FROM tracks t
       GROUP BY name
       ORDER BY name COLLATE NOCASE`
    )
    .all()
    .map((row) => ({ ...row }))
}

export function getTracksByGenre(name) {
  return getDb()
    .prepare(
      `SELECT ${TRACK_FIELDS} FROM tracks t
       WHERE ${GENRE_EXPR} = ?
       ORDER BY ${BY_ARTIST_ORDER}`
    )
    .all(name)
    .map((row) => ({ ...row }))
}

export function getYearGroups() {
  return getDb()
    .prepare(
      `SELECT ${YEAR_EXPR} AS name, COUNT(*) AS trackCount, MIN(t.artwork) AS artwork
       FROM tracks t
       GROUP BY name
       ORDER BY (${YEAR_EXPR} = 'Unknown year'), ${YEAR_EXPR} DESC`
    )
    .all()
    .map((row) => ({ ...row }))
}

export function getTracksByYear(name) {
  return getDb()
    .prepare(
      `SELECT ${TRACK_FIELDS} FROM tracks t
       WHERE ${YEAR_EXPR} = ?
       ORDER BY ${BY_ARTIST_ORDER}`
    )
    .all(name)
    .map((row) => ({ ...row }))
}

export function getComposerGroups() {
  return getDb()
    .prepare(
      `SELECT ${COMPOSER_EXPR} AS name, COUNT(*) AS trackCount, MIN(t.artwork) AS artwork
       FROM tracks t
       GROUP BY name
       ORDER BY name COLLATE NOCASE`
    )
    .all()
    .map((row) => ({ ...row }))
}

export function getTracksByComposer(name) {
  return getDb()
    .prepare(
      `SELECT ${TRACK_FIELDS} FROM tracks t
       WHERE ${COMPOSER_EXPR} = ?
       ORDER BY ${BY_ARTIST_ORDER}`
    )
    .all(name)
    .map((row) => ({ ...row }))
}

// Browse by Folder. This only looks at the song list in the database; it never reads the disk.
// dirPath = null shows the library folders; otherwise a folder inside one of them.
export function browseFolder(dirPath) {
  const roots = listFolders()

  if (dirPath === null) {
    return {
      atTop: true,
      path: null,
      parent: null,
      folders: roots.map((f) => ({ name: f.path, path: f.path, trackCount: f.trackCount })),
      tracks: []
    }
  }

  const dirKey = withSep(dirPath)
  const root = roots.find((f) => dirKey.startsWith(withSep(f.path)))
  if (!root) return browseFolder(null)

  const rows = getDb()
    .prepare(`SELECT ${TRACK_FIELDS}, t.path AS file FROM tracks t WHERE t.folder_id = ?`)
    .all(root.id)

  const subfolders = new Map()
  const tracks = []
  for (const row of rows) {
    if (!row.file.toLowerCase().startsWith(dirKey)) continue
    const rest = row.file.slice(dirKey.length)
    const cut = rest.indexOf(sep)
    const { file, ...track } = row
    if (cut === -1) {
      tracks.push(track)
    } else {
      const name = rest.slice(0, cut)
      const key = name.toLowerCase()
      const entry = subfolders.get(key)
      if (entry) entry.trackCount += 1
      else subfolders.set(key, { name, path: join(dirPath, name), trackCount: 1 })
    }
  }

  tracks.sort(
    (a, b) =>
      (a.disc_no ?? 0) - (b.disc_no ?? 0) ||
      (a.track_no ?? 0) - (b.track_no ?? 0) ||
      a.title.localeCompare(b.title)
  )

  return {
    atTop: false,
    path: dirPath,
    parent: dirKey === withSep(root.path) ? null : dirname(dirPath),
    folders: [...subfolders.values()].sort((a, b) => a.name.localeCompare(b.name)),
    tracks
  }
}
