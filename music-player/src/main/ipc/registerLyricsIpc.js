import { ipcMain } from 'electron'
import { getLyrics } from '../library/lyrics'

const NONE = { source: null, synced: false, lines: [] }

export function registerLyricsIpc() {
  ipcMain.handle('lyrics:get', async (_event, id) => {
    if (!Number.isInteger(id)) return NONE
    try {
      return await getLyrics(id)
    } catch {
      return NONE
    }
  })
}
