import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import ArtThumb from './ArtThumb'
import { AddToPlaylistButton } from './TrackList'
import { useLyrics } from '../useLyrics'
import { useTagEditor } from '../TagEditorContext'
import OnlineLyricsButton, { confirmOnlineSearch } from './OnlineLyricsButton'
import LyricsVersionsDialog from './LyricsVersionsDialog'

const cache = new Map()
const DEFAULT_ACCENT = '124,92,255'
const TIMER_PRESETS = [15, 30, 45, 60]

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

// a bright, saturated color taken from the cover
function useAccent(src) {
  const [color, setColor] = useState(DEFAULT_ACCENT)
  useEffect(() => {
    let alive = true
    if (!src) {
      setColor(DEFAULT_ACCENT)
      return undefined
    }
    const img = new Image()
    img.onload = () => {
      try {
        const size = 24
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, size, size)
        const d = ctx.getImageData(0, 0, size, size).data
        let r = 0
        let g = 0
        let b = 0
        let w = 0
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2])
          const min = Math.min(d[i], d[i + 1], d[i + 2])
          const sat = max ? (max - min) / max : 0
          const weight = sat * sat + 0.02
          r += d[i] * weight
          g += d[i + 1] * weight
          b += d[i + 2] * weight
          w += weight
        }
        r /= w
        g /= w
        b /= w
        const top = Math.max(r, g, b)
        if (top > 0 && top < 170) {
          const k = 170 / top
          r *= k
          g *= k
          b *= k
        }
        r = Math.min(255, r * 0.8 + 255 * 0.2)
        g = Math.min(255, g * 0.8 + 255 * 0.2)
        b = Math.min(255, b * 0.8 + 255 * 0.2)
        if (alive) setColor(`${Math.round(r)},${Math.round(g)},${Math.round(b)}`)
      } catch {
        if (alive) setColor(DEFAULT_ACCENT)
      }
    }
    img.onerror = () => {
      if (alive) setColor(DEFAULT_ACCENT)
    }
    img.src = src
    return () => {
      alive = false
    }
  }, [src])
  return color
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

function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

function FocusIcon({ on }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {on ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </svg>
  )
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function NowPlaying({ player, favourites, sleep, onNavigate, onClose }) {
  const { track, queue, index, shuffle, repeat, playing, currentTime, duration, volume, muted } =
    player
  const tagEditor = useTagEditor()
  const total = duration || (track && track.duration) || 0
  const hasQueue = queue.length > 0
  const bg = useArt(track ? track.artwork : null)
  const accent = useAccent(bg)
  const { data, active, reload } = useLyrics(track ? track.id : null, currentTime)
  const lineRefs = useRef([])
  const lyricsRef = useRef(null)
  const [showQueue, setShowQueue] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [focus, setFocus] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')
  const hasLines = data && data.lines.length > 0
  const synced = !!(data && data.synced)
  const tint = (on) => ({ opacity: on ? 1 : 0.55, color: on ? '#a898ff' : undefined })
  const isFavourite = !!(track && favourites && favourites.ids.has(track.id))
  const seekFill = total ? Math.min(100, (currentTime / total) * 100) : 0
  const volumeFill = muted ? 0 : Math.round(volume * 100)
  const timerOn = !!(sleep && (sleep.active || player.stopAfterTrack))

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (showVersions) setShowVersions(false)
      else if (showMenu) setShowMenu(false)
      else if (showQueue) setShowQueue(false)
      else if (focus) setFocus(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, showQueue, showMenu, showVersions, focus])

  // scroll only the lyrics box (never the whole page)
  useEffect(() => {
    const box = lyricsRef.current
    const el = active >= 0 ? lineRefs.current[active] : null
    if (!box || !el) return
    const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2
    box.scrollTo({ top, behavior: 'smooth' })
  }, [active, data, focus])

  // new song: start the lyrics at the top
  useEffect(() => {
    if (lyricsRef.current) lyricsRef.current.scrollTop = 0
    lineRefs.current = []
  }, [track ? track.id : null])

  function startCustom() {
    const minutes = Math.round(Number(customMinutes))
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720) return
    sleep.startMinutes(minutes)
    setCustomMinutes('')
  }

  function openVersions() {
    setShowMenu(false)
    if (confirmOnlineSearch()) setShowVersions(true)
  }

  function lineStyle(i) {
    if (!synced) return { opacity: 0.9 }
    const ref = active < 0 ? -1 : active
    const dist = Math.abs(i - ref)
    if (i === active) return { opacity: 1, cursor: 'pointer' }
    return {
      opacity: Math.max(0.16, 0.62 - dist * 0.13),
      filter: dist <= 6 ? `blur(${Math.min(dist, 5) * 0.7}px)` : undefined,
      cursor: 'pointer'
    }
  }

  function fillPercent(i) {
    if (!synced || i !== active) return 0
    const line = data.lines[i]
    const next = data.lines[i + 1]
    const gap = next ? next.time - line.time : 5
    const span = Math.max(0.5, Math.min(gap, 6) * 0.9)
    return Math.max(0, Math.min(100, ((currentTime - line.time) / span) * 100))
  }

  return (
    <div
      className={focus ? 'np-overlay focus' : 'np-overlay'}
      style={{ '--np-accent': `rgb(${accent})`, '--np-accent-soft': `rgba(${accent},0.35)` }}
    >
      {bg && <div className="np-bg" style={{ backgroundImage: `url(${bg})` }} />}
      <div className="np-shade" />
      <div className="np-glow" />

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

      <button
        className="icon-btn np-focus-btn"
        onClick={() => setFocus((v) => !v)}
        title={focus ? 'Show player' : 'Lyrics only'}
      >
        <FocusIcon on={focus} />
      </button>

      {focus && track && (
        <div className="np-focus-title">
          {track.title}
          <span> · {track.artist || 'Unknown artist'}</span>
        </div>
      )}

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
                onClick={() => {
                  setShowQueue((v) => !v)
                  setShowMenu(false)
                }}
                style={{ opacity: showQueue ? 1 : 0.75, color: showQueue ? '#a898ff' : undefined }}
              >
                <Icon name="queue" />
              </button>
              <button
                className="icon-btn"
                title="More"
                onClick={() => {
                  setShowMenu((v) => !v)
                  setShowQueue(false)
                }}
                style={{
                  opacity: showMenu || timerOn ? 1 : 0.75,
                  color: showMenu || timerOn ? '#a898ff' : undefined
                }}
              >
                <MoreIcon />
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

              {showMenu && (
                <>
                  <div className="np-backdrop" onClick={() => setShowMenu(false)} />
                  <div className="np-menu">
                    <div className="np-menu-title">Sleep timer</div>
                    {timerOn && (
                      <div className="np-menu-status">
                        {sleep.active
                          ? `Pauses in ${formatTime(sleep.remainingMs / 1000)}`
                          : 'Pauses when this song ends'}
                        <button className="np-chip" onClick={sleep.cancel}>
                          Cancel
                        </button>
                      </div>
                    )}
                    <div className="np-chips">
                      {TIMER_PRESETS.map((m) => (
                        <button key={m} className="np-chip" onClick={() => sleep.startMinutes(m)}>
                          {m} min
                        </button>
                      ))}
                      <button className="np-chip" onClick={sleep.startAfterTrack}>
                        End of song
                      </button>
                    </div>
                    <div className="np-custom">
                      <input
                        type="number"
                        min="1"
                        max="720"
                        placeholder="Custom minutes"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') startCustom()
                          e.stopPropagation()
                        }}
                      />
                      <button className="np-chip" onClick={startCustom}>
                        Start
                      </button>
                    </div>

                    <div className="np-menu-sep" />

                    <button
                      className="np-menu-item"
                      onClick={() => {
                        onNavigate('equalizer')
                        onClose()
                      }}
                    >
                      Equalizer…
                    </button>
                    <button
                      className="np-menu-item"
                      onClick={() => {
                        setFocus(true)
                        setShowMenu(false)
                      }}
                    >
                      Lyrics only view
                    </button>
                    <button className="np-menu-item" onClick={openVersions}>
                      Find lyrics online…
                    </button>
                    <button
                      className="np-menu-item"
                      onClick={() => {
                        setShowMenu(false)
                        tagEditor.open(track)
                      }}
                    >
                      Edit tags and cover…
                    </button>
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
              <OnlineLyricsButton trackId={track.id} onDone={reload} onPick={openVersions} />
            </div>
          )}
          {hasLines && !synced && (
            <div className="np-note">
              These lyrics have no timestamps, so they can't follow the song.
              <OnlineLyricsButton trackId={track.id} onDone={reload} onPick={openVersions} />
            </div>
          )}
          {hasLines && (
            <div className={synced ? 'np-lyrics synced' : 'np-lyrics'} ref={lyricsRef}>
              {data.lines.map((line, i) => {
                const isActive = i === active
                return (
                  <div
                    key={i}
                    ref={(el) => {
                      lineRefs.current[i] = el
                    }}
                    onClick={synced ? () => player.seek(line.time) : undefined}
                    className={isActive ? 'np-line active' : 'np-line'}
                    style={lineStyle(i)}
                  >
                    <span
                      className={isActive && synced ? 'np-fill' : undefined}
                      style={isActive && synced ? { '--p': `${fillPercent(i)}%` } : undefined}
                    >
                      {line.text || '♪'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showVersions && track && (
        <LyricsVersionsDialog
          key={track.id}
          track={track}
          onClose={() => setShowVersions(false)}
          onSaved={() => {
            setShowVersions(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

export default NowPlaying
