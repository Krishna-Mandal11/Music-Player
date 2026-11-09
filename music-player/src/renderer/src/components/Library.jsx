import { useCallback, useEffect, useState } from 'react'
import TrackList from './TrackList'

const button = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13
}

function Library({ player, favourites }) {
  const [folders, setFolders] = useState([])
  const [tracks, setTracks] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [progress, setProgress] = useState(null)
  const [message, setMessage] = useState('')
  const scanning = progress !== null

  const loadFolders = useCallback(async () => {
    setFolders(await window.api.getLibraryFolders())
  }, [])

  const loadTracks = useCallback(async (text) => {
    const result = await window.api.getTracks(text)
    setTracks(result.tracks)
    setTotal(result.total)
  }, [])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  useEffect(() => {
    const timer = setTimeout(() => loadTracks(search), 200)
    return () => clearTimeout(timer)
  }, [search, loadTracks])

  useEffect(() => window.api.onScanProgress((p) => setProgress(p)), [])
    useEffect(
    () =>
      window.api.onLibraryChanged(() => {
        loadFolders()
        loadTracks(search)
      }),
    [search, loadFolders, loadTracks]
  )

  async function runScan(id) {
    setMessage('')
    setProgress({ done: 0, total: 0, folder: '' })
    const result = await window.api.scanLibrary(id)
    setProgress(null)
    if (!result.ok) {
      setMessage(result.error)
    } else {
      const s = result.summary
      let text = `Scan finished: ${s.added} added, ${s.updated} updated, ${s.removed} removed.`
      if (s.failed) text += ` ${s.failed} file(s) had unreadable tags.`
      if (s.missing) text += ` ${s.missing} folder(s) could not be found and were skipped.`
      setMessage(text)
    }
    await loadFolders()
    await loadTracks(search)
  }

  async function handleAdd() {
    const result = await window.api.addLibraryFolder()
    if (result.canceled) return
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    await loadFolders()
    await runScan(result.folder.id)
  }

  async function handleRecursive(folder, checked) {
    await window.api.setFolderRecursive(folder.id, checked)
    await runScan(folder.id)
  }

  async function handleRemove(folder) {
    if (!window.confirm('Remove this folder from the library? Your files are not deleted.')) return
    await window.api.removeLibraryFolder(folder.id)
    await loadFolders()
    await loadTracks(search)
  }

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 16px' }}>Songs</h2>

      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button style={button} onClick={handleAdd} disabled={scanning}>
            Add folder…
          </button>
          <button
            style={button}
            onClick={() => runScan(null)}
            disabled={scanning || folders.length === 0}
          >
            Scan now
          </button>
        </div>

        {folders.length === 0 && (
          <p style={{ opacity: 0.7, fontSize: 13 }}>
            No folders yet. Add a folder to build your library. Only folders you add here are ever read.
          </p>
        )}

        {folders.map((folder) => (
          <div
            key={folder.id}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', fontSize: 13 }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {folder.path}
              <span style={{ opacity: 0.6 }}> · {folder.trackCount} tracks</span>
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={folder.recursive}
                disabled={scanning}
                onChange={(e) => handleRecursive(folder, e.target.checked)}
              />
              Include subfolders
            </label>
            <button style={button} onClick={() => handleRemove(folder)} disabled={scanning}>
              Remove
            </button>
          </div>
        ))}

        {scanning && (
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            {progress.total ? `Scanning ${progress.done} of ${progress.total}…` : 'Preparing scan…'}
          </p>
        )}
        {message && !scanning && <p style={{ fontSize: 13, opacity: 0.8 }}>{message}</p>}
      </section>

      <input
        type="search"
        placeholder="Search title, artist or album"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 12px',
          marginBottom: 12,
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.06)',
          color: 'inherit'
        }}
      />

      <TrackList tracks={tracks} player={player} favourites={favourites} />

      {total > tracks.length && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          Showing the first {tracks.length} of {total} tracks. Use search to narrow it down.
        </p>
      )}
      {total === 0 && folders.length > 0 && !scanning && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>No tracks found.</p>
      )}
    </div>
  )
}

export default Library
