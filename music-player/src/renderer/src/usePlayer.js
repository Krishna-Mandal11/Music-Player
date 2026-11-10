import { useCallback, useEffect, useRef, useState } from 'react'
import { initEngine } from './audioEngine'
function shuffled(list, first) {
  const rest = list.filter((t) => !first || t.id !== first.id)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return first ? [first, ...rest] : rest
}

export function usePlayer() {
  const audioRef = useRef(null)
  if (!audioRef.current) {
    audioRef.current = new Audio()
    audioRef.current.crossOrigin = 'anonymous' // lets the equalizer process the audio
  }
  const saveTimer = useRef(null)
  const baseRef = useRef([]) // the queue in its original (unshuffled) order
  const latest = useRef({})
  const advanceRef = useRef(() => {})
  const recordedRef = useRef(null) // id of the last song written to history
  const stopAfterRef = useRef(false) // sleep timer: stop when the current song ends

  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(-1)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off') // 'off' | 'all' | 'one'
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [muted, setMutedState] = useState(false)
  const [error, setError] = useState('')
  const [stopAfterTrack, setStopAfterTrackState] = useState(false)

  const track = index >= 0 ? queue[index] || null : null
  latest.current = { queue, index, repeat, shuffle }

  const startTrack = useCallback((t) => {
    const audio = audioRef.current
    setError('')
    window.api.setSetting('lastTrackId', t.id)
    window.api.setSetting('lastPosition', 0)
    recordedRef.current = t.id
    window.api.recordPlay(t.id)
    setCurrentTime(0)
    setDuration(t.duration || 0)
    audio.src = `media://track/${t.id}`
    audio.play().catch((e) => console.error('play() failed:', e))
  }, [])

  const goTo = useCallback(
    (i) => {
      const t = latest.current.queue[i]
      if (!t) return
      setIndex(i)
      startTrack(t)
    },
    [startTrack]
  )

  useEffect(() => {
    const audio = audioRef.current
    audio.preload = 'auto'
    initEngine(audio)

    window.api.getAllSettings().then((s) => {
      const v = typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : 0.8
      audio.volume = v
      audio.muted = s.muted === true
      setVolumeState(v)
      setMutedState(audio.muted)
      setShuffle(s.shuffle === true)
      if (s.repeat === 'all' || s.repeat === 'one') setRepeat(s.repeat)

      // Restore the last song (loaded but not played) and its position
      if (typeof s.lastTrackId === 'number' && !audio.src) {
        Promise.all([window.api.getTrack(s.lastTrackId), window.api.getTracks('')]).then(
          ([t, lib]) => {
            if (!t || audio.src) return
            const list = lib.tracks.some((x) => x.id === t.id) ? lib.tracks : [t]
            baseRef.current = list
            const q = s.shuffle === true ? shuffled(list, t) : list
            setQueue(q)
            setIndex(q.findIndex((x) => x.id === t.id))
            setDuration(t.duration || 0)
            const pos = typeof s.lastPosition === 'number' ? s.lastPosition : 0
            audio.addEventListener(
              'loadedmetadata',
              () => {
                if (pos > 0 && pos < audio.duration) {
                  audio.currentTime = pos
                  setCurrentTime(pos)
                }
              },
              { once: true }
            )
            audio.src = `media://track/${t.id}` // loaded but not played
          }
        )
      }
    })

    const onTime = () => setCurrentTime(audio.currentTime)
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => advanceRef.current(true)
    const onError = () => {
      console.error('Audio error:', audio.error && audio.error.code, audio.src)
      setPlaying(false)
      setError('This file could not be played.')
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('loadedmetadata', onDuration)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('loadedmetadata', onDuration)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [])

  // Save the playback position every 2 seconds while playing, and on pause
  useEffect(() => {
    const audio = audioRef.current
    const timer = setInterval(() => {
      if (audio.src && !audio.paused && audio.readyState >= 1) {
        window.api.setSetting('lastPosition', audio.currentTime)
      }
    }, 2000)
    const onPause = () => {
      if (audio.src && audio.readyState >= 1) {
        window.api.setSetting('lastPosition', audio.currentTime)
      }
    }
    audio.addEventListener('pause', onPause)
    return () => {
      clearInterval(timer)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  // Moves to the next track. auto = true when a song ended by itself.
  advanceRef.current = (auto) => {
    const audio = audioRef.current
    const { queue: q, index: i, repeat: r } = latest.current
    if (q.length === 0) return
    if (auto && stopAfterRef.current) {
      stopAfterRef.current = false
      setStopAfterTrackState(false)
      audio.currentTime = 0
      setCurrentTime(0)
      return
    }
    if (auto && r === 'one') {
      audio.currentTime = 0
      audio.play().catch(() => {})
      return
    }
    if (i < q.length - 1) goTo(i + 1)
    else if (r === 'all') goTo(0)
    else if (auto) {
      audio.currentTime = 0
      setCurrentTime(0)
    }
  }

  // Click a song: the visible list becomes the queue.
  const play = useCallback(
    (t, list) => {
      const source = Array.isArray(list) && list.length > 0 ? list : [t]
      baseRef.current = source
      const q = latest.current.shuffle ? shuffled(source, t) : source
      setQueue(q)
      setIndex(q.findIndex((x) => x.id === t.id))
      startTrack(t)
    },
    [startTrack]
  )

  // Starts a whole list with its own shuffle and repeat modes (used by playlists).
  // chosen = the song to start with (or null to pick the first / a random one).
  const playList = useCallback(
    (list, chosen, modes) => {
      if (!Array.isArray(list) || list.length === 0) return
      const wantShuffle = !!modes && modes.shuffle === true
      const wantRepeat =
        modes && (modes.repeat === 'all' || modes.repeat === 'one') ? modes.repeat : 'off'
      const first =
        chosen || (wantShuffle ? list[Math.floor(Math.random() * list.length)] : list[0])

      setShuffle(wantShuffle)
      window.api.setSetting('shuffle', wantShuffle)
      setRepeat(wantRepeat)
      window.api.setSetting('repeat', wantRepeat)

      baseRef.current = list
      const q = wantShuffle ? shuffled(list, first) : list
      setQueue(q)
      setIndex(q.findIndex((x) => x.id === first.id))
      startTrack(first)
    },
    [startTrack]
  )

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio.src) return
    if (audio.paused) {
      audio.play().catch(() => {})
      const { queue: q, index: i } = latest.current
      const t = i >= 0 ? q[i] : null
      if (t && recordedRef.current !== t.id) {
        recordedRef.current = t.id
        window.api.recordPlay(t.id)
      }
    } else {
      audio.pause()
    }
  }, [])

  const pause = useCallback(() => {
    audioRef.current.pause()
  }, [])

  const setStopAfterTrack = useCallback((value) => {
    stopAfterRef.current = value
    setStopAfterTrackState(value)
  }, [])

  const next = useCallback(() => advanceRef.current(false), [])

  const previous = useCallback(() => {
    const audio = audioRef.current
    const { queue: q, index: i, repeat: r } = latest.current
    if (q.length === 0) return
    if (audio.currentTime > 3) {
      audio.currentTime = 0
    } else if (i > 0) {
      goTo(i - 1)
    } else if (r === 'all') {
      goTo(q.length - 1)
    } else {
      audio.currentTime = 0
    }
  }, [goTo])

  const toggleShuffle = useCallback(() => {
    const { queue: q, index: i, shuffle: on } = latest.current
    const value = !on
    const current = i >= 0 ? q[i] : null
    if (q.length > 0) {
      if (value) {
        setQueue(shuffled(baseRef.current, current))
        setIndex(current ? 0 : -1)
      } else {
        setQueue(baseRef.current)
        setIndex(current ? baseRef.current.findIndex((x) => x.id === current.id) : -1)
      }
    }
    setShuffle(value)
    window.api.setSetting('shuffle', value)
  }, [])

  const cycleRepeat = useCallback(() => {
    const value = { off: 'all', all: 'one', one: 'off' }[latest.current.repeat]
    setRepeat(value)
    window.api.setSetting('repeat', value)
  }, [])

  const seek = useCallback((time) => {
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }, [])

  const setVolume = useCallback((v) => {
    const audio = audioRef.current
    audio.volume = v
    if (v > 0 && audio.muted) {
      audio.muted = false
      setMutedState(false)
      window.api.setSetting('muted', false)
    }
    setVolumeState(v)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => window.api.setSetting('volume', v), 300)
  }, [])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    audio.muted = !audio.muted
    setMutedState(audio.muted)
    window.api.setSetting('muted', audio.muted)
  }, [])

  return {
    track,
    queue,
    index,
    shuffle,
    repeat,
    playing,
    currentTime,
    duration,
    volume,
    muted,
    error,
    stopAfterTrack,
    pause,
    setStopAfterTrack,
    play,
    playList,
    toggle,
    next,
    previous,
    toggleShuffle,
    cycleRepeat,
    jumpTo: goTo,
    seek,
    setVolume,
    toggleMute
  }
}
