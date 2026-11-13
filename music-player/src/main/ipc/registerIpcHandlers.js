import { app, ipcMain, dialog, BrowserWindow } from 'electron'
import { getSchemaVersion } from '../database/connection'
import { getSetting, setSetting, getAllSettings } from '../settings/settingsStore'
import {
  listFolders,
  getFolder,
  addFolder,
  removeFolder,
  setRecursive,
  getTracks,
  getTrack,
  getFavouriteIds,
  toggleFavourite,
  getFavouriteTracks,
  recordPlay,
  getRecentTracks,
  getArtistGroups,
  getAlbumGroups,
  getTracksByArtist,
  getTracksByAlbum,
  getGenreGroups,
  getTracksByGenre,
  getFilterOptions,
  getRecentlyAdded,
  getMostPlayed,
  getYearGroups,
  getTracksByYear,
  getComposerGroups,
  getTracksByComposer,
  browseFolder
} from '../library/libraryStore'
import { scanFolders, getArtworkDataUrl } from '../library/scanner'
import { registerPlaylistIpc } from './registerPlaylistIpc'
import { registerLyricsIpc } from './registerLyricsIpc'
import { registerTagIpc } from './registerTagIpc'
import { registerLyricsOnlineIpc } from './registerLyricsOnlineIpc'
import { registerTrackIpc } from './registerTrackIpc'

export function registerIpcHandlers(dbState) {
  registerPlaylistIpc()
  registerLyricsIpc()
  registerTagIpc()
  registerLyricsOnlineIpc()
  registerTrackIpc()

  ipcMain.handle('library:get-filter-options', () => getFilterOptions())
  ipcMain.handle('library:get-recently-added', () => getRecentlyAdded())
  ipcMain.handle('library:get-most-played', () => getMostPlayed())

  ipcMain.handle('browse:years', () => getYearGroups())
  ipcMain.handle('browse:year-tracks', (_event, name) => {
    if (typeof name !== 'string') throw new Error('Invalid year')
    return getTracksByYear(name)
  })

  ipcMain.handle('browse:composers', () => getComposerGroups())
  ipcMain.handle('browse:composer-tracks', (_event, name) => {
    if (typeof name !== 'string') throw new Error('Invalid composer')
    return getTracksByComposer(name)
  })

  ipcMain.handle('browse:folder', (_event, dirPath) => {
    if (dirPath !== null && dirPath !== undefined && typeof dirPath !== 'string') {
      throw new Error('Invalid folder')
    }
    return browseFolder(dirPath ?? null)
  })

  ipcMain.handle('favourites:get-ids', () => getFavouriteIds())

  ipcMain.handle('favourites:toggle', (_event, id) => {
    if (!Number.isInteger(id)) throw new Error('Invalid track')
    return toggleFavourite(id)
  })

  ipcMain.handle('browse:genres', () => getGenreGroups())

  ipcMain.handle('browse:genre-tracks', (_event, name) => {
    if (typeof name !== 'string') throw new Error('Invalid genre')
    return getTracksByGenre(name)
  })

  ipcMain.handle('favourites:get-tracks', () => getFavouriteTracks())

  ipcMain.handle('history:record', (_event, id) => {
    if (!Number.isInteger(id)) throw new Error('Invalid track')
    recordPlay(id)
    return true
  })

  ipcMain.handle('history:get-recent', () => getRecentTracks())

  ipcMain.handle('library:get-track', (_event, id) => {
    if (!Number.isInteger(id)) return null
    return getTrack(id)
  })

  ipcMain.handle('app:get-info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }))

  ipcMain.handle('db:get-status', () => {
    if (!dbState.ok) return { ok: false, error: dbState.error }
    return { ok: true, schemaVersion: getSchemaVersion(), openCount: dbState.openCount }
  })

  ipcMain.handle('settings:get-all', () => getAllSettings())

  ipcMain.handle('settings:get', (_event, key) => {
    if (typeof key !== 'string') throw new Error('Invalid setting key')
    return getSetting(key)
  })

  ipcMain.handle('settings:set', (_event, key, value) => {
    if (typeof key !== 'string' || key.length === 0) throw new Error('Invalid setting key')
    setSetting(key, value)
    return true
  })

  // ---- Library (M3) ----
  // The renderer never sends file paths. Folders come only from the system folder
  // picker, and scans only ever read folders already saved in the database.

  ipcMain.handle('library:get-folders', () => listFolders())

  ipcMain.handle('library:add-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose a music folder',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    try {
      return addFolder(result.filePaths[0])
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('library:remove-folder', (_event, id) => {
    if (!Number.isInteger(id)) throw new Error('Invalid folder')
    removeFolder(id)
    return true
  })

  ipcMain.handle('library:set-recursive', (_event, id, recursive) => {
    if (!Number.isInteger(id)) throw new Error('Invalid folder')
    setRecursive(id, recursive === true)
    return true
  })

  ipcMain.handle('browse:artists', () => getArtistGroups())
  ipcMain.handle('browse:albums', () => getAlbumGroups())

  ipcMain.handle('browse:artist-tracks', (_event, name) => {
    if (typeof name !== 'string') throw new Error('Invalid artist')
    return getTracksByArtist(name)
  })

  ipcMain.handle('browse:album-tracks', (_event, name, artist) => {
    if (typeof name !== 'string' || typeof artist !== 'string') throw new Error('Invalid album')
    return getTracksByAlbum(name, artist)
  })

  ipcMain.handle('library:scan', async (event, id) => {
    let folders
    if (id === null || id === undefined) folders = listFolders()
    else if (Number.isInteger(id)) folders = [getFolder(id)].filter(Boolean)
    else return { ok: false, error: 'Invalid folder' }

    const send = (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('library:scan-progress', progress)
    }
    try {
      const summary = await scanFolders(folders, send)
      return { ok: true, summary }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('library:get-tracks', (_event, search) => getTracks(search))

  ipcMain.handle('library:get-artwork', (_event, file) => getArtworkDataUrl(file))
}
