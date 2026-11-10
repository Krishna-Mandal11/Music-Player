import { useState } from 'react'

const button = {
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13
}

const PRESETS = [15, 30, 45, 60, 90]

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatRemaining(ms) {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

function SleepTimerPage({ sleep, player }) {
  const [custom, setCustom] = useState('')
  const waitingForSongEnd = player.stopAfterTrack

  function startCustom() {
    const minutes = Number(custom)
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720) return
    sleep.startMinutes(Math.round(minutes))
    setCustom('')
  }

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 16px' }}>Sleep Timer</h2>

      {sleep.active && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 40, fontWeight: 600 }}>{formatRemaining(sleep.remainingMs)}</div>
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            Music will pause when the timer reaches zero.
          </p>
          <button style={button} onClick={sleep.cancel}>
            Cancel timer
          </button>
        </div>
      )}

      {waitingForSongEnd && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 14 }}>Music will pause when the current song ends.</p>
          <button style={button} onClick={sleep.cancel}>
            Cancel timer
          </button>
        </div>
      )}

      <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 8px' }}>
        {sleep.active || waitingForSongEnd ? 'Start a different timer:' : 'Pause playback after:'}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {PRESETS.map((minutes) => (
          <button key={minutes} style={button} onClick={() => sleep.startMinutes(minutes)}>
            {minutes} min
          </button>
        ))}
        <button style={button} onClick={sleep.startAfterTrack}>
          End of this song
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number"
          min="1"
          max="720"
          placeholder="Custom minutes"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && startCustom()}
          style={{
            width: 150,
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.06)',
            color: 'inherit'
          }}
        />
        <button style={button} onClick={startCustom}>
          Start
        </button>
      </div>
    </div>
  )
}

export default SleepTimerPage
