import { access, unlink } from 'fs/promises'
import { getDb } from '../database/connection'
import { getTrackPath } from './libraryStore'

export async function deleteTrack(id) {
  const path = getTrackPath(id)
  if (!path) return { ok: false, error: 'That song is no longer in the library.' }

  let exists = true
  try {
    await access(path)
  } catch {
    exists = false // the file is already gone: just clean up the library
  }

  if (exists) {
    try {
      await unlink(path) // permanent: does not go to the Recycle Bin
    } catch (error) {
      const busy = error.code === 'EBUSY' || error.code === 'EPERM'
      return {
        ok: false,
        error: busy
          ? 'The file is in use or protected, so it was not deleted. Pause it or play another song, then try again.'
          : `The file could not be deleted (${error.message}).`
      }
    }
  }

  try {
    getDb().prepare('DELETE FROM tracks WHERE id = ?').run(id)
  } catch (error) {
    return {
      ok: false,
      error: `The file was deleted, but the library entry could not be removed (${error.message}). Run Scan now to clean it up.`
    }
  }
  return { ok: true }
}
