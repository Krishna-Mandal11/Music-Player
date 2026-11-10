import { useEffect, useState } from 'react'
import ArtThumb from './ArtThumb'

const button = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13
}

const input = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.06)',
  color: 'inherit',
  fontSize: 13,
  userSelect: 'text'
}

const TEXT = [
  ['title', 'Title'],
  ['artist', 'Artist'],
  ['album', 'Album'],
  ['albumArtist', 'Album artist'],
  ['genre', 'Genre'],
  ['composer', 'Composer']
]
const NUMBERS = [
  ['year', 'Year'],
  ['trackNo', 'Track no.'],
  ['discNo', 'Disc no.']
]

function Label({ text, children }) {
  return (
    <label style={{ display: 'block', fontSize: 12, opacity: 0.9 }}>
      <div style={{ opacity: 0.7, marginBottom: 3 }}>{text}</div>
      {children}
    </label>
  )
}

function TagEditorDialog({ track, onClose }) {
  const [info, setInfo] = useState(null)
  const [values, setValues] = useState(null)
  const [art, setArt] = useState({ action: 'keep' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    window.api.getTagInfo(track.id).then((result) => {
      if (!alive) return
      setInfo(result)
      if (result.ok) {
        const f = result.fields
        setValues({
          title: f.title,
          artist: f.artist,
          album: f.album,
          albumArtist: f.albumArtist,
          genre: f.genre,
          composer: f.composer,
          year: f.year ? String(f.year) : '',
          trackNo: f.trackNo ? String(f.trackNo) : '',
          discNo: f.discNo ? String(f.discNo) : ''
        })
      }
    })
    return () => {
      alive = false
    }
  }, [track.id])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  function set(key, value) {
    setValues((v) => ({ ...v, [key]: value }))
    setError('')
  }

  async function chooseImage() {
    setError('')
    const result = await window.api.pickArtwork()
    if (result.canceled) return
    if (!result.ok) {
      setError(result.error)
      return
    }
    setArt({ action: 'replace', token: result.token, preview: result.preview })
  }

  async function handleSave() {
    if (
      !window.confirm(
        'Write these changes into the song file?\n\nA backup copy of the file is made first.'
      )
    ) {
      return
    }
    setSaving(true)
    setError('')
    let result
    try {
      result = await window.api.saveTags({
        id: track.id,
        fields: values,
        artwork: { action: art.action, token: art.token }
      })
    } catch (err) {
      result = { ok: false, error: err.message }
    }
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onClose()
  }

  const artBox = {
    width: 96,
    height: 96,
    borderRadius: 6,
    background: 'rgba(255,255,255,0.08)',
    objectFit: 'cover',
    flexShrink: 0
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: '94vw',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: 20,
          borderRadius: 10,
          border: '1px solid #33333d',
          background: '#1a1a22',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
        }}
      >
        <h3 style={{ margin: '0 0 4px' }}>Edit tags</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, opacity: 0.6, wordBreak: 'break-all' }}>
          {info && info.ok ? info.fileName : track.title}
        </p>

        {!info && <p style={{ fontSize: 13, opacity: 0.7 }}>Reading tags…</p>}
        {info && !info.ok && <p style={{ fontSize: 13, color: '#ff6b6b' }}>{info.error}</p>}

        {info && info.ok && values && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {art.action === 'replace' ? (
                <img src={art.preview} alt="" style={artBox} />
              ) : art.action === 'remove' ? (
                <div
                  style={{
                    ...artBox,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    opacity: 0.7,
                    textAlign: 'center',
                    padding: 6,
                    boxSizing: 'border-box'
                  }}
                >
                  Cover will be removed
                </div>
              ) : (
                <ArtThumb file={track.artwork} size={96} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Cover image</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button style={button} onClick={chooseImage} disabled={saving}>
                    Choose image…
                  </button>
                  {art.action === 'keep' && info.hasArtwork && (
                    <button
                      style={button}
                      onClick={() => setArt({ action: 'remove' })}
                      disabled={saving}
                    >
                      Remove cover
                    </button>
                  )}
                  {art.action !== 'keep' && (
                    <button
                      style={button}
                      onClick={() => setArt({ action: 'keep' })}
                      disabled={saving}
                    >
                      Undo cover change
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 11, opacity: 0.55 }}>JPEG or PNG, up to 8 MB.</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {TEXT.map(([key, label]) => (
                <div key={key} style={key === 'title' ? { gridColumn: '1 / -1' } : undefined}>
                  <Label text={label}>
                    <input
                      style={input}
                      value={values[key]}
                      maxLength={300}
                      disabled={saving}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </Label>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
                marginTop: 12
              }}
            >
              {NUMBERS.map(([key, label]) => (
                <Label key={key} text={label}>
                  <input
                    style={input}
                    inputMode="numeric"
                    value={values[key]}
                    maxLength={4}
                    disabled={saving}
                    onChange={(e) => set(key, e.target.value.replace(/\D/g, ''))}
                  />
                </Label>
              ))}
            </div>

            <p style={{ margin: '12px 0 0', fontSize: 11, opacity: 0.55 }}>
              Only the fields you change are written to the file. Leave a box empty to clear it.
            </p>
          </>
        )}

        {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: '#ff6b6b' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          {info && info.ok && (
            <button
              style={{ ...button, background: 'var(--accent)', borderColor: 'var(--accent)' }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default TagEditorDialog
