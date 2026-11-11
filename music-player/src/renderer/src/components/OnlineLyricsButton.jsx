import { useState } from 'react'

function OnlineLyricsButton({ trackId, onDone }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function handleClick() {
    if (
      !window.confirm(
        "Search online for synced lyrics?\n\nOnly this song's title, artist, album and length are sent. If found, a .lrc file is saved next to the song."
      )
    ) {
      return
    }
    setBusy(true)
    setMessage('')
    let result
    try {
      result = await window.api.fetchOnlineLyrics(trackId)
    } catch (err) {
      result = { ok: false, error: err.message }
    }
    setBusy(false)
    if (result.ok) onDone()
    else setMessage(result.error)
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button className="glass-btn" onClick={handleClick} disabled={busy}>
        {busy ? 'Searching…' : 'Search online'}
      </button>
      {message && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>{message}</div>}
    </div>
  )
}

export default OnlineLyricsButton
