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
  getFilterOptions: () => ipcRenderer.invoke('library:get-filter-options'),
  getRecentlyAdded: () => ipcRenderer.invoke('library:get-recently-added'),
  getMostPlayed: () => ipcRenderer.invoke('library:get-most-played'),
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
  getYearGroups: () => ipcRenderer.invoke('browse:years'),
  getTracksByYear: (name) => ipcRenderer.invoke('browse:year-tracks', name),
  getComposerGroups: () => ipcRenderer.invoke('browse:composers'),
  getTracksByComposer: (name) => ipcRenderer.invoke('browse:composer-tracks', name),
  browseFolder: (dirPath) => ipcRenderer.invoke('browse:folder', dirPath ?? null),
  getArtwork: (file) => ipcRenderer.invoke('library:get-artwork', file),
  getLyrics: (id) => ipcRenderer.invoke('lyrics:get', id),
  getTagInfo: (id) => ipcRenderer.invoke('tags:get', id),
  pickArtwork: () => ipcRenderer.invoke('tags:pick-artwork'),
  saveTags: (payload) => ipcRenderer.invoke('tags:save', payload),
  getPlaylists: () => ipcRenderer.invoke('playlists:list'),
  createPlaylist: (name) => ipcRenderer.invoke('playlists:create', name),
  renamePlaylist: (id, name) => ipcRenderer.invoke('playlists:rename', id, name),
  deletePlaylist: (id) => ipcRenderer.invoke('playlists:delete', id),
  setPlaylistMode: (id, shuffle, repeat) =>
    ipcRenderer.invoke('playlists:set-mode', id, shuffle, repeat),
  getPlaylistTracks: (id) => ipcRenderer.invoke('playlists:get-tracks', id),
  addTracksToPlaylist: (id, trackIds) => ipcRenderer.invoke('playlists:add-tracks', id, trackIds),
  removeTrackFromPlaylist: (id, trackId) =>
    ipcRenderer.invoke('playlists:remove-track', id, trackId),
  reorderPlaylist: (id, trackIds) => ipcRenderer.invoke('playlists:reorder', id, trackIds),
  exportPlaylistM3u: (id) => ipcRenderer.invoke('playlists:export-m3u', id),
  importPlaylistM3u: () => ipcRenderer.invoke('playlists:import-m3u'),

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
