import { useEffect, useState } from 'react'
import { usePlaylists } from '../PlaylistsContext'

const LIBRARY_IDS = ['songs', 'artists', 'albums', 'genres']
const COLLECTION_IDS = ['favourites', 'recent']
const MORE_IDS = [
  'years',
  'composers',
  'browse-folders',
  'added',
  'played',
  'lyrics',
  'equalizer',
  'sleep'
]
const BOTTOM_ID = 'folder'

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.06)',
  color: 'inherit',
  fontSize: 13,
  userSelect: 'text'
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function Chevron({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function Sidebar({ groups, activePage, onNavigate }) {
  const { playlists, create, importM3u } = usePlaylists()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState(null)
  const [moreOpen, setMoreOpen] = useState(MORE_IDS.includes(activePage))

  const byId = new Map(groups.flatMap((group) => group.items).map((item) => [item.id, item]))

  // jumping to a hidden page (e.g. from a button elsewhere) opens the section
  useEffect(() => {
    if (MORE_IDS.includes(activePage)) setMoreOpen(true)
  }, [activePage])

  function cancelCreate() {
    setCreating(false)
    setName('')
    setError('')
  }

  async function handleCreate() {
    const result = await create(name)
    if (!result.ok) {
      setError(result.error)
      return
    }
    cancelCreate()
    onNavigate(`playlist:${result.playlist.id}`)
  }

  async function handleImport() {
    setImportNote(null)
    setImporting(true)
    let result
    try {
      result = await importM3u()
    } catch (err) {
      result = { ok: false, error: err.message }
    }
    setImporting(false)

    if (result.canceled) return
    if (!result.ok) {
      setImportNote({ text: result.error, error: true })
      return
    }

    let text = `Imported ${result.added} ${result.added === 1 ? 'song' : 'songs'}.`
    if (result.skipped > 0) {
      text += ` ${result.skipped} skipped (not in your library).`
    }
    setImportNote({ text, error: false })
    onNavigate(`playlist:${result.playlist.id}`)
  }

  function renderItems(ids) {
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((item) => (
        <button
          key={item.id}
          className={item.id === activePage ? 'nav-item active' : 'nav-item'}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))
  }

  const moreActive = MORE_IDS.includes(activePage)

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">Music Player</div>

      <div className="nav-group">
        <div className="nav-group-title">Library</div>
        {renderItems(LIBRARY_IDS)}
      </div>

      <div className="nav-group">
        <div className="nav-group-title">Collection</div>
        {renderItems(COLLECTION_IDS)}
      </div>

      <div className="nav-group">
        <div className="nav-group-title">Playlists</div>
        {playlists.map((playlist) => {
          const id = `playlist:${playlist.id}`
          return (
            <button
              key={id}
              className={id === activePage ? 'nav-item active' : 'nav-item'}
              style={ellipsis}
              title={playlist.name}
              onClick={() => onNavigate(id)}
            >
              {playlist.name}
            </button>
          )
        })}

        {creating ? (
          <div style={{ padding: '4px 0' }}>
            <input
              autoFocus
              style={inputStyle}
              placeholder="Playlist name"
              value={name}
              maxLength={100}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') cancelCreate()
              }}
            />
            {error && <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 4 }}>{error}</div>}
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
              Enter to create, Esc to cancel
            </div>
          </div>
        ) : (
          <button className="nav-item" onClick={() => setCreating(true)}>
            + New playlist
          </button>
        )}

        <button className="nav-item" onClick={handleImport} disabled={importing}>
          {importing ? 'Importing…' : 'Import M3U…'}
        </button>

        {importNote && (
          <div
            style={{
              fontSize: 12,
              padding: '4px 12px',
              color: importNote.error ? '#ff6b6b' : undefined,
              opacity: importNote.error ? 1 : 0.8
            }}
          >
            {importNote.text}
          </div>
        )}
      </div>

      <div className="nav-group">
        <button
          className={moreActive && !moreOpen ? 'nav-more-toggle has-active' : 'nav-more-toggle'}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
        >
          <span>More</span>
          <Chevron open={moreOpen} />
        </button>
        {moreOpen && renderItems(MORE_IDS)}
      </div>

      <div className="nav-bottom">{renderItems([BOTTOM_ID])}</div>
    </nav>
  )
}

export default Sidebar
