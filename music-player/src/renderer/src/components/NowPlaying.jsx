import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import ArtThumb from './ArtThumb'
import { AddToPlaylistButton } from './TrackList'
import { useLyrics } from '../useLyrics'
import OnlineLyricsButton from './OnlineLyricsButton'

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

function Heart({ filled }) {
  return (
    <svg
      width="20"
      height="20"
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

function NowPlaying({ player, favourites, onClose }) {
  const { track, queue, index, shuffle, repeat, playing, currentTime, duration, volume, muted } =
    player
  const total = duration || (track && track.duration) || 0
  const hasQueue = queue.length > 0
  const bg = useArt(track ? track.artwork : null)
  const { data, active, reload } = useLyrics(track ? track.id : null, currentTime)
  const lineRefs = useRef([])
  const lyricsRef = useRef(null)
  const [showQueue, setShowQueue] = useState(false)
  const hasLines = data && data.lines.length > 0
  const tint = (on) => ({ opacity: on ? 1 : 0.55, color: on ? '#a898ff' : undefined })
  const isFavourite = !!(track && favourites && favourites.ids.has(track.id))
  const seekFill = total ? Math.min(100, (currentTime / total) * 100) : 0
  const volumeFill = muted ? 0 : Math.round(volume * 100)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (showQueue) setShowQueue(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, showQueue])

  // scroll only the lyrics box (never the whole page)
  useEffect(() => {
    const box = lyricsRef.current
    const el = active >= 0 ? lineRefs.current[active] : null
    if (!box || !el) return
    const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2
    box.scrollTo({ top, behavior: 'smooth' })
  }, [active, data])

  // new song: start the lyrics at the top
  useEffect(() => {
    if (lyricsRef.current) lyricsRef.current.scrollTop = 0
    lineRefs.current = []
  }, [track ? track.id : null])

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

          {track && (
            <div className="np-actions">
              <button
                className="icon-btn"
                title={isFavourite ? 'Remove from Favourites' : 'Add to Favourites'}
                onClick={() => favourites && favourites.toggle(track.id)}
                style={{
                  color: isFavourite ? '#f87171' : undefined,
                  opacity: isFavourite ? 1 : 0.75
                }}
              >
                <Heart filled={isFavourite} />
              </button>
              <AddToPlaylistButton track={track} />
              <button
                className="icon-btn"
                title="Queue"
                onClick={() => setShowQueue((v) => !v)}
                style={{ opacity: showQueue ? 1 : 0.75, color: showQueue ? '#a898ff' : undefined }}
              >
                <Icon name="queue" />
              </button>

              {showQueue && (
                <>
                  <div className="np-backdrop" onClick={() => setShowQueue(false)} />
                  <div className="np-queue">
                    <div style={{ padding: '4px 8px 8px', opacity: 0.7, fontSize: 13 }}>
                      Queue · {queue.length} track{queue.length === 1 ? '' : 's'}
                    </div>
                    {queue.map((t, i) => (
                      <div
                        key={`${t.id}-${i}`}
                        className={i === index ? 'queue-row current' : 'queue-row'}
                        onClick={() => player.jumpTo(i)}
                      >
                        <ArtThumb file={t.artwork} size={32} />
                        <div style={{ minWidth: 0, fontSize: 13 }}>
                          <div style={ellipsis}>{t.title}</div>
                          <div style={{ ...ellipsis, opacity: 0.6 }}>
                            {t.artist || 'Unknown artist'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="np-seek">
            <span className="time">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={total}
              step="0.1"
              value={Math.min(currentTime, total)}
              style={{ '--fill': `${seekFill}%` }}
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

          <div className="np-volume">
            <button
              className="icon-btn"
              onClick={player.toggleMute}
              title={muted ? 'Unmute' : 'Mute'}
              style={{ opacity: muted ? 0.4 : 0.8 }}
            >
              <Icon name="volume" />
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volumeFill}
              style={{ '--fill': `${volumeFill}%` }}
              onChange={(e) => player.setVolume(Number(e.target.value) / 100)}
            />
          </div>
        </div>

        <div className="np-right">
          {track && data === null && <div className="np-empty">Looking for lyrics…</div>}
          {track && data && !hasLines && (
            <div className="np-empty">
              No lyrics for this song.
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                Save a .lrc file with the same name next to the song, or search online.
              </div>
              <OnlineLyricsButton trackId={track.id} onDone={reload} />
            </div>
          )}
          {hasLines && !data.synced && (
            <div className="np-note">
              These lyrics have no timestamps, so they can't follow the song.
              <OnlineLyricsButton trackId={track.id} onDone={reload} />
            </div>
          )}
          {hasLines && (
            <div className="np-lyrics" ref={lyricsRef}>
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
