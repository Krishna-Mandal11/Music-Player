import { useEffect, useState } from 'react'

const cache = new Map()

function ArtThumb({ file, size = 40 }) {
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

  const box = {
    width: size,
    height: size,
    borderRadius: 4,
    background: 'rgba(255,255,255,0.08)',
    objectFit: 'cover',
    flexShrink: 0
  }
  return src ? <img src={src} alt="" style={box} /> : <div style={box} />
}

export default ArtThumb
