import { readFile, stat } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import { getTrackPath } from './libraryStore'

const MAX_LRC_BYTES = 1024 * 1024
const MAX_LINES = 5000
const NONE = { source: null, synced: false, lines: [] }

let mm = null
async function loadMusicMetadata() {
  if (!mm) mm = await import('music-metadata')
  return mm
}

const TIME_TAG = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/

// Reads LRC text: "[mm:ss.xx]words". Handles several times per line and the [offset:] tag.
export function parseLrc(text) {
  const clean = text.replace(/^\uFEFF/, '')
  let offset = 0
  let synced = false
  const timed = []
  const plain = []

  for (const raw of clean.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue

    const off = /^\[offset:\s*([+-]?\d+)\s*\]$/i.exec(line)
    if (off) {
      offset = Number(off[1])
      continue
    }

    const times = []
    let rest = line
    let match = TIME_TAG.exec(rest)
    while (match) {
      const fraction = match[3] ? Number(match[3].padEnd(3, '0').slice(0, 3)) / 1000 : 0
      times.push(Number(match[1]) * 60 + Number(match[2]) + fraction)
      rest = rest.slice(match[0].length)
      match = TIME_TAG.exec(rest)
    }

    if (times.length === 0) {
      if (/^\[[a-z]+:.*\]$/i.test(line)) continue // info tags such as [ar:Artist]
      plain.push({ time: null, text: line })
      continue
    }

    synced = true
    const words = rest.replace(/<\d+:\d+(?:[.:]\d+)?>/g, '').trim() // drop word-level tags
    for (const t of times) timed.push({ time: Math.max(0, t - offset / 1000), text: words })
  }

  if (synced) {
    timed.sort((a, b) => a.time - b.time)
    return { synced: true, lines: timed.slice(0, MAX_LINES) }
  }
  return { synced: false, lines: plain.slice(0, MAX_LINES) }
}

function fromText(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  if (/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(text)) {
    const parsed = parseLrc(text)
    if (parsed.lines.length > 0) return { source: 'embedded', ...parsed }
  }
  const lines = text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split('\n')
    .map((line) => ({ time: null, text: line.trim() }))
  return { source: 'embedded', synced: false, lines: lines.slice(0, MAX_LINES) }
}

// Different music-metadata versions return plain strings or objects.
function fromEmbedded(entries) {
  if (!Array.isArray(entries)) return null
  for (const entry of entries) {
    if (typeof entry === 'string') {
      const result = fromText(entry)
      if (result) return result
      continue
    }
    if (!entry || typeof entry !== 'object') continue

    if (Array.isArray(entry.syncText) && entry.syncText.length > 0 && entry.timeStampFormat !== 1) {
      const lines = entry.syncText
        .filter((s) => s && typeof s.text === 'string' && Number.isFinite(s.timestamp))
        .map((s) => ({ time: s.timestamp / 1000, text: s.text.trim() }))
        .sort((a, b) => a.time - b.time)
      if (lines.length > 0) {
        return { source: 'embedded', synced: true, lines: lines.slice(0, MAX_LINES) }
      }
    }
    const result = fromText(entry.text)
    if (result) return result
  }
  return null
}

export async function getLyrics(id) {
  const file = getTrackPath(id)
  if (!file) return NONE

  // 1. A .lrc file with the same name, next to the song
  try {
    const lrcPath = join(dirname(file), `${basename(file, extname(file))}.lrc`)
    const info = await stat(lrcPath)
    if (info.isFile() && info.size > 0 && info.size <= MAX_LRC_BYTES) {
      const parsed = parseLrc(await readFile(lrcPath, 'utf8'))
      if (parsed.lines.length > 0) return { source: 'lrc', ...parsed }
    }
  } catch {
    // no .lrc file, try the tags
  }

  // 2. Lyrics stored inside the song file
  try {
    const { parseFile } = await loadMusicMetadata()
    const meta = await parseFile(file, { duration: false, skipCovers: true })
    const result = fromEmbedded(meta.common.lyrics)
    if (result) return result
  } catch {
    // unreadable tags: no lyrics
  }

  return NONE
}
