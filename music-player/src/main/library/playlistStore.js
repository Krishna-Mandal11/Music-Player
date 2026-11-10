import { getDb } from '../database/connection'

const TRACK_FIELDS = `t.id, t.title, t.artist, t.album, t.track_no, t.disc_no, t.year, t.duration, t.artwork`
const MAX_NAME_LENGTH = 100

function cleanName(name) {
  if (typeof name !== 'string') return ''
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH)
}

function nameTaken(name, exceptId) {
  const row = getDb()
    .prepare('SELECT 1 AS found FROM playlists WHERE lower(name) = lower(?) AND id != ?')
    .get(name, exceptId)
  return !!row
}

function inTransaction(work) {
  const db = getDb()
  db.exec('BEGIN')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function listPlaylists() {
  return getDb()
    .prepare(
      `SELECT p.id, p.name, COUNT(pt.track_id) AS trackCount
       FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
       GROUP BY p.id
       ORDER BY p.name COLLATE NOCASE`
    )
    .all()
    .map((row) => ({ ...row }))
}

export function createPlaylist(rawName) {
  const name = cleanName(rawName)
  if (!name) return { ok: false, error: 'Please enter a name.' }
  if (nameTaken(name, -1)) return { ok: false, error: 'A playlist with that name already exists.' }

  const now = Date.now()
  const info = getDb()
    .prepare('INSERT INTO playlists (name, created_at, updated_at) VALUES (?, ?, ?)')
    .run(name, now, now)
  return { ok: true, playlist: { id: Number(info.lastInsertRowid), name, trackCount: 0 } }
}

export function renamePlaylist(id, rawName) {
  const name = cleanName(rawName)
  if (!name) return { ok: false, error: 'Please enter a name.' }
  const db = getDb()
  if (!db.prepare('SELECT 1 FROM playlists WHERE id = ?').get(id)) {
    return { ok: false, error: 'That playlist no longer exists.' }
  }
  if (nameTaken(name, id)) return { ok: false, error: 'A playlist with that name already exists.' }

  db.prepare('UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id)
  return { ok: true, name }
}

export function deletePlaylist(id) {
  // The songs inside are removed from the playlist automatically; your music files are untouched.
  getDb().prepare('DELETE FROM playlists WHERE id = ?').run(id)
}

export function getPlaylistTracks(id) {
  return getDb()
    .prepare(
      `SELECT ${TRACK_FIELDS} FROM playlist_tracks pt
       JOIN tracks t ON t.id = pt.track_id
       WHERE pt.playlist_id = ?
       ORDER BY pt.position`
    )
    .all(id)
    .map((row) => ({ ...row }))
}

export function addTracksToPlaylist(playlistId, trackIds) {
  const db = getDb()
  if (!db.prepare('SELECT 1 FROM playlists WHERE id = ?').get(playlistId)) {
    return { ok: false, error: 'That playlist no longer exists.' }
  }

  const unique = [...new Set(trackIds)]
  let added = 0

  inTransaction(() => {
    const lastRow = db
      .prepare(
        'SELECT COALESCE(MAX(position), 0) AS last FROM playlist_tracks WHERE playlist_id = ?'
      )
      .get(playlistId)
    let position = lastRow.last

    const trackExists = db.prepare('SELECT 1 FROM tracks WHERE id = ?')
    const insert = db.prepare(
      `INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at)
       VALUES (?, ?, ?, ?)`
    )

    for (const trackId of unique) {
      if (!trackExists.get(trackId)) continue
      const info = insert.run(playlistId, trackId, position + 1, Date.now())
      if (info.changes > 0) {
        position += 1
        added += 1
      }
    }

    db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), playlistId)
  })

  return { ok: true, added }
}

export function removeTrackFromPlaylist(playlistId, trackId) {
  getDb()
    .prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
    .run(playlistId, trackId)
}
