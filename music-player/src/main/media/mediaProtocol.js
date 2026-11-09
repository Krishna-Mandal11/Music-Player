import { protocol } from 'electron'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { extname } from 'path'
import { Readable } from 'stream'
import { getTrackPath } from '../library/libraryStore'

const MIME = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg'
}

// Must be called before the app is ready.
export function registerMediaScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

// Call after the app is ready.
export function registerMediaHandler() {
  protocol.handle('media', async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'track') return new Response('Not found', { status: 404 })
      const id = Number(url.pathname.slice(1))
      if (!Number.isInteger(id)) return new Response('Not found', { status: 404 })
      const file = getTrackPath(id)
      if (!file) return new Response('Not found', { status: 404 })

      const { size } = await stat(file)
      const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream'

      let start = 0
      let end = size - 1
      let status = 200

      const range = request.headers.get('range')
      const match = range && /^bytes=(\d*)-(\d*)$/.exec(range)
      if (match) {
        if (match[1] === '' && match[2] !== '') {
          start = Math.max(0, size - Number(match[2])) // "last N bytes"
        } else {
          start = match[1] === '' ? 0 : Number(match[1])
          if (match[2] !== '') end = Math.min(Number(match[2]), size - 1)
        }
        if (start > end || start >= size) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${size}` }
          })
        }
        status = 206
      }

      const headers = {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1)
      }
      if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${size}`

      const stream = createReadStream(file, { start, end })
      return new Response(Readable.toWeb(stream), { status, headers })
    } catch (error) {
      console.error('media protocol error:', error)
      return new Response('Could not read file', { status: 500 })
    }
  })
}
