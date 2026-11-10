// Audio chain between the two <audio> elements and the speakers.
// source -> deck gain -> preamp -> 10 EQ bands -> bass -> treble -> compressor -> makeup -> balance -> out

export const BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
export const BAND_LABELS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k']

export const PRESETS = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Rock: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5],
  Pop: [-1, 2, 4, 4, 3, 0, -1, -1, -2, -2],
  Classical: [0, 0, 0, 0, 0, 0, -3, -3, -3, -5],
  Jazz: [3, 2, 1, 2, -2, -2, 0, 1, 2, 3]
}

const MAX_CUSTOM_PRESETS = 50

function defaultState() {
  return {
    enabled: true,
    preset: 'Flat', // '' means "custom, not saved"
    bands: Array(10).fill(0),
    preamp: 0,
    bass: 0,
    treble: 0,
    balance: 0,
    speed: 1,
    normalize: false
  }
}

let audioEls = []
let ctx = null
let nodes = null
const deckGains = new Map()
let state = defaultState()
let customPresets = {}
let snapshot = { state, customPresets }
let saveTimer = null
const listeners = new Set()

const clamp = (v, lo, hi, fallback) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback

function cleanBands(raw) {
  if (!Array.isArray(raw) || raw.length !== 10) return null
  return raw.map((v) => clamp(v, -12, 12, 0))
}

function sanitizeState(raw) {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  return {
    enabled: raw.enabled !== false,
    preset: typeof raw.preset === 'string' ? raw.preset : '',
    bands: cleanBands(raw.bands) || base.bands,
    preamp: clamp(raw.preamp, -12, 12, 0),
    bass: clamp(raw.bass, -12, 12, 0),
    treble: clamp(raw.treble, -12, 12, 0),
    balance: clamp(raw.balance, -1, 1, 0),
    speed: clamp(raw.speed, 0.5, 2, 1),
    normalize: raw.normalize === true
  }
}

function sanitizeCustom(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [name, bands] of Object.entries(raw)) {
    const clean = cleanBands(bands)
    if (clean && name.length > 0 && name.length <= 40) out[name] = clean
  }
  return out
}

function build(audios) {
  const AC = window.AudioContext || window.webkitAudioContext
  ctx = new AC({ latencyHint: 'playback' })

  const pre = ctx.createGain()
  const filters = BANDS.map((freq) => {
    const f = ctx.createBiquadFilter()
    f.type = 'peaking'
    f.frequency.value = freq
    f.Q.value = 1.4
    return f
  })
  const bass = ctx.createBiquadFilter()
  bass.type = 'lowshelf'
  bass.frequency.value = 100
  const treble = ctx.createBiquadFilter()
  treble.type = 'highshelf'
  treble.frequency.value = 6000
  const comp = ctx.createDynamicsCompressor()
  comp.attack.value = 0.003
  comp.release.value = 0.25
  const makeup = ctx.createGain()
  const pan = ctx.createStereoPanner()

  const chain = [pre, ...filters, bass, treble, comp, makeup, pan, ctx.destination]
  for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1])

  // each audio element gets its own fade gain feeding the shared chain
  for (const audio of audios) {
    const source = ctx.createMediaElementSource(audio)
    const deck = ctx.createGain()
    source.connect(deck)
    deck.connect(pre)
    deckGains.set(audio, deck)
  }

  nodes = { pre, filters, bass, treble, comp, makeup, pan }
}

function apply() {
  for (const audio of audioEls) {
    // defaultPlaybackRate matters: loading a new song resets playbackRate to it
    audio.defaultPlaybackRate = state.speed
    audio.playbackRate = state.speed
    audio.preservesPitch = true
  }
  if (!nodes) return

  const t = ctx.currentTime
  const on = state.enabled
  const gains = state.bands.map((g) => (on ? g : 0))
  const bass = on ? state.bass : 0
  const treble = on ? state.treble : 0
  // Automatic headroom: lower the volume by the biggest boost so loud songs don't distort
  const boost = Math.max(0, bass, treble, ...gains)
  const preDb = on ? state.preamp - boost : 0

  nodes.pre.gain.setTargetAtTime(10 ** (preDb / 20), t, 0.02)
  nodes.filters.forEach((f, i) => f.gain.setTargetAtTime(gains[i], t, 0.02))
  nodes.bass.gain.setTargetAtTime(bass, t, 0.02)
  nodes.treble.gain.setTargetAtTime(treble, t, 0.02)
  nodes.pan.pan.setTargetAtTime(state.balance, t, 0.02)

  if (state.normalize) {
    nodes.comp.threshold.value = -24
    nodes.comp.knee.value = 30
    nodes.comp.ratio.value = 4
    nodes.makeup.gain.setTargetAtTime(1.4, t, 0.05)
  } else {
    nodes.comp.threshold.value = 0
    nodes.comp.knee.value = 0
    nodes.comp.ratio.value = 1
    nodes.makeup.gain.setTargetAtTime(1, t, 0.05)
  }
}

function emit() {
  snapshot = { state, customPresets }
  listeners.forEach((fn) => fn())
}

function persistState() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => window.api.setSetting('eqState', state), 300)
}

function persistCustom() {
  window.api.setSetting('eqCustomPresets', customPresets)
}

function update(next) {
  state = next
  apply()
  persistState()
  emit()
}

// Fades one audio element's own gain to `to` (0 to 1) over `seconds`.
// `from` (optional) sets the starting level. Returns false if the engine isn't running.
export function fadeDeck(audio, to, seconds, from) {
  const gain = deckGains.get(audio)
  if (!gain || !ctx) return false
  const t = ctx.currentTime
  gain.gain.cancelScheduledValues(t)
  gain.gain.setValueAtTime(typeof from === 'number' ? from : gain.gain.value, t)
  if (seconds > 0) gain.gain.linearRampToValueAtTime(to, t + seconds)
  else gain.gain.setValueAtTime(to, t)
  return true
}

export function initEngine(audios) {
  if (audioEls.length > 0) return
  audioEls = audios
  try {
    build(audios)
  } catch (error) {
    console.error('Audio engine could not start:', error)
    nodes = null
  }
  for (const audio of audios) {
    audio.addEventListener('play', () => {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    })
  }

  apply()
  Promise.all([window.api.getSetting('eqState'), window.api.getSetting('eqCustomPresets')])
    .then(([savedState, savedCustom]) => {
      state = sanitizeState(savedState)
      customPresets = sanitizeCustom(savedCustom)
      apply()
      emit()
    })
    .catch(() => {})
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSnapshot() {
  return snapshot
}

export function setEnabled(enabled) {
  update({ ...state, enabled })
}

export function setBand(index, value) {
  const bands = [...state.bands]
  bands[index] = clamp(value, -12, 12, 0)
  update({ ...state, bands, preset: '' })
}

export function setValue(key, value) {
  const limits = {
    preamp: [-12, 12],
    bass: [-12, 12],
    treble: [-12, 12],
    balance: [-1, 1],
    speed: [0.5, 2]
  }
  if (!limits[key]) return
  const [lo, hi] = limits[key]
  update({ ...state, [key]: clamp(value, lo, hi, state[key]) })
}

export function setNormalize(normalize) {
  update({ ...state, normalize })
}

export function applyPreset(name) {
  const bands = PRESETS[name] || customPresets[name]
  if (!bands) return
  update({ ...state, bands: [...bands], preset: name })
}

export function saveCustomPreset(rawName) {
  const name = String(rawName || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  if (!name) return { ok: false, error: 'Please enter a name.' }
  if (Object.keys(PRESETS).some((p) => p.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'That name is used by a built-in preset.' }
  }
  const existing = Object.keys(customPresets).find((p) => p.toLowerCase() === name.toLowerCase())
  if (!existing && Object.keys(customPresets).length >= MAX_CUSTOM_PRESETS) {
    return { ok: false, error: 'You have reached the limit of 50 custom presets.' }
  }
  const key = existing || name
  customPresets = { ...customPresets, [key]: [...state.bands] }
  persistCustom()
  update({ ...state, preset: key })
  return { ok: true, name: key }
}

export function deleteCustomPreset(name) {
  if (!customPresets[name]) return
  const next = { ...customPresets }
  delete next[name]
  customPresets = next
  persistCustom()
  update({ ...state, preset: state.preset === name ? '' : state.preset })
}

export function resetAll() {
  update(defaultState())
}
