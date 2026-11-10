import { useEffect, useRef, useState } from 'react'

const NONE = { source: null, synced: false, lines: [] }

const SOURCE_LABEL = {
  lrc: 'From the .lrc file next to the song',
  embedded: 'From the tags inside the song file'
}

function LyricsPage({ player }) {
  const { track, currentTime } = player
  const trackId = track ? track.id : null
  const [data, setData] = useState(null)
  const lineRefs = useRef([])

  useEffect(() => {
    let alive = true
    setData(null)
    lineRefs.current = []
    if (trackId === null) return undefined
    window.api
      .getLyrics(trackId)
      .then((result) => {
        if (alive) setData(result)
      })
      .catch(() => {
        if (alive) setData(NONE)
      })
    return () => {
      alive = false
    }
  }, [trackId])

  let active = -1
  if (data && data.synced) {
    for (let i = 0; i < data.lines.length; i++) {
      if (data.lines[i].time <= currentTime + 0.05) active = i
      else break
    }
  }

  useEffect(() => {
    if (active < 0) return
    const el = lineRefs.current[active]
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [active, data])

  const hasLines = data && data.lines.length > 0

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 4px' }}>Lyrics</h2>

      {!track && <p style={{ fontSize: 13, opacity: 0.7 }}>Play a song to see its lyrics here.</p>}

      {track && (
        <p style={{ margin: '0 0 4px', fontSize: 13, opacity: 0.8 }}>
          {track.title}
          {track.artist ? ` · ${track.artist}` : ''}
        </p>
      )}

      {track && data === null && <p style={{ fontSize: 13, opacity: 0.6 }}>Looking for lyrics…</p>}

      {track && data && !hasLines && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          No lyrics found for this song. To add some, save a .lrc file with the same name next to
          the song file (for example Song.flac and Song.lrc).
        </p>
      )}

      {hasLines && (
        <>
          <p style={{ margin: '0 0 20px', fontSize: 12, opacity: 0.55 }}>
            {SOURCE_LABEL[data.source]}
            {data.synced ? ' · click a line to jump to it' : ' · not synchronized'}
          </p>
          <div style={{ maxWidth: 700, paddingBottom: '40vh' }}>
            {data.lines.map((line, i) => {
              const isActive = i === active
              return (
                <div
                  key={i}
                  ref={(el) => {
                    lineRefs.current[i] = el
                  }}
                  onClick={data.synced ? () => player.seek(line.time) : undefined}
                  style={{
                    padding: '6px 0',
                    minHeight: 20,
                    fontSize: isActive ? 24 : 18,
                    fontWeight: isActive ? 700 : 400,
                    opacity: data.synced ? (isActive ? 1 : 0.4) : 0.9,
                    cursor: data.synced ? 'pointer' : 'default',
                    transition: 'font-size 0.2s, opacity 0.2s',
                    userSelect: 'text'
                  }}
                >
                  {line.text || '♪'}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default LyricsPage
