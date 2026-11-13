import { useEffect, useState } from 'react'

function LyricsVersionsDialog({ track, onClose, onSaved }) {
  const [state, setState] = useState({ loading: true })
  const [savingToken, setSavingToken] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    window.api
      .searchLyricsCandidates(track.id)
      .then((result) => {
        if (alive) setState({ loading: false, ...result })
      })
      .catch((err) => {
        if (alive) setState({ loading: false, ok: false, error: err.message })
      })
    return () => {
      alive = false
    }
  }, [track.id])

  async function use(candidate) {
    setSavingToken(candidate.token)
    setError('')
    let result
    try {
      result = await window.api.saveLyricsCandidate(track.id, candidate.token)
    } catch (err) {
      result = { ok: false, error: err.message }
    }
    setSavingToken(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSaved(result)
  }

  return (
    <div className="lv-backdrop" onClick={onClose}>
      <div className="lv-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px' }}>Pick a lyrics version</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, opacity: 0.6 }}>
          {track.title} · {track.artist || 'Unknown artist'}
        </p>

        {state.loading && (
          <p style={{ fontSize: 13, opacity: 0.7 }}>Searching LRCLIB and NetEase…</p>
        )}
        {!state.loading && !state.ok && (
          <p style={{ fontSize: 13, color: '#ff8a8a' }}>{state.error}</p>
        )}
        {!state.loading && state.ok && state.candidates.length === 0 && (
          <p style={{ fontSize: 13, opacity: 0.75 }}>No matching lyrics were found.</p>
        )}
        {!state.loading && state.ok && state.failed.length > 0 && (
          <p style={{ fontSize: 12, opacity: 0.6 }}>
            {state.failed.join(', ')} could not be reached, so its results are missing.
          </p>
        )}

        <div className="lv-list">
          {!state.loading &&
            state.ok &&
            state.candidates.map((c) => (
              <div key={c.token} className="lv-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="lv-head">
                    <span className="lv-badge">{c.source}</span>
                    {c.best && <span className="lv-badge best">Best match</span>}
                    <span className="lv-badge">{c.script}</span>
                    {!c.synced && <span className="lv-badge warn">No timestamps</span>}
                  </div>
                  <div className="lv-title">
                    {c.title || '(untitled)'}
                    <span> · {c.artist || 'Unknown artist'}</span>
                  </div>
                  <div className="lv-meta">
                    {c.durationDiff === null
                      ? 'Length unknown'
                      : c.durationDiff === 0
                        ? 'Same length'
                        : `${c.durationDiff}s length difference`}
                    {' · '}
                    {c.lineCount} lines
                  </div>
                  {c.preview && <div className="lv-preview">{c.preview}</div>}
                </div>
                <button
                  className="glass-btn"
                  disabled={savingToken !== null}
                  onClick={() => use(c)}
                >
                  {savingToken === c.token ? 'Saving…' : 'Use this'}
                </button>
              </div>
            ))}
        </div>

        {error && <p style={{ fontSize: 13, color: '#ff8a8a' }}>{error}</p>}
        <p style={{ fontSize: 11, opacity: 0.5, margin: '12px 0 0' }}>
          An existing .lrc file is kept as .lrc.bak when you replace it.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button className="glass-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default LyricsVersionsDialog
