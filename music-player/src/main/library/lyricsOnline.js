import { writeFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import { getTrack, getTrackPath } from './libraryStore'

const BASE = 'https://lrclib.net/api'
const HEADERS = { 'User-Agent': 'PersonalMusicPlayer/1.0 (offline desktop player)' }
const MAX_BYTES = 200 * 1024
const DEVANAGARI = /[\u0900-\u097F]/g

async function getJson(url) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`The lyrics service answered ${response.status}.`)
  return response.json()
}

// true when the lyrics are written in Roman letters (Hinglish / English)
function isRoman(text) {
  const letters = text.replace(/[^\p{L}]/gu, '')
  if (!letters) return true
  const devanagari = (letters.match(DEVANAGARI) || []).length
  return devanagari / letters.length < 0.1
}

async function findLyrics(track) {
  const title = track.title
  const fullArtist = track.artist || ''
  const firstArtist = fullArtist.split(/,|&| feat\.? /i)[0].trim()
  const duration = Math.round(track.duration || 0)

  const candidates = []
  let plainSeen = false
  const add = (item) => {
    if (!item) return
    if (item.plainLyrics) plainSeen = true
    const close = !duration || !item.duration || Math.abs(item.duration - duration) <= 3
    if (item.syncedLyrics && close) candidates.push(item.syncedLyrics)
  }

  // exact matches
  for (const artist of [fullArtist, firstArtist]) {
    if (!artist) continue
    const params = new URLSearchParams({ track_name: title, artist_name: artist })
    if (track.album) params.set('album_name', track.album)
    if (duration) params.set('duration', String(duration))
    add(await getJson(`${BASE}/get?${params}`))
  }

  // wider searches: other uploads of the same song
  const queries = [{ track_name: title }]
  if (firstArtist) queries.unshift({ track_name: title, artist_name: firstArtist })
  for (const query of queries) {
    const list = await getJson(`${BASE}/search?${new URLSearchParams(query)}`)
    if (Array.isArray(list)) list.forEach(add)
  }

  const roman = candidates.find(isRoman)
  if (roman) return { synced: roman }
  if (candidates.length > 0) return { synced: candidates[0] }
  if (plainSeen) return { plainOnly: true }
  return null
}

export async function fetchOnlineLyrics(id) {
  const path = getTrackPath(id)
  const track = getTrack(id)
  if (!path || !track) return { ok: false, error: 'That song is no longer in the library.' }

  try {
    const found = await findLyrics(track)
    if (!found) return { ok: false, error: 'No lyrics were found online for this song.' }
    if (found.plainOnly) {
      return {
        ok: false,
        error: 'Only lyrics without timestamps exist online, so none were saved.'
      }
    }
    if (Buffer.byteLength(found.synced) > MAX_BYTES) {
      return { ok: false, error: 'The lyrics file was unexpectedly large and was not saved.' }
    }

    const target = join(dirname(path), basename(path, extname(path)) + '.lrc')
    try {
      await writeFile(target, found.synced, { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      if (error.code === 'EEXIST') {
        return {
          ok: false,
          error: 'A .lrc file with this name already exists, so it was not replaced.'
        }
      }
      throw error
    }
    return { ok: true }
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'TypeError') {
      return {
        ok: false,
        error: 'Could not reach the lyrics service. Check your internet connection.'
      }
    }
    return { ok: false, error: error.message }
  }
}
