import { useState } from 'react'
import ArtThumb from './ArtThumb'
import { usePlaylists } from '../PlaylistsContext'
import { useTagEditor } from '../TagEditorContext'

function formatDuration(seconds) {
  if (!seconds) return '–'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function Heart({ filled }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 24" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="6" r="1.6" />
      <circle cx="10" cy="6" r="1.6" />
      <circle cx="4" cy="12" r="1.6" />
      <circle cx="10" cy="12" r="1.6" />
      <circle cx="4" cy="18" r="1.6" />
      <circle cx="10" cy="18" r="1.6" />
    </svg>
  )
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const menuItem = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '7px 8px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13,
  ...ellipsis
}

export function AddToPlaylistButton({ track }) {
  const { playlists, create, addTracks } = usePlaylists()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState('')

  function close() {
    setOpen(false)
    setNewName('')
    setMessage('')
  }

  async function addTo(playlist) {
    const result = await addTracks(playlist.id, [track.id])
    if (result.ok === false) {
      setMessage(result.error)
      return
    }
    setMessage(result.added > 0 ? `Added to ${playlist.name}` : `Already in ${playlist.name}`)
    setTimeout(close, 900)
  }

  async function createAndAdd() {
    const created = await create(newName)
    if (!created.ok) {
      setMessage(created.error)
      return
    }
    await addTo(created.playlist)
  }

  return (
    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button
        className="icon-btn"
        title="Add to playlist"
        onClick={() => setOpen(true)}
        style={{ opacity: 0.6 }}
      >
        <PlusIcon />
      </button>

      {open && (
        <>
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              zIndex: 21,
              width: 240,
              maxHeight: 280,
              overflowY: 'auto',
              padding: 8,
              borderRadius: 8,
              border: '1px solid #33333d',
              background: '#1f1f27',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.6, padding: '0 8px 6px' }}>ADD TO PLAYLIST</div>

            {playlists.length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.7, padding: '0 8px 8px' }}>
                No playlists yet. Create one below.
              </div>
            )}

            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                style={menuItem}
                title={playlist.name}
                onClick={() => addTo(playlist)}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {playlist.name}
              </button>
            ))}

            <div style={{ display: 'flex', gap: 6, padding: '8px 0 0' }}>
              <input
                placeholder="New playlist"
                value={newName}
                maxLength={100}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setMessage('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createAndAdd()
                  if (e.key === 'Escape') close()
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'inherit',
                  fontSize: 13,
                  userSelect: 'text'
                }}
              />
              <button
                onClick={createAndAdd}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                Create
              </button>
            </div>

            {message && <div style={{ fontSize: 12, opacity: 0.85, paddingTop: 8 }}>{message}</div>}
          </div>
        </>
      )}
    </div>
  )
}

function TrackList({ tracks, player, favourites, onRemove, onReorder, onPlay }) {
  const [dragIndex, setDragIndex] = useState(null)
  const tagEditor = useTagEditor()
  const [overIndex, setOverIndex] = useState(null)

  function endDrag() {
    setDragIndex(null)
    setOverIndex(null)
  }

  return tracks.map((track, index) => {
    const isCurrent = player.track && player.track.id === track.id
    const isFavourite = favourites.ids.has(track.id)
    const isDragging = dragIndex === index
    const showDropLine = dragIndex !== null && overIndex === index && dragIndex !== index
    const dropLine =
      dragIndex > index ? 'inset 0 2px 0 var(--accent)' : 'inset 0 -2px 0 var(--accent)'

    return (
      <div
        key={track.id}
        className="track-row"
        onClick={() => (onPlay ? onPlay(track) : player.play(track, tracks))}
        title="Click to play"
        draggable={!!onReorder}
        onDragStart={(e) => {
          if (!onReorder) return
          setDragIndex(index)
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', String(index))
        }}
        onDragOver={(e) => {
          if (dragIndex === null) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (overIndex !== index) setOverIndex(index)
        }}
        onDrop={(e) => {
          if (dragIndex === null) return
          e.preventDefault()
          if (dragIndex !== index) onReorder(dragIndex, index)
          endDrag()
        }}
        onDragEnd={endDrag}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 8px',
          margin: '0 -8px',
          borderRadius: 12,
          cursor: 'pointer',
          fontSize: 13,
          opacity: isDragging ? 0.4 : 1,
          boxShadow: showDropLine ? dropLine : 'none',
          background: isCurrent ? 'rgba(124,92,255,0.22)' : undefined
        }}
      >
        {onReorder && (
          <span
            title="Drag to reorder"
            style={{ display: 'flex', opacity: 0.4, cursor: 'grab', marginRight: -4 }}
          >
            <GripIcon />
          </span>
        )}
        <ArtThumb file={track.artwork} />
        <div style={{ flex: 2, minWidth: 0 }}>
          <div style={{ ...ellipsis, fontWeight: isCurrent ? 600 : 400 }}>{track.title}</div>
          <div style={{ ...ellipsis, opacity: 0.6 }}>{track.artist || 'Unknown artist'}</div>
        </div>
        <div style={{ ...ellipsis, flex: 1.5, opacity: 0.7 }}>{track.album || '–'}</div>
        <button
          className="icon-btn"
          title={isFavourite ? 'Remove from Favourites' : 'Add to Favourites'}
          onClick={(e) => {
            e.stopPropagation()
            favourites.toggle(track.id)
          }}
          style={{ color: isFavourite ? '#f87171' : undefined, opacity: isFavourite ? 1 : 0.5 }}
        >
          <Heart filled={isFavourite} />
        </button>
        <button
          className="icon-btn"
          title="Edit tags and artwork"
          onClick={(e) => {
            e.stopPropagation()
            tagEditor.open(track)
          }}
          style={{ opacity: 0.6 }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
        <AddToPlaylistButton track={track} />
        <div style={{ width: 50, textAlign: 'right', opacity: 0.7 }}>
          {formatDuration(track.duration)}
        </div>
        {onRemove && (
          <button
            className="icon-btn"
            title="Remove from this playlist"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(track)
            }}
            style={{ opacity: 0.6 }}
          >
            <CrossIcon />
          </button>
        )}
      </div>
    )
  })
}

export default TrackList
