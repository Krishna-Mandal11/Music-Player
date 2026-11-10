import { fileURLToPath } from 'url'
import { isAbsolute, normalize, resolve } from 'path'

function oneLine(text) {
  return String(text).replace(/[\r\n]+/g, ' ')
}

// Turns a list of songs into the text of an M3U8 file.
export function buildM3u(rows) {
  const lines = ['#EXTM3U']
  for (const row of rows) {
    const seconds = row.duration ? Math.round(row.duration) : -1
    const label = row.artist ? `${row.artist} - ${row.title}` : row.title
    lines.push(`#EXTINF:${seconds},${oneLine(label)}`)
    lines.push(row.path)
  }
  return lines.join('\r\n') + '\r\n'
}

// Reads the text of an M3U file and returns a list of full file paths.
// baseDir is the folder the playlist file is in (used for relative paths).
export function parseM3u(text, baseDir) {
  const clean = text.replace(/^\uFEFF/, '')
  const paths = []

  for (const rawLine of clean.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    let filePath = line
    if (/^file:\/\//i.test(line)) {
      try {
        filePath = fileURLToPath(line)
      } catch {
        continue
      }
    } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(line)) {
      continue // web addresses are not supported
    }

    paths.push(isAbsolute(filePath) ? normalize(filePath) : resolve(baseDir, filePath))
  }

  return paths
}
