import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  getDbStatus: () => ipcRenderer.invoke('db:get-status'),
  getAllSettings: () => ipcRenderer.invoke('settings:get-all'),
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  getLibraryFolders: () => ipcRenderer.invoke('library:get-folders'),
  addLibraryFolder: () => ipcRenderer.invoke('library:add-folder'),
  removeLibraryFolder: (id) => ipcRenderer.invoke('library:remove-folder', id),
  setFolderRecursive: (id, recursive) => ipcRenderer.invoke('library:set-recursive', id, recursive),
  scanLibrary: (id) => ipcRenderer.invoke('library:scan', id),
  getTracks: (search) => ipcRenderer.invoke('library:get-tracks', search),
  getFavouriteIds: () => ipcRenderer.invoke('favourites:get-ids'),
  toggleFavourite: (id) => ipcRenderer.invoke('favourites:toggle', id),
  getFavouriteTracks: () => ipcRenderer.invoke('favourites:get-tracks'),
  recordPlay: (id) => ipcRenderer.invoke('history:record', id),
  getRecentTracks: () => ipcRenderer.invoke('history:get-recent'),
  getTrack: (id) => ipcRenderer.invoke('library:get-track', id),
  getArtistGroups: () => ipcRenderer.invoke('browse:artists'),
  getAlbumGroups: () => ipcRenderer.invoke('browse:albums'),
  getTracksByArtist: (name) => ipcRenderer.invoke('browse:artist-tracks', name),
  getTracksByAlbum: (name, artist) => ipcRenderer.invoke('browse:album-tracks', name, artist),
  getGenreGroups: () => ipcRenderer.invoke('browse:genres'),
  getTracksByGenre: (name) => ipcRenderer.invoke('browse:genre-tracks', name),
  getArtwork: (file) => ipcRenderer.invoke('library:get-artwork', file),
  onScanProgress: (callback) => {
    const handler = (_event, progress) => callback(progress)
    ipcRenderer.on('library:scan-progress', handler)
    return () => ipcRenderer.removeListener('library:scan-progress', handler)
  },
  onLibraryChanged: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('library:changed', handler)
    return () => ipcRenderer.removeListener('library:changed', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
