import { registerMediaScheme, registerMediaHandler } from './media/mediaProtocol'
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { openDatabase, closeDatabase, recordAppOpen } from './database/connection'
import { registerIpcHandlers } from './ipc/registerIpcHandlers'
import { startWatcher, stopWatcher } from './library/watcher'

registerMediaScheme()
const dbState = { ok: false, error: null, openCount: 0 }

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f0f12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.personal.musicplayer')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    openDatabase()
    dbState.openCount = recordAppOpen()
    dbState.ok = true
  } catch (error) {
    dbState.error = error.message
    console.error('Database failed to start:', error)
  }

  registerMediaHandler()

  registerIpcHandlers(dbState)
  createWindow()

  if (dbState.ok) startWatcher()
})

app.on('before-quit', () => {
  stopWatcher()
  closeDatabase()
})

app.on('window-all-closed', () => {
  app.quit()
})
