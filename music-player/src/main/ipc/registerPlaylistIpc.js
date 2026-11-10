import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname } from 'path'
import {
  listPlaylists,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  setPlaylistMode,
  getPlaylistTracks,
  addTracksToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylist,
  getPlaylistForExport,
  findTrackIdsByPaths,
  createPlaylistWithTracks
} from '../library/playlistStore'
import { buildM3u, parseM3u } from '../library/m3u'

const MAX_TRACKS_PER_CALL = 5000
const MAX_M3U_BYTES = 5 * 1024 * 1024
const MAX_M3U_ENTRIES = 20000
const REPEAT_MODES = ['off', 'all', 'one']

function validTrackIds(trackIds) {
  return (
    Array.isArray(trackIds) &&
    trackIds.length <= MAX_TRACKS_PER_CALL &&
    trackIds.every((trackId) => Number.isInteger(trackId))
  )
}

function safeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'playlist'
}

export function registerPlaylistIpc() {
  ipcMain.handle('playlists:list', () => listPlaylists())

  ipcMain.handle('playlists:create', (_event, name) => {
    if (typeof name !== 'string') return { ok: false, error: 'Invalid name.' }
    return createPlaylist(name)
  })

  ipcMain.handle('playlists:rename', (_event, id, name) => {
    if (!Number.isInteger(id)) throw new Error('Invalid playlist')
    if (typeof name !== 'string') return { ok: false, error: 'Invalid name.' }
    return renamePlaylist(id, name)
  })

  ipcMain.handle('playlists:delete', (_event, id) => {
    if (!Number.isInteger(id)) throw new Error('Invalid playlist')
    deletePlaylist(id)
    return true
  })

  ipcMain.handle('playlists:set-mode', (_event, id, shuffle, repeat) => {
    if (!Number.isInteger(id)) throw new Error('Invalid playlist')
    if (typeof shuffle !== 'boolean' || !REPEAT_MODES.includes(repeat)) {
      throw new Error('Invalid playlist mode')
    }
    setPlaylistMode(id, shuffle, repeat)
    return true
  })

  ipcMain.handle('playlists:get-tracks', (_event, id) => {
    if (!Number.isInteger(id)) throw new Error('Invalid playlist')
    return getPlaylistTracks(id)
  })

  ipcMain.handle('playlists:add-tracks', (_event, id, trackIds) => {
    if (!Number.isInteger(id)) throw new Error('Invalid playlist')
    if (!validTrackIds(trackIds)) throw new Error('Invalid tracks')
    return addTracksToPlaylist(id, trackIds)
  })

  ipcMain.handle('playlists:remove-track', (_event, id, trackId) => {
    if (!Number.isInteger(id) || !Number.isInteger(trackId)) throw new Error('Invalid request')
    removeTrackFromPlaylist(id, trackId)
    return true
  })

  ipcMain.handle('playlists:reorder', (_event, id, trackIds) => {
    if (!Number.isInteger(id)) throw new Error('Invalid playlist')
    if (!validTrackIds(trackIds)) throw new Error('Invalid tracks')
    return reorderPlaylist(id, trackIds)
  })

  // The page never sends a file path: the system dialog decides where the file goes.
  ipcMain.handle('playlists:export-m3u', async (event, id) => {
    if (!Number.isInteger(id)) throw new Error('Invalid playlist')

    const data = getPlaylistForExport(id)
    if (!data) return { ok: false, error: 'That playlist no longer exists.' }
    if (data.rows.length === 0) return { ok: false, error: 'This playlist is empty.' }

    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showSaveDialog(win, {
      title: 'Export playlist',
      defaultPath: `${safeFileName(data.name)}.m3u8`,
      filters: [
        { name: 'M3U8 playlist', extensions: ['m3u8'] },
        { name: 'M3U playlist', extensions: ['m3u'] }
      ]
    })
    if (result.canceled || !result.filePath) return { canceled: true }

    try {
      await writeFile(result.filePath, buildM3u(data.rows), 'utf8')
      return { ok: true, count: data.rows.length, filePath: result.filePath }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('playlists:import-m3u', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(win, {
      title: 'Import a playlist',
      properties: ['openFile'],
      filters: [{ name: 'Playlists', extensions: ['m3u', 'm3u8'] }]
    })
    if (picked.canceled || !picked.filePaths[0]) return { canceled: true }

    const filePath = picked.filePaths[0]
    try {
      const info = await stat(filePath)
      if (info.size > MAX_M3U_BYTES) return { ok: false, error: 'That playlist file is too large.' }

      const text = await readFile(filePath, 'utf8')
      const paths = parseM3u(text, dirname(filePath))
      if (paths.length === 0) return { ok: false, error: 'No songs were found in that file.' }
      if (paths.length > MAX_M3U_ENTRIES) {
        return { ok: false, error: 'That playlist has too many entries.' }
      }

      // Only songs that are already in the library are imported.
      const { ids, skipped } = findTrackIdsByPaths(paths)
      if (ids.length === 0) {
        return {
          ok: false,
          error:
            'None of the songs in that file are in your library. Add their folder on the Music Folder page first.'
        }
      }

      const created = createPlaylistWithTracks(basename(filePath, extname(filePath)), ids)
      if (!created.ok) return created
      return { ok: true, playlist: created.playlist, added: created.added, skipped }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })
}
