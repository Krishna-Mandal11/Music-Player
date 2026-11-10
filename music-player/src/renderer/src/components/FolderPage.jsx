import { useCallback, useEffect, useRef, useState } from 'react'

const button = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13
}

function FolderPage({ onLibraryUpdated }) {
  const [folders, setFolders] = useState([])
  const [progress, setProgress] = useState(null)
  const [message, setMessage] = useState('')
  const manualScan = useRef(false)
  const scanning = progress !== null

  const loadFolders = useCallback(async () => {
    setFolders(await window.api.getLibraryFolders())
  }, [])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  // Only show progress for scans started from this page
  useEffect(
    () =>
      window.api.onScanProgress((p) => {
        if (manualScan.current) setProgress(p)
      }),
    []
  )

  // Keep the track counts fresh when the folder watcher finds changes
  useEffect(() => window.api.onLibraryChanged(() => loadFolders()), [loadFolders])

  async function runScan(id) {
    manualScan.current = true
    setMessage('')
    setProgress({ done: 0, total: 0, folder: '' })

    let result
    try {
      result = await window.api.scanLibrary(id)
    } catch (error) {
      result = { ok: false, error: error.message }
    }

    manualScan.current = false
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
    if (onLibraryUpdated) onLibraryUpdated()
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
    if (onLibraryUpdated) onLibraryUpdated()
  }

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 8px' }}>Music Folder</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7 }}>
        Only folders you add here are ever read.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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
          No folders yet. Add a folder to build your library.
        </p>
      )}

      {folders.map((folder) => (
        <div
          key={folder.id}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', fontSize: 13 }}
        >
          <span
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
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
    </div>
  )
}

export default FolderPage
