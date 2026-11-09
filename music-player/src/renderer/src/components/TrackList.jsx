import ArtThumb from './ArtThumb'

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

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function TrackList({ tracks, player, favourites }) {
  return tracks.map((track) => {
    const isCurrent = player.track && player.track.id === track.id
    const isFavourite = favourites.ids.has(track.id)
    return (
      <div
        key={track.id}
        onClick={() => player.play(track, tracks)}
        title="Click to play"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 8px',
          margin: '0 -8px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
          background: isCurrent ? 'rgba(255,255,255,0.08)' : 'transparent'
        }}
      >
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
        <div style={{ width: 50, textAlign: 'right', opacity: 0.7 }}>
          {formatDuration(track.duration)}
        </div>
      </div>
    )
  })
}

export default TrackList
