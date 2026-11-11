import { ipcMain } from 'electron'
import { fetchOnlineLyrics } from '../library/lyricsOnline'

export function registerLyricsOnlineIpc() {
  ipcMain.handle('lyrics:fetch-online', (_event, id) => {
    if (!Number.isInteger(id)) return { ok: false, error: 'Invalid song.' }
    return fetchOnlineLyrics(id)
  })
}
