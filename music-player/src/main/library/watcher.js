import { watch } from 'fs'
import { extname } from 'path'
import { BrowserWindow } from 'electron'
import { listFolders } from './libraryStore'
import { scanFolders } from './scanner'

const AUDIO_EXT = new Set(['.mp3', '.flac', '.m4a', '.aac', '.wav', '.ogg', '.opus'])
const QUIET_MS = 4000 // wait until file changes stop (e.g. a copy finishing)
const RECONCILE_MS = 15000 // pick up added/removed folders and replugged drives

const watchers = new Map() // key -> fs.FSWatcher
const pending = new Set() // folder ids waiting for a rescan
let scanTimer = null
let reconcileTimer = null

function keyOf(folder) {
  return `${folder.id}|${folder.path}|${folder.recursive ? 1 : 0}`
}

function isRelevant(name) {
  if (!name) return true // the OS gave no file name: be safe and rescan
  const text = String(name)
  if (text.split(/[\\/]/).some((part) => part.startsWith('.'))) return false
  const ext = extname(text).toLowerCase()
  return ext === '' || AUDIO_EXT.has(ext) // no extension could be a folder
}

function onEvent(folderId, name) {
  if (!isRelevant(name)) return
  pending.add(folderId)
  clearTimeout(scanTimer)
  scanTimer = setTimeout(runPending, QUIET_MS)
}

async function runPending() {
  scanTimer = null
  const ids = new Set(pending)
  pending.clear()
  let folders
  try {
    folders = listFolders().filter((f) => ids.has(f.id))
  } catch {
    return
  }
  if (folders.length === 0) return

  try {
    const summary = await scanFolders(folders, () => {})
    if (summary.added + summary.updated + summary.removed > 0) {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('library:changed')
      }
    }
  } catch (error) {
    if (error && error.message === 'A scan is already running') {
      // a manual scan is in progress: try again shortly
      for (const id of ids) pending.add(id)
      scanTimer = setTimeout(runPending, QUIET_MS)
    } else {
      console.error('Auto-scan failed:', error)
    }
  }
}

function reconcile() {
  let folders
  try {
    folders = listFolders()
  } catch {
    return
  }
  const wanted = new Map(folders.map((f) => [keyOf(f), f]))

  for (const [key, watcher] of watchers) {
    if (!wanted.has(key)) {
      watcher.close()
      watchers.delete(key)
    }
  }

  for (const [key, folder] of wanted) {
    if (watchers.has(key)) continue
    try {
      const watcher = watch(folder.path, { recursive: folder.recursive }, (_event, name) =>
        onEvent(folder.id, name)
      )
      watcher.on('error', () => {
        watcher.close()
        watchers.delete(key) // retried on the next reconcile
      })
      watchers.set(key, watcher)
    } catch {
      // folder missing (e.g. unplugged drive): retried on the next reconcile
    }
  }
}

export function startWatcher() {
  if (reconcileTimer) return
  reconcile()
  reconcileTimer = setInterval(reconcile, RECONCILE_MS)
}

export function stopWatcher() {
  clearInterval(reconcileTimer)
  clearTimeout(scanTimer)
  reconcileTimer = null
  scanTimer = null
  for (const watcher of watchers.values()) watcher.close()
  watchers.clear()
}
