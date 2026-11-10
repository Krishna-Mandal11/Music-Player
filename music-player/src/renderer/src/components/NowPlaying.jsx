import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import ArtThumb from './ArtThumb'
import { useLyrics } from '../useLyrics'

const cache = new Map()

function useArt(file) {
  const [src, setSrc] = useState(file && cache.has(file) ? cache.get(file) : null)
  useEffect(() => {
    let alive = true
    if (!file) {
      setSrc(null)
      return undefined
    }
    if (cache.has(file)) {
      setSrc(cache.get(file))
      return undefined
    }
    window.api.getArtwork(file).then((url) => {
      cache.set(file, url)
      if (alive) setSrc(url)
    })
    return () => {
      alive = false
    }
  }, [file])
  return src
}

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

function NowPlaying({ player, onClose }) {
  const { track, queue, shuffle, repeat, playing, currentTime, duration } = player
  const total = duration || (track && track.duration) || 0
  const hasQueue = queue.length > 0
  const bg = useArt(track ? track.artwork : null)
  const { data, active } = useLyrics(track ? track.id : null, currentTime)
  const lineRefs = useRef([])
  const hasLines = data && data.lines.length > 0
  const tint = (on) => ({ opacity: on ? 1 : 0.55, color: on ? '#a898ff' : undefined })

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (active < 0) return
    const el = lineRefs.current[active]
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [active, data])

  return (
    <div className="np-overlay">
      {bg && <div className="np-bg" style={{ backgroundImage: `url(${bg})` }} />}
      <div className="np-shade" />

      <button className="icon-btn np-close" onClick={onClose} title="Back (Esc)">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className="np-main">
        <div className="np-left">
          <div className="np-cover">
            <ArtThumb file={track ? track.artwork : null} size={320} />
          </div>

          <div className="np-title">{track ? track.title : 'Nothing playing'}</div>
          <div className="np-artist">{track ? track.artist || 'Unknown artist' : ''}</div>

          <div className="np-seek">
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

          <div className="np-controls">
            <button
              className="icon-btn"
              onClick={player.toggleShuffle}
              title={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
              style={tint(shuffle)}
            >
              <Icon name="shuffle" />
            </button>
            <button
              className="icon-btn"
              disabled={!hasQueue}
              onClick={player.previous}
              title="Previous"
            >
              <Icon name="prev" size={26} />
            </button>
            <button
              className="icon-btn play-btn"
              disabled={!track}
              onClick={player.toggle}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <PauseIcon size={30} /> : <Icon name="play" size={30} />}
            </button>
            <button className="icon-btn" disabled={!hasQueue} onClick={player.next} title="Next">
              <Icon name="next" size={26} />
            </button>
            <button
              className="icon-btn"
              onClick={player.cycleRepeat}
              title={`Repeat: ${repeat}`}
              style={{ ...tint(repeat !== 'off'), position: 'relative' }}
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
        </div>

        <div className="np-right">
          {track && data === null && <div className="np-empty">Looking for lyrics…</div>}
          {track && data && !hasLines && (
            <div className="np-empty">
              No lyrics for this song.
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                Save a .lrc file with the same name next to the song file to show them here.
              </div>
            </div>
          )}
          {hasLines && (
            <div className="np-lyrics">
              {data.lines.map((line, i) => {
                const isActive = i === active
                return (
                  <div
                    key={i}
                    ref={(el) => {
                      lineRefs.current[i] = el
                    }}
                    onClick={data.synced ? () => player.seek(line.time) : undefined}
                    className={isActive ? 'np-line active' : 'np-line'}
                    style={{
                      opacity: data.synced ? (isActive ? 1 : 0.4) : 0.9,
                      cursor: data.synced ? 'pointer' : 'default'
                    }}
                  >
                    {line.text || '♪'}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NowPlaying
