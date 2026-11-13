import { ipcMain } from 'electron'
import {
  fetchOnlineLyrics,
  saveLyricsCandidate,
  searchLyricsCandidates
} from '../library/lyricsOnline'

export function registerLyricsOnlineIpc() {
  ipcMain.handle('lyrics:fetch-online', (_event, id) => {
    if (!Number.isInteger(id)) return { ok: false, error: 'Invalid song.' }
    return fetchOnlineLyrics(id)
  })

  ipcMain.handle('lyrics:search-candidates', (_event, id) => {
    if (!Number.isInteger(id)) return { ok: false, error: 'Invalid song.' }
    return searchLyricsCandidates(id)
  })

  ipcMain.handle('lyrics:save-candidate', (_event, id, token) => {
    if (!Number.isInteger(id) || typeof token !== 'string') {
      return { ok: false, error: 'Invalid request.' }
    }
    return saveLyricsCandidate(id, token)
  })
}
