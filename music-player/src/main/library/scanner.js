import { readdir, stat, readFile, writeFile, mkdir, access } from 'fs/promises'
import { join, extname, basename, dirname } from 'path'
import { createHash } from 'crypto'
import { app } from 'electron'
import { getDb } from '../database/connection'

const AUDIO_EXT = new Set(['.mp3', '.flac', '.m4a', '.aac', '.wav', '.ogg', '.opus'])
const COVER_NAMES = ['cover', 'folder', 'front', 'album']
const COVER_EXT = ['.jpg', '.jpeg', '.png']
const ART_FILE = /^[a-f0-9]{40}\.(jpg|png)$/

let scanning = false
let mm = null

async function loadMusicMetadata() {
  if (!mm) mm = await import('music-metadata')
  return mm
}

function artworkDir() {
  return join(app.getPath('userData'), 'artwork')
}

// Reads ONLY files and folders under the roots the user chose.
// Symbolic links and hidden folders are skipped.
async function collectFiles(root, recursive) {
  const files = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (recursive) stack.push(full)
      } else if (entry.isFile() && AUDIO_EXT.has(extname(entry.name).toLowerCase())) {
        files.push(full)
      }
    }
  }
  return files
}

export async function saveArtwork(data, mime) {
  const hash = createHash('sha1').update(data).digest('hex')
  const file = `${hash}.${mime === 'image/png' ? 'png' : 'jpg'}`
  const target = join(artworkDir(), file)
  try {
    await access(target)
  } catch {
    await mkdir(artworkDir(), { recursive: true })
    await writeFile(target, data)
  }
  return file
}

async function findFolderCover(dir, cache) {
  if (cache.has(dir)) return cache.get(dir)
  let result = null
  try {
    const names = await readdir(dir)
    const lower = new Map(names.map((name) => [name.toLowerCase(), name]))
    for (const base of COVER_NAMES) {
      for (const ext of COVER_EXT) {
        const real = lower.get(base + ext)
        if (!real) continue
        const data = await readFile(join(dir, real))
        if (data.length > 0 && data.length < 8 * 1024 * 1024) {
          result = await saveArtwork(data, ext === '.png' ? 'image/png' : 'image/jpeg')
          break
        }
      }
      if (result) break
    }
  } catch {
    result = null
  }
  cache.set(dir, result)
  return result
}

async function readTrack(file, coverCache) {
  const { parseFile } = await loadMusicMetadata()
  let common = {}
  let format = {}
  let failed = false
  try {
    const meta = await parseFile(file, { duration: true })
    common = meta.common
    format = meta.format
  } catch {
    failed = true // keep the file, using its file name as the title
  }

  let artwork = null
  try {
    const picture = common.picture && common.picture[0]
    if (picture) artwork = await saveArtwork(picture.data, picture.format)
    else artwork = await findFolderCover(dirname(file), coverCache)
  } catch {
    artwork = null
  }

  return {
    failed,
    path: file,
    title: common.title || basename(file, extname(file)),
    artist: common.artist || null,
    album: common.album || null,
    albumArtist: common.albumartist || null,
    trackNo: common.track?.no ?? null,
    discNo: common.disk?.no ?? null,
    year: common.year ?? null,
    genre:
      Array.isArray(common.genre) && common.genre[0]
        ? String(common.genre[0]).trim() || null
        : null,
    composer:
      Array.isArray(common.composer) && common.composer.length > 0
        ? common.composer.join(', ').trim() || null
        : null,
    duration: format.duration ?? null,
    artwork
  }
}

async function scanOne(folder, summary, onProgress) {
  const db = getDb()

  // If the folder is unreachable (e.g. unplugged drive), keep its tracks untouched.
  try {
    const info = await stat(folder.path)
    if (!info.isDirectory()) throw new Error('not a folder')
  } catch {
    summary.missing += 1
    return
  }

  const files = await collectFiles(folder.path, folder.recursive)
  onProgress({ folder: folder.path, done: 0, total: files.length })

  const existing = new Map(
    db
      .prepare('SELECT path, size, mtime FROM tracks WHERE folder_id = ?')
      .all(folder.id)
      .map((row) => [row.path, row])
  )
  const upsert = db.prepare(
    `INSERT INTO tracks
       (folder_id, path, title, artist, album, album_artist, track_no, disc_no,
        year, genre, composer, duration, artwork, size, mtime, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       title = excluded.title, artist = excluded.artist, album = excluded.album,
       album_artist = excluded.album_artist, track_no = excluded.track_no,
       disc_no = excluded.disc_no, year = excluded.year, genre = excluded.genre,
       composer = excluded.composer, duration = excluded.duration,
       artwork = excluded.artwork, size = excluded.size, mtime = excluded.mtime`
  )

  const seen = new Set()
  const coverCache = new Map()
  let batch = []

  const flush = () => {
    if (batch.length === 0) return
    db.exec('BEGIN')
    try {
      for (const t of batch) {
        upsert.run(
          folder.id,
          t.path,
          t.title,
          t.artist,
          t.album,
          t.albumArtist,
          t.trackNo,
          t.discNo,
          t.year,
          t.genre,
          t.composer,
          t.duration,
          t.artwork,
          t.size,
          t.mtime,
          Date.now()
        )
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    batch = []
  }

  let done = 0
  for (const file of files) {
    done += 1
    seen.add(file)
    let info
    try {
      info = await stat(file)
    } catch {
      continue
    }
    const size = info.size
    const mtime = Math.floor(info.mtimeMs)
    const previous = existing.get(file)

    if (!previous || previous.size !== size || previous.mtime !== mtime) {
      const track = await readTrack(file, coverCache)
      if (track.failed) summary.failed += 1
      batch.push({ ...track, size, mtime })
      if (previous) summary.updated += 1
      else summary.added += 1
      if (batch.length >= 50) flush()
    }
    if (done % 10 === 0 || done === files.length) {
      onProgress({ folder: folder.path, done, total: files.length })
    }
  }
  flush()

  // remove tracks whose files are gone (or are now outside the scan, e.g. recursive turned off)
  const gone = [...existing.keys()].filter((p) => !seen.has(p))
  if (gone.length > 0) {
    const del = db.prepare('DELETE FROM tracks WHERE path = ?')
    db.exec('BEGIN')
    try {
      for (const p of gone) del.run(p)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    summary.removed += gone.length
  }
}

export async function scanFolders(folders, onProgress) {
  if (scanning) throw new Error('A scan is already running')
  scanning = true
  const summary = { added: 0, updated: 0, removed: 0, failed: 0, missing: 0 }
  try {
    for (const folder of folders) await scanOne(folder, summary, onProgress)
  } finally {
    scanning = false
  }
  return summary
}

export async function getArtworkDataUrl(file) {
  if (typeof file !== 'string' || !ART_FILE.test(file)) return null
  try {
    const data = await readFile(join(artworkDir(), file))
    const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${data.toString('base64')}`
  } catch {
    return null
  }
}
