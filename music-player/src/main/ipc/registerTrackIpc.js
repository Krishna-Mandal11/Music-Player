import { ipcMain } from 'electron'
import { deleteTrack } from '../library/trackDelete'

export function registerTrackIpc() {
  ipcMain.handle('tracks:delete', async (event, id) => {
    if (!Number.isInteger(id)) return { ok: false, error: 'Invalid song.' }
    const result = await deleteTrack(id)
    if (result.ok && !event.sender.isDestroyed()) event.sender.send('library:changed')
    return result
  })
}
