import { BrowserWindow, ipcMain } from 'electron'
import { getTagInfo, pickArtwork, saveTags } from '../library/tagEditor'

export function registerTagIpc() {
  ipcMain.handle('tags:get', (_event, id) => {
    if (!Number.isInteger(id)) return { ok: false, error: 'Invalid song.' }
    return getTagInfo(id)
  })

  ipcMain.handle('tags:pick-artwork', (event) =>
    pickArtwork(BrowserWindow.fromWebContents(event.sender))
  )

  ipcMain.handle('tags:save', async (event, payload) => {
    if (!payload || typeof payload !== 'object' || !Number.isInteger(payload.id)) {
      return { ok: false, error: 'Invalid request.' }
    }
    const result = await saveTags(payload)
    if (result.ok && !result.unchanged && !event.sender.isDestroyed()) {
      event.sender.send('library:changed') // lists reload with the new tags
    }
    return result
  })
}
