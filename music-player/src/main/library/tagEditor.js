import { copyFile, mkdir, readFile, readdir, stat, unlink } from 'fs/promises'
import { basename, extname, join } from 'path'
import { randomUUID } from 'crypto'
import { app, dialog } from 'electron'
import { getDb } from '../database/connection'
import { getTrackPath } from './libraryStore'
import { saveArtwork } from './scanner'

const MAX_ART_BYTES = 8 * 1024 * 1024
const BACKUP_KEEP = 50
const TEXT_FIELDS = ['title', 'artist', 'album', 'albumArtist', 'genre', 'composer']
const NUMBER_FIELDS = ['year', 'trackNo', 'discNo']

let taglib = null
let mm = null
let busy = false
const pending = new Map() // one-time token -> { data, mime } for a chosen cover image

async function loadTaglib() {
  if (!taglib) {
    const mod = await import('node-taglib-sharp')
    taglib = mod.File ? mod : mod.default
  }
  return taglib
}

async function loadMusicMetadata() {
  if (!mm) mm = await import('music-metadata')
  return mm
}

async function openFile(path) {
  const { File } = await loadTaglib()
  return File.createFromPath(path)
}

function readFields(file) {
  const tag = file.tag
  return {
    title: tag.title || '',
    artist: (tag.performers || []).join(', '),
    album: tag.album || '',
    albumArtist: (tag.albumArtists || []).join(', '),
    genre: (tag.genres || []).join(', '),
    genreFirst: (tag.genres || [])[0] || '',
    composer: (tag.composers || []).join(', '),
    year: tag.year || 0,
    trackNo: tag.track || 0,
    discNo: tag.disc || 0
  }
}

function cleanText(value, max = 300) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function cleanNumber(value) {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : null
}

function sniffMime(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (buf.length > 8 && buf.subarray(0, 8).equals(png)) return 'image/png'
  return null
}

export async function getTagInfo(id) {
  const path = getTrackPath(id)
  if (!path) return { ok: false, error: 'That song is no longer in the library.' }
  let file
  try {
    file = await openFile(path)
    return {
      ok: true,
      fileName: basename(path),
      fields: readFields(file),
      hasArtwork: file.tag.pictures.length > 0
    }
  } catch (error) {
    console.error('Tag read failed:', error)
    return { ok: false, error: "This file's tags could not be read." }
  } finally {
    if (file) file.dispose()
  }
}

export async function pickArtwork(win) {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose a cover image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }]
  })
  if (result.canceled || !result.filePaths[0]) return { canceled: true }
  try {
    const info = await stat(result.filePaths[0])
    if (info.size > MAX_ART_BYTES) return { ok: false, error: 'That image is larger than 8 MB.' }
    const data = await readFile(result.filePaths[0])
    const mime = sniffMime(data)
    if (!mime) return { ok: false, error: 'Please choose a JPEG or PNG image.' }

    const token = randomUUID()
    pending.set(token, { data, mime })
    if (pending.size > 5) pending.delete(pending.keys().next().value)
    return { ok: true, token, preview: `data:${mime};base64,${data.toString('base64')}` }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

async function makeBackup(id, path) {
  const dir = join(app.getPath('userData'), 'tag-backups')
  await mkdir(dir, { recursive: true })
  const backup = join(dir, `${id}-${Date.now()}${extname(path)}`)
  await copyFile(path, backup)

  try {
    const names = await readdir(dir)
    const items = []
    for (const name of names) {
      const info = await stat(join(dir, name))
      items.push({ name, time: info.mtimeMs })
    }
    items.sort((a, b) => b.time - a.time)
    for (const old of items.slice(BACKUP_KEEP)) await unlink(join(dir, old.name))
  } catch {
    // cleaning old backups is optional
  }
  return backup
}

function applyFields(tag, changed, wanted) {
  if (changed.title) tag.title = wanted.title
  if (changed.album) tag.album = wanted.album || undefined
  if (changed.artist) tag.performers = wanted.artist ? [wanted.artist] : []
  if (changed.albumArtist) tag.albumArtists = wanted.albumArtist ? [wanted.albumArtist] : []
  if (changed.genre) tag.genres = wanted.genre ? [wanted.genre] : []
  if (changed.composer) tag.composers = wanted.composer ? [wanted.composer] : []
  if (changed.year) tag.year = wanted.year
  if (changed.trackNo) tag.track = wanted.trackNo
  if (changed.discNo) tag.disc = wanted.discNo
}

async function doSave(payload) {
  const id = payload.id
  const path = getTrackPath(id)
  if (!path) return { ok: false, error: 'That song is no longer in the library.' }

  const input = payload.fields && typeof payload.fields === 'object' ? payload.fields : {}
  const wanted = {}
  for (const key of TEXT_FIELDS) wanted[key] = cleanText(input[key])
  for (const key of NUMBER_FIELDS) wanted[key] = cleanNumber(input[key])
  if (NUMBER_FIELDS.some((key) => wanted[key] === null)) {
    return { ok: false, error: 'Year, track and disc must be whole numbers from 0 to 9999.' }
  }
  if (!wanted.title) return { ok: false, error: 'The title cannot be empty.' }

  const art = payload.artwork && typeof payload.artwork === 'object' ? payload.artwork : {}
  const action = ['replace', 'remove'].includes(art.action) ? art.action : 'keep'
  let newArt = null
  if (action === 'replace') {
    newArt = pending.get(art.token)
    if (!newArt) return { ok: false, error: 'The chosen image expired. Please choose it again.' }
  }

  // 1. Work out what actually changed (untouched fields are never rewritten)
  let current
  const reader = await openFile(path)
  try {
    current = readFields(reader)
  } finally {
    reader.dispose()
  }
  const changed = {}
  for (const key of TEXT_FIELDS) changed[key] = cleanText(current[key]) !== wanted[key]
  for (const key of NUMBER_FIELDS) changed[key] = current[key] !== wanted[key]
  if (!Object.values(changed).some(Boolean) && action === 'keep') {
    return { ok: true, unchanged: true }
  }

  const row = getDb().prepare('SELECT duration, artwork FROM tracks WHERE id = ?').get(id)

  // 2. Backup, then write
  const backup = await makeBackup(id, path)
  try {
    let file
    try {
      file = await openFile(path)
      applyFields(file.tag, changed, wanted)
      if (newArt) {
        const { Picture, ByteVector, PictureType } = await loadTaglib()
        const picture = Picture.fromData(ByteVector.fromByteArray(newArt.data))
        if (PictureType) picture.type = PictureType.FrontCover
        file.tag.pictures = [picture]
      } else if (action === 'remove') {
        file.tag.pictures = []
      }
      file.save()
    } finally {
      if (file) file.dispose()
    }

    // 3. Verify the changes are in the file
    const check = await openFile(path)
    let after
    let pictureCount
    try {
      after = readFields(check)
      pictureCount = check.tag.pictures.length
    } finally {
      check.dispose()
    }
    for (const key of TEXT_FIELDS) {
      if (changed[key] && cleanText(after[key]) !== wanted[key])
        throw new Error(`${key} was not saved`)
    }
    for (const key of NUMBER_FIELDS) {
      if (changed[key] && after[key] !== wanted[key]) throw new Error(`${key} was not saved`)
    }
    if (action === 'replace' && pictureCount === 0) throw new Error('the cover was not saved')
    if (action === 'remove' && pictureCount !== 0) throw new Error('the cover was not removed')

    // 4. Verify the file still parses with the same length
    const { parseFile } = await loadMusicMetadata()
    const meta = await parseFile(path, { duration: true, skipCovers: true })
    const length = meta.format.duration
    if (!Number.isFinite(length)) throw new Error('the file can no longer be read')
    if (row && row.duration && Math.abs(length - row.duration) > 2) {
      throw new Error('the song length changed')
    }

    // 5. Update the library
    let artwork = row ? row.artwork : null
    if (newArt) artwork = await saveArtwork(newArt.data, newArt.mime)
    else if (action === 'remove') artwork = null

    const info = await stat(path)
    getDb()
      .prepare(
        `UPDATE tracks SET title = ?, artist = ?, album = ?, album_artist = ?, track_no = ?,
           disc_no = ?, year = ?, genre = ?, composer = ?, artwork = ?, size = ?, mtime = ?
         WHERE id = ?`
      )
      .run(
        after.title || basename(path, extname(path)),
        after.artist || null,
        after.album || null,
        after.albumArtist || null,
        after.trackNo || null,
        after.discNo || null,
        after.year || null,
        after.genreFirst || null,
        after.composer || null,
        artwork,
        info.size,
        Math.floor(info.mtimeMs),
        id
      )

    if (art.token) pending.delete(art.token)
    return { ok: true }
  } catch (error) {
    console.error('Tag save failed, restoring the backup:', error)
    try {
      await copyFile(backup, path)
    } catch (restoreError) {
      console.error('Could not restore the backup:', restoreError)
      return {
        ok: false,
        error: `Saving failed (${error.message}) and the original could not be restored automatically. A backup is in the tag-backups folder.`
      }
    }
    return {
      ok: false,
      error: `Saving failed (${error.message}). Your original file was restored.`
    }
  }
}

export async function saveTags(payload) {
  if (busy) return { ok: false, error: 'Another save is still in progress.' }
  busy = true
  try {
    return await doSave(payload)
  } catch (error) {
    console.error('Tag save error:', error)
    return { ok: false, error: error.message }
  } finally {
    busy = false
  }
}
