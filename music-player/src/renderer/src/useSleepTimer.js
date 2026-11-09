import { useCallback, useEffect, useRef, useState } from 'react'

export function useSleepTimer(player) {
  const [endsAt, setEndsAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const { pause, setStopAfterTrack } = player
  const pauseRef = useRef(pause)
  pauseRef.current = pause

  useEffect(() => {
    if (endsAt === null) return
    const timer = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= endsAt) {
        pauseRef.current()
        setEndsAt(null)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [endsAt])

  const startMinutes = useCallback(
    (minutes) => {
      setStopAfterTrack(false)
      const t = Date.now()
      setNow(t)
      setEndsAt(t + minutes * 60000)
    },
    [setStopAfterTrack]
  )

  const startAfterTrack = useCallback(() => {
    setEndsAt(null)
    setStopAfterTrack(true)
  }, [setStopAfterTrack])

  const cancel = useCallback(() => {
    setEndsAt(null)
    setStopAfterTrack(false)
  }, [setStopAfterTrack])

  return {
    active: endsAt !== null,
    remainingMs: endsAt === null ? 0 : Math.max(0, endsAt - now),
    startMinutes,
    startAfterTrack,
    cancel
  }
}
