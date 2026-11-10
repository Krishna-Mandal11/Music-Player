import { useState } from 'react'
import Icon from './Icon'
import ArtThumb from './ArtThumb'

function formatTime(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function PauseIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function PlayerBar({ player, onOpenNowPlaying }) {
  const {
    track,
    queue,
    index,
    shuffle,
    repeat,
    playing,
    currentTime,
    duration,
    volume,
    muted,
    error
  } = player
  const [showQueue, setShowQueue] = useState(false)
  const total = duration || track?.duration || 0
  const hasQueue = queue.length > 0
  const active = (on) => ({ opacity: on ? 1 : 0.5, color: on ? '#a898ff' : undefined })

  return (
    <footer className="player-bar">
      <div
        className={track ? 'player-track clickable' : 'player-track'}
        onClick={track ? onOpenNowPlaying : undefined}
        title={track ? 'Open Now Playing' : undefined}
      >
        <div className="player-artwork">
          <ArtThumb file={track ? track.artwork : null} size={64} />
        </div>
        <div className="player-track-text">
          <div className="player-title">{track ? track.title : 'Nothing playing'}</div>
          <div className="player-artist">
            {error || (track ? track.artist || 'Unknown artist' : 'Click a song to play it')}
          </div>
        </div>
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button
            className="icon-btn"
            onClick={player.toggleShuffle}
            title={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
            style={active(shuffle)}
          >
            <Icon name="shuffle" />
          </button>
          <button
            className="icon-btn"
            disabled={!hasQueue}
            onClick={player.previous}
            title="Previous"
          >
            <Icon name="prev" size={24} />
          </button>
          <button
            className="icon-btn play-btn"
            disabled={!track}
            onClick={player.toggle}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon size={28} /> : <Icon name="play" size={28} />}
          </button>
          <button className="icon-btn" disabled={!hasQueue} onClick={player.next} title="Next">
            <Icon name="next" size={24} />
          </button>
          <button
            className="icon-btn"
            onClick={player.cycleRepeat}
            title={`Repeat: ${repeat}`}
            style={{ ...active(repeat !== 'off'), position: 'relative' }}
          >
            <Icon name="repeat" />
            {repeat === 'one' && (
              <span
                style={{ position: 'absolute', top: 2, right: 2, fontSize: 10, fontWeight: 700 }}
              >
                1
              </span>
            )}
          </button>
        </div>
        <div className="player-seek">
          <span className="time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={total}
            step="0.1"
            value={Math.min(currentTime, total)}
            disabled={!track}
            onChange={(e) => player.seek(Number(e.target.value))}
          />
          <span className="time">{formatTime(total)}</span>
        </div>
      </div>

      <div className="player-right">
        <button
          className="icon-btn"
          onClick={() => setShowQueue((v) => !v)}
          title="Queue"
          style={active(showQueue)}
        >
          <Icon name="queue" />
        </button>
        <button
          className="icon-btn"
          onClick={player.toggleMute}
          title={muted ? 'Unmute' : 'Mute'}
          style={{ opacity: muted ? 0.4 : 1 }}
        >
          <Icon name="volume" />
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={muted ? 0 : Math.round(volume * 100)}
          onChange={(e) => player.setVolume(Number(e.target.value) / 100)}
        />
      </div>

      {showQueue && (
        <div className="queue-panel">
          <div style={{ padding: '4px 8px 8px', opacity: 0.7 }}>
            Queue · {queue.length} track{queue.length === 1 ? '' : 's'}
          </div>
          {queue.length === 0 && (
            <div style={{ padding: 8, opacity: 0.6 }}>
              The queue is empty. Click a song to start.
            </div>
          )}
          {queue.map((t, i) => (
            <div
              key={`${t.id}-${i}`}
              className={i === index ? 'queue-row current' : 'queue-row'}
              onClick={() => player.jumpTo(i)}
            >
              <ArtThumb file={t.artwork} size={32} />
              <div style={{ minWidth: 0 }}>
                <div style={ellipsis}>{t.title}</div>
                <div style={{ ...ellipsis, opacity: 0.6 }}>{t.artist || 'Unknown artist'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </footer>
  )
}

export default PlayerBar
