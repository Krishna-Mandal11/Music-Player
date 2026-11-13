import { copyFile, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { basename, dirname, extname, join } from 'path'
import { getTrack, getTrackPath } from './libraryStore'
import { parseLrc } from './lyrics'

const LRCLIB = 'https://lrclib.net/api'
const NETEASE = 'https://music.163.com/api'
const LRCLIB_HEADERS = { 'User-Agent': 'PersonalMusicPlayer/1.0 (offline desktop player)' }
const NETEASE_HEADERS = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' }
const MAX_BYTES = 200 * 1024
const AUTO_MIN_SCORE = 45 // below this, "Search online" saves nothing
const LIST_MIN_SCORE = 25 // below this, a version is not even shown
const DEVANAGARI = /[\u0900-\u097F]/g
const CREDIT_LINE = /^\[[^\]]*\]\s*(作词|作曲|编曲|制作人|作詞|歌词|词|曲)\s*[:：]/

const pending = new Map() // one-time token -> { trackId, text }

async function getJson(url, headers) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`The lyrics service answered ${response.status}.`)
  return response.json()
}

// ---------- scoring ----------

function norm(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function overlap(a, b, byMin = false) {
  const A = new Set(norm(a).split(' ').filter(Boolean))
  const B = new Set(norm(b).split(' ').filter(Boolean))
  if (A.size === 0 || B.size === 0) return 0
  let same = 0
  for (const word of A) if (B.has(word)) same += 1
  return same / (byMin ? Math.min(A.size, B.size) : Math.max(A.size, B.size))
}

function baseScore(track, raw) {
  const duration = Math.round(track.duration || 0)
  let score = 0
  if (duration && raw.duration) {
    const diff = Math.abs(raw.duration - duration)
    score += diff <= 2 ? 50 : diff <= 5 ? 35 : diff <= 10 ? 10 : -50
  }
  score += overlap(track.title, raw.title) * 30
  score += overlap(track.artist, raw.artist, true) * 20
  if (track.album && raw.album) score += overlap(track.album, raw.album) * 5
  return score
}

function scriptOf(text) {
  const letters = text.replace(/[^\p{L}]/gu, '')
  if (!letters) return 'Roman'
  if ((letters.match(DEVANAGARI) || []).length / letters.length >= 0.1) return 'Devanagari'
  const latin = (letters.match(/[A-Za-z\u00C0-\u024F]/g) || []).length
  return latin / letters.length >= 0.7 ? 'Roman' : 'Other script'
}

function firstArtist(track) {
  return (track.artist || '').split(/,|&| feat\.? /i)[0].trim()
}

// ---------- providers ----------

async function fromLrclib(track) {
  const out = []
  const push = (item) => {
    if (!item || typeof item !== 'object') return
    out.push({
      source: 'LRCLIB',
      title: item.trackName,
      artist: item.artistName,
      album: item.albumName,
      duration: item.duration,
      synced: item.syncedLyrics,
      plain: item.plainLyrics
    })
  }
  const duration = Math.round(track.duration || 0)
  const full = track.artist || ''
  const first = firstArtist(track)

  for (const artist of [full, first]) {
    if (!artist) continue
    const params = new URLSearchParams({ track_name: track.title, artist_name: artist })
    if (track.album) params.set('album_name', track.album)
    if (duration) params.set('duration', String(duration))
    push(await getJson(`${LRCLIB}/get?${params}`, LRCLIB_HEADERS))
  }

  const queries = [{ track_name: track.title }]
  if (first) queries.unshift({ track_name: track.title, artist_name: first })
  for (const query of queries) {
    const list = await getJson(`${LRCLIB}/search?${new URLSearchParams(query)}`, LRCLIB_HEADERS)
    if (Array.isArray(list)) list.forEach(push)
  }
  return out
}

async function fromNetease(track) {
  const keyword = [track.title, firstArtist(track)].filter(Boolean).join(' ')
  const url =
    `${NETEASE}/search/get/web?csrf_token=&hlpretag=&hlposttag=` +
    `&s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=10`
  const data = await getJson(url, NETEASE_HEADERS)
  const songs = data && data.result && Array.isArray(data.result.songs) ? data.result.songs : []

  const shortlist = songs
    .map((song) => {
      const raw = {
        source: 'NetEase',
        title: song.name,
        artist: (song.artists || []).map((a) => a.name).join(', '),
        album: song.album && song.album.name,
        duration: song.duration ? song.duration / 1000 : 0
      }
      return { id: song.id, raw, pre: baseScore(track, raw) }
    })
    .sort((a, b) => b.pre - a.pre)
    .slice(0, 4)

  const results = await Promise.all(
    shortlist.map(async (item) => {
      try {
        const lyric = await getJson(
          `${NETEASE}/song/lyric?id=${item.id}&lv=1&kv=1&tv=-1`,
          NETEASE_HEADERS
        )
        const text = lyric && lyric.lrc && lyric.lrc.lyric
        if (typeof text !== 'string' || !text.trim()) return null
        const cleaned = text
          .split(/\r?\n/)
          .filter((line) => !CREDIT_LINE.test(line))
          .join('\n')
        const hasTimes = /\[\d{1,3}:\d{2}/.test(cleaned)
        return { ...item.raw, synced: hasTimes ? cleaned : null, plain: hasTimes ? null : cleaned }
      } catch {
        return null
      }
    })
  )
  return results.filter(Boolean)
}

// ---------- gather + rank ----------

function finalize(track, raw) {
  const duration = Math.round(track.duration || 0)
  let text = null
  let synced = false
  let lines = []

  if (typeof raw.synced === 'string' && raw.synced.trim()) {
    const parsed = parseLrc(raw.synced)
    const last = parsed.lines[parsed.lines.length - 1]
    const fits = !duration || !last || last.time <= duration + 15
    if (parsed.synced && parsed.lines.length >= 4 && fits) {
      text = raw.synced
      synced = true
      lines = parsed.lines
    }
  }
  if (!text && typeof raw.plain === 'string' && raw.plain.trim()) {
    text = raw.plain
    lines = raw.plain
      .split(/\r?\n/)
      .map((t) => ({ text: t.trim() }))
      .filter((l) => l.text)
  }
  if (!text || lines.length < 4 || Buffer.byteLength(text) > MAX_BYTES) return null

  const base = baseScore(track, raw)
  const script = scriptOf(lines.map((l) => l.text).join(' '))
  return {
    text,
    synced,
    script,
    base,
    rank: base + (synced ? 15 : 0) + (script === 'Roman' ? 6 : 0),
    source: raw.source,
    title: raw.title || '',
    artist: raw.artist || '',
    album: raw.album || '',
    durationDiff: raw.duration && duration ? Math.round(Math.abs(raw.duration - duration)) : null,
    lineCount: lines.length,
    preview: lines
      .slice(0, 3)
      .map((l) => l.text)
      .filter(Boolean)
      .join(' / ')
  }
}

async function gather(track) {
  const providers = [
    ['LRCLIB', fromLrclib],
    ['NetEase', fromNetease]
  ]
  const settled = await Promise.allSettled(providers.map(([, fn]) => fn(track)))
  const failed = []
  const raw = []
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') raw.push(...result.value)
    else failed.push(providers[i][0])
  })
  if (failed.length === providers.length) throw new Error('NETWORK')

  const seen = new Set()
  const list = []
  for (const item of raw) {
    const candidate = finalize(track, item)
    if (!candidate || seen.has(candidate.text)) continue
    seen.add(candidate.text)
    list.push(candidate)
  }
  list.sort((a, b) => b.rank - a.rank)
  return { list, failed }
}

function lrcPathFor(path) {
  return join(dirname(path), basename(path, extname(path)) + '.lrc')
}

const NETWORK_ERROR = 'Could not reach any lyrics service. Check your internet connection.'

// ---------- public: automatic best match ----------

export async function fetchOnlineLyrics(id) {
  const path = getTrackPath(id)
  const track = getTrack(id)
  if (!path || !track) return { ok: false, error: 'That song is no longer in the library.' }

  try {
    const { list, failed } = await gather(track)
    const best = list.find((c) => c.synced && c.base >= AUTO_MIN_SCORE)
    if (!best) {
      const plainOnly = list.some((c) => !c.synced && c.base >= AUTO_MIN_SCORE)
      let error = plainOnly
        ? 'Only lyrics without timestamps exist online, so none were saved. Try "Pick a version".'
        : 'No matching lyrics were found online. Try "Pick a version" to see weaker matches.'
      if (failed.length) error += ` (${failed.join(', ')} could not be reached.)`
      return { ok: false, error }
    }

    try {
      await writeFile(lrcPathFor(path), best.text, { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      if (error.code === 'EEXIST') {
        return {
          ok: false,
          error: 'A .lrc file with this name already exists. Use "Pick a version" to replace it.'
        }
      }
      throw error
    }
    return { ok: true, source: best.source }
  } catch (error) {
    if (error.message === 'NETWORK') return { ok: false, error: NETWORK_ERROR }
    return { ok: false, error: error.message }
  }
}

// ---------- public: choose a version yourself ----------

export async function searchLyricsCandidates(id) {
  const track = getTrack(id)
  if (!track) return { ok: false, error: 'That song is no longer in the library.' }

  try {
    const { list, failed } = await gather(track)
    const shown = list.filter((c) => c.base >= LIST_MIN_SCORE).slice(0, 8)

    const candidates = shown.map((c, i) => {
      const token = randomUUID()
      pending.set(token, { trackId: id, text: c.text })
      if (pending.size > 30) pending.delete(pending.keys().next().value)
      return {
        token,
        best: i === 0,
        source: c.source,
        title: c.title,
        artist: c.artist,
        album: c.album,
        durationDiff: c.durationDiff,
        script: c.script,
        synced: c.synced,
        lineCount: c.lineCount,
        preview: c.preview
      }
    })
    return { ok: true, candidates, failed }
  } catch (error) {
    if (error.message === 'NETWORK') return { ok: false, error: NETWORK_ERROR }
    return { ok: false, error: error.message }
  }
}

export async function saveLyricsCandidate(id, token) {
  const entry = pending.get(token)
  const path = getTrackPath(id)
  if (!entry || entry.trackId !== id || !path) {
    return { ok: false, error: 'That choice expired. Please search again.' }
  }
  try {
    const target = lrcPathFor(path)
    let replaced = false
    try {
      await copyFile(target, target + '.bak') // keep the old file, never lose it
      replaced = true
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await writeFile(target, entry.text, 'utf8')
    pending.delete(token)
    return { ok: true, replaced }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}
