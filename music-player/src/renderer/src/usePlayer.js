import { useCallback, useEffect, useRef, useState } from 'react'
import { initEngine, fadeDeck } from './audioEngine'

function shuffled(list, first) {
  const rest = list.filter((t) => !first || t.id !== first.id)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return first ? [first, ...rest] : rest
}

function makeAudio() {
  const audio = new Audio()
  audio.crossOrigin = 'anonymous' // lets the equalizer process the audio
  audio.preload = 'auto'
  return audio
}

const GAPLESS_FADE = 0.15 // seconds of overlap used to hide the gap
const PRELOAD_WITHIN = 20 // start loading the next song this many seconds before the end

export function usePlayer() {
  // Two audio elements ("decks"): one plays, the other preloads the next song.
  const decksRef = useRef(null)
  const audioRef = useRef(null)
  if (!decksRef.current) {
    decksRef.current = [makeAudio(), makeAudio()]
    audioRef.current = decksRef.current[0]
  }
  const activeRef = useRef(0)
  const preloadedRef = useRef(null) // id of the song loaded on the idle deck
  const transitionRef = useRef({ busy: false, timer: null })
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
  const [crossfade, setCrossfadeState] = useState(0) // seconds, 0 = off
  const [gapless, setGaplessState] = useState(false)

  const track = index >= 0 ? queue[index] || null : null
  latest.current = { queue, index, repeat, shuffle, crossfade, gapless }

  // Bookkeeping when a song begins (by click, next, or an automatic transition)
  const markStarted = useCallback((t) => {
    setError('')
    window.api.setSetting('lastTrackId', t.id)
    window.api.setSetting('lastPosition', 0)
    recordedRef.current = t.id
    window.api.recordPlay(t.id)
    setCurrentTime(0)
    setDuration(t.duration || 0)
  }, [])

  // Stops a crossfade in progress (used when you pick something yourself)
  const cancelTransition = useCallback(() => {
    const tr = transitionRef.current
    if (!tr.busy) return
    clearTimeout(tr.timer)
    tr.busy = false
    const old = decksRef.current[1 - activeRef.current]
    old.pause()
    fadeDeck(old, 0, 0)
    fadeDeck(audioRef.current, 1, 0)
  }, [])

  const startTrack = useCallback(
    (t) => {
      cancelTransition()
      const audio = audioRef.current
      markStarted(t)
      audio.src = `media://track/${t.id}`
      audio.play().catch((e) => console.error('play() failed:', e))
    },
    [cancelTransition, markStarted]
  )

  const goTo = useCallback(
    (i) => {
      const t = latest.current.queue[i]
      if (!t) return
      setIndex(i)
      startTrack(t)
    },
    [startTrack]
  )

  // Automatic switch to the preloaded song on the other deck, with a fade.
  const startTransition = useCallback(
    (nextIndex, seconds) => {
      const t = latest.current.queue[nextIndex]
      if (!t) return
      const tr = transitionRef.current
      const old = audioRef.current
      const next = decksRef.current[1 - activeRef.current]

      tr.busy = true
      activeRef.current = 1 - activeRef.current
      audioRef.current = next
      preloadedRef.current = null

      next.currentTime = 0
      fadeDeck(next, 1, seconds, 0)
      fadeDeck(old, 0, seconds)
      next.play().catch((e) => console.error('play() failed:', e))

      setIndex(nextIndex)
      markStarted(t)
      setDuration(t.duration || (Number.isFinite(next.duration) ? next.duration : 0))
      setPlaying(true)

      clearTimeout(tr.timer)
      tr.timer = setTimeout(
        () => {
          old.pause()
          tr.busy = false
        },
        seconds * 1000 + 200
      )
    },
    [markStarted]
  )

  useEffect(() => {
    const decks = decksRef.current
    const audio = audioRef.current // deck 0 is the active one at startup
    initEngine(decks)

    window.api.getAllSettings().then((s) => {
      const v = typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : 0.8
      decks.forEach((d) => {
        d.volume = v
        d.muted = s.muted === true
      })
      setVolumeState(v)
      setMutedState(s.muted === true)
      setShuffle(s.shuffle === true)
      if (s.repeat === 'all' || s.repeat === 'one') setRepeat(s.repeat)
      if (typeof s.crossfade === 'number') {
        setCrossfadeState(Math.min(12, Math.max(0, Math.round(s.crossfade))))
      }
      setGaplessState(s.gapless === true)

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

    // Events only count when they come from the deck that is currently playing
    const onlyActive = (fn) => (e) => {
      if (e.target === audioRef.current) fn()
    }
    const handlers = {
      timeupdate: onlyActive(() => setCurrentTime(audioRef.current.currentTime)),
      durationchange: onlyActive(() => {
        const d = audioRef.current.duration
        setDuration(Number.isFinite(d) ? d : 0)
      }),
      loadedmetadata: onlyActive(() => {
        const d = audioRef.current.duration
        setDuration(Number.isFinite(d) ? d : 0)
      }),
      play: onlyActive(() => setPlaying(true)),
      pause: onlyActive(() => setPlaying(false)),
      ended: onlyActive(() => advanceRef.current(true)),
      error: onlyActive(() => {
        const a = audioRef.current
        console.error('Audio error:', a.error && a.error.code, a.src)
        setPlaying(false)
        setError('This file could not be played.')
      })
    }
    decks.forEach((d) => {
      for (const [name, fn] of Object.entries(handlers)) d.addEventListener(name, fn)
    })

    return () => {
      decks.forEach((d) => {
        d.pause()
        for (const [name, fn] of Object.entries(handlers)) d.removeEventListener(name, fn)
      })
    }
  }, [])

  // Save the playback position every 2 seconds while playing, and on pause
  useEffect(() => {
    const decks = decksRef.current
    const save = () => {
      const a = audioRef.current
      if (a.src && a.readyState >= 1) window.api.setSetting('lastPosition', a.currentTime)
    }
    const timer = setInterval(() => {
      const a = audioRef.current
      if (a.src && !a.paused) save()
    }, 2000)
    const onPause = (e) => {
      if (e.target === audioRef.current) save()
    }
    decks.forEach((d) => d.addEventListener('pause', onPause))
    return () => {
      clearInterval(timer)
      decks.forEach((d) => d.removeEventListener('pause', onPause))
    }
  }, [])

  // Preloads the next song and starts the crossfade / gapless switch near the end
  useEffect(() => {
    const timer = setInterval(() => {
      const { queue: q, index: i, repeat: r, crossfade: cf, gapless: gl } = latest.current
      const active = audioRef.current
      if (transitionRef.current.busy) return
      if (!active.src || active.paused) return
      if (stopAfterRef.current || r === 'one') return
      if (cf <= 0 && !gl) return

      const dur = active.duration
      if (!Number.isFinite(dur) || dur <= 0) return

      let nextIndex = -1
      if (i >= 0 && i < q.length - 1) nextIndex = i + 1
      else if (i >= 0 && r === 'all' && q.length > 0) nextIndex = 0
      if (nextIndex < 0) return

      const next = q[nextIndex]
      const idle = decksRef.current[1 - activeRef.current]
      const remaining = dur - active.currentTime
      const rate = active.playbackRate || 1

      if (remaining < PRELOAD_WITHIN * rate && preloadedRef.current !== next.id) {
        preloadedRef.current = next.id
        idle.src = `media://track/${next.id}`
      }

      const lead = cf > 0 ? Math.min(cf, dur / 2) : GAPLESS_FADE
      if (remaining <= lead * rate && preloadedRef.current === next.id && idle.readyState >= 3) {
        startTransition(nextIndex, lead)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [startTransition])

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
    preloadedRef.current = null // the "next" song may have changed
    setShuffle(value)
    window.api.setSetting('shuffle', value)
  }, [])

  const cycleRepeat = useCallback(() => {
    const value = { off: 'all', all: 'one', one: 'off' }[latest.current.repeat]
    setRepeat(value)
    window.api.setSetting('repeat', value)
  }, [])

  const setCrossfade = useCallback((seconds) => {
    const value = Math.min(12, Math.max(0, Math.round(Number(seconds) || 0)))
    setCrossfadeState(value)
    window.api.setSetting('crossfade', value)
  }, [])

  const setGapless = useCallback((value) => {
    setGaplessState(value === true)
    window.api.setSetting('gapless', value === true)
  }, [])

  const seek = useCallback((time) => {
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }, [])

  const setVolume = useCallback((v) => {
    const decks = decksRef.current
    decks.forEach((d) => {
      d.volume = v
    })
    if (v > 0 && audioRef.current.muted) {
      decks.forEach((d) => {
        d.muted = false
      })
      setMutedState(false)
      window.api.setSetting('muted', false)
    }
    setVolumeState(v)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => window.api.setSetting('volume', v), 300)
  }, [])

  const toggleMute = useCallback(() => {
    const value = !audioRef.current.muted
    decksRef.current.forEach((d) => {
      d.muted = value
    })
    setMutedState(value)
    window.api.setSetting('muted', value)
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
    crossfade,
    gapless,
    pause,
    setStopAfterTrack,
    setCrossfade,
    setGapless,
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
