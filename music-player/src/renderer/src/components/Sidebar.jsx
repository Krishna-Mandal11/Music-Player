import { useState } from 'react'
import { usePlaylists } from '../PlaylistsContext'

const SETTINGS_TITLE = 'Settings'

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.06)',
  color: 'inherit',
  fontSize: 13,
  userSelect: 'text'
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function Sidebar({ groups, activePage, onNavigate }) {
  const { playlists, create } = usePlaylists()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

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

  function renderGroup(group) {
    return (
      <div className="nav-group" key={group.title}>
        <div className="nav-group-title">{group.title}</div>
        {group.items.map((item) => (
          <button
            key={item.id}
            className={item.id === activePage ? 'nav-item active' : 'nav-item'}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">Music Player</div>

      {groups.filter((group) => group.title !== SETTINGS_TITLE).map(renderGroup)}

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
      </div>

      {groups.filter((group) => group.title === SETTINGS_TITLE).map(renderGroup)}
    </nav>
  )
}

export default Sidebar
