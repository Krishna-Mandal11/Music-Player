import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const PlaylistsContext = createContext(null)

export function PlaylistsProvider({ children }) {
  const [playlists, setPlaylists] = useState([])
  // Goes up every time playlist contents change, so open playlist pages reload
  const [version, setVersion] = useState(0)

  const refresh = useCallback(async () => {
    setPlaylists(await window.api.getPlaylists())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(
    async (name) => {
      const result = await window.api.createPlaylist(name)
      if (result.ok) await refresh()
      return result
    },
    [refresh]
  )

  const rename = useCallback(
    async (id, name) => {
      const result = await window.api.renamePlaylist(id, name)
      if (result.ok) await refresh()
      return result
    },
    [refresh]
  )

  const remove = useCallback(
    async (id) => {
      await window.api.deletePlaylist(id)
      await refresh()
      setVersion((v) => v + 1)
    },
    [refresh]
  )

  const addTracks = useCallback(
    async (id, trackIds) => {
      const result = await window.api.addTracksToPlaylist(id, trackIds)
      await refresh()
      setVersion((v) => v + 1)
      return result
    },
    [refresh]
  )

  const removeTrack = useCallback(
    async (id, trackId) => {
      await window.api.removeTrackFromPlaylist(id, trackId)
      await refresh()
      setVersion((v) => v + 1)
    },
    [refresh]
  )

  const value = useMemo(
    () => ({ playlists, version, refresh, create, rename, remove, addTracks, removeTrack }),
    [playlists, version, refresh, create, rename, remove, addTracks, removeTrack]
  )

  return <PlaylistsContext.Provider value={value}>{children}</PlaylistsContext.Provider>
}

export function usePlaylists() {
  const value = useContext(PlaylistsContext)
  if (!value) throw new Error('usePlaylists must be used inside PlaylistsProvider')
  return value
}
