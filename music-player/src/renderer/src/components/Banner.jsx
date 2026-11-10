import { useEffect, useState } from 'react'
import Icon from './Icon'

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

function Slide({ item, player, pool }) {
  const src = useArt(item.artwork)
  const isCurrent = player.track && player.track.id === item.id
  const isPlaying = isCurrent && player.playing

  function handlePlay() {
    if (isCurrent) player.toggle()
    else player.play(item, pool)
  }

  return (
    <div className="banner-slide">
      {src && <div className="banner-bg" style={{ backgroundImage: `url(${src})` }} />}
      <div className="banner-shade" />
      <div className="banner-content">
        {src && <img className="banner-cover" src={src} alt="" onClick={handlePlay} />}
        <div style={{ minWidth: 0 }}>
          <div className="banner-label">Featured</div>
          <div className="banner-title">{item.title}</div>
          <div className="banner-sub">{item.artist || 'Unknown artist'}</div>
          {item.album && (
            <div className="banner-sub" style={{ opacity: 0.55 }}>
              {item.album}
            </div>
          )}
          <button className="banner-play" onClick={handlePlay}>
            {isPlaying ? (
              <span>Pause</span>
            ) : (
              <>
                <Icon name="play" size={18} />
                <span>Play</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function Banner({ items, pool, player }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (items.length < 2 || paused) return undefined
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 6000)
    return () => clearInterval(timer)
  }, [items.length, paused])

  if (items.length === 0) return null
  const current = index % items.length

  return (
    <div
      className="banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Slide key={items[current].id} item={items[current]} player={player} pool={pool} />
      <div className="banner-dots">
        {items.map((item, i) => (
          <button
            key={item.id}
            className={i === current ? 'banner-dot active' : 'banner-dot'}
            onClick={() => setIndex(i)}
            aria-label={`Show ${item.title}`}
          />
        ))}
      </div>
    </div>
  )
}

export default Banner
