import { useEffect, useState } from 'react'

const cache = new Map()

function NoteIcon({ size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  )
}

function ArtThumb({ file, size = 40 }) {
  const [src, setSrc] = useState(file && cache.has(file) ? cache.get(file) : null)
  const [done, setDone] = useState(!file || cache.has(file))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setFailed(false)
    if (!file) {
      setSrc(null)
      setDone(true)
      return undefined
    }
    if (cache.has(file)) {
      setSrc(cache.get(file))
      setDone(true)
      return undefined
    }
    setDone(false)
    window.api.getArtwork(file).then((url) => {
      cache.set(file, url)
      if (alive) {
        setSrc(url)
        setDone(true)
      }
    })
    return () => {
      alive = false
    }
  }, [file])

  const radius = size >= 80 ? 16 : size >= 48 ? 10 : 8
  const box = { width: size, height: size, borderRadius: radius, flexShrink: 0 }

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        style={{ ...box, objectFit: 'cover' }}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div
      style={{
        ...box,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.55)',
        background: 'linear-gradient(135deg, rgba(124,92,255,0.28), rgba(255,255,255,0.06))',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)'
      }}
    >
      {(done || failed) && <NoteIcon size={Math.round(size * 0.45)} />}
    </div>
  )
}

export default ArtThumb
