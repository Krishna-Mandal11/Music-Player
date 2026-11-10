import { useEffect, useState } from 'react'

const NONE = { source: null, synced: false, lines: [] }

export function useLyrics(trackId, currentTime) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    setData(null)
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

  return { data, active }
}
