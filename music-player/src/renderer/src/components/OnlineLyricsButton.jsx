import { useState } from 'react'

export function confirmOnlineSearch() {
  return window.confirm(
    "Search online for lyrics?\n\nOnly this song's title, artist, album and length are sent to LRCLIB and NetEase Cloud Music. Nothing is saved without your choice or a good match."
  )
}

function OnlineLyricsButton({ trackId, onDone, onPick }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function handleClick() {
    if (!confirmOnlineSearch()) return
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
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="glass-btn" onClick={handleClick} disabled={busy}>
          {busy ? 'Searching…' : 'Search online'}
        </button>
        {onPick && (
          <button className="glass-btn" onClick={onPick} disabled={busy}>
            Pick a version…
          </button>
        )}
      </div>
      {message && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>{message}</div>}
    </div>
  )
}

export default OnlineLyricsButton
