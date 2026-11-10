import { ipcMain } from 'electron'
import {
  listPlaylists,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  getPlaylistTracks,
  addTracksToPlaylist,
  removeTrackFromPlaylist
} from '../library/playlistStore'

const MAX_TRACKS_PER_CALL = 5000

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

  ipcMain.handle('playlists:get-tracks', (_event, id) => {
    if (!Number.isInteger(id)) throw new Error('Invalid playlist')
    return getPlaylistTracks(id)
  })

  ipcMain.handle('playlists:add-tracks', (_event, id, trackIds) => {
    if (!Number.isInteger(id)) throw new Error('Invalid playlist')
    if (
      !Array.isArray(trackIds) ||
      trackIds.length > MAX_TRACKS_PER_CALL ||
      !trackIds.every((trackId) => Number.isInteger(trackId))
    ) {
      throw new Error('Invalid tracks')
    }
    return addTracksToPlaylist(id, trackIds)
  })

  ipcMain.handle('playlists:remove-track', (_event, id, trackId) => {
    if (!Number.isInteger(id) || !Number.isInteger(trackId)) throw new Error('Invalid request')
    removeTrackFromPlaylist(id, trackId)
    return true
  })
}
