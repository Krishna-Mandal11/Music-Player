import { sep } from 'path'
import { getDb } from '../database/connection'

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

export function getTracks(search) {
  const db = getDb()
  const text = typeof search === 'string' ? search.trim().toLowerCase().slice(0, 100) : ''
  const where = text
    ? `WHERE instr(lower(title || ' ' || COALESCE(artist, '') || ' ' || COALESCE(album, '')), ?) > 0`
    : ''
  const args = text ? [text] : []
  const total = db.prepare(`SELECT COUNT(*) AS n FROM tracks ${where}`).get(...args).n
  const tracks = db
    .prepare(
      `SELECT id, title, artist, album, track_no, disc_no, year, duration, artwork
       FROM tracks ${where}
       ORDER BY COALESCE(artist, '') COLLATE NOCASE, COALESCE(album, '') COLLATE NOCASE,
                COALESCE(disc_no, 0), COALESCE(track_no, 0), title COLLATE NOCASE
       LIMIT ${MAX_ROWS}`
    )
    .all(...args)
    .map((row) => ({ ...row }))
  return { tracks, total }
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

const TRACK_FIELDS = `t.id, t.title, t.artist, t.album, t.track_no, t.disc_no, t.year, t.duration, t.artwork`

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
    `INSERT INTO play_history (track_id, played_at) VALUES (?, ?)
     ON CONFLICT(track_id) DO UPDATE SET played_at = excluded.played_at`
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
const ARTIST_EXPR = `COALESCE(NULLIF(t.artist, ''), 'Unknown artist')`
const ALBUM_EXPR = `COALESCE(NULLIF(t.album, ''), 'Unknown album')`
const ALBUM_ARTIST_EXPR = `COALESCE(NULLIF(t.album_artist, ''), NULLIF(t.artist, ''), '')`

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
const GENRE_EXPR = `COALESCE(NULLIF(t.genre, ''), 'Unknown genre')`

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
       ORDER BY t.artist COLLATE NOCASE, t.album COLLATE NOCASE, t.disc_no, t.track_no,
                t.title COLLATE NOCASE`
    )
    .all(name)
    .map((row) => ({ ...row }))
}
