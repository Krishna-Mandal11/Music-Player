import { useState, useSyncExternalStore } from 'react'
import {
  BANDS,
  BAND_LABELS,
  PRESETS,
  subscribe,
  getSnapshot,
  setEnabled,
  setBand,
  setValue,
  setNormalize,
  applyPreset,
  saveCustomPreset,
  deleteCustomPreset,
  resetAll
} from '../audioEngine'

const button = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13
}

const field = {
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: '#1f1f27',
  color: 'inherit',
  fontSize: 13,
  colorScheme: 'dark'
}

const section = { marginBottom: 24 }
const heading = { margin: '0 0 10px', fontSize: 13, opacity: 0.7, textTransform: 'uppercase' }

function formatDb(v) {
  return `${v > 0 ? '+' : ''}${Number(v).toFixed(1)} dB`
}

function formatBalance(v) {
  if (Math.abs(v) < 0.01) return 'Centre'
  return `${v < 0 ? 'Left' : 'Right'} ${Math.round(Math.abs(v) * 100)}%`
}

function SliderRow({ label, value, min, max, step, display, onChange, resetTo }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, fontSize: 13 }}>
      <div style={{ width: 70 }}>{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(resetTo)}
        title="Double-click to reset"
        style={{ flex: 1, maxWidth: 360, accentColor: 'var(--accent)' }}
      />
      <div style={{ width: 90, opacity: 0.8 }}>{display}</div>
    </div>
  )
}

function EqualizerPage({ player }) {
  const { state, customPresets } = useSyncExternalStore(subscribe, getSnapshot)
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState('')
  const customNames = Object.keys(customPresets).sort((a, b) => a.localeCompare(b))
  const isCustomSaved = state.preset !== '' && !!customPresets[state.preset]

  function handleSave() {
    const result = saveCustomPreset(newName)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setNewName('')
    setMessage(`Saved "${result.name}".`)
  }

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 16px' }}>Equalizer</h2>

      <div style={section}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Equalizer on (bands, bass, treble and preamp)
        </label>
      </div>

      <div style={{ ...section, opacity: state.enabled ? 1 : 0.5 }}>
        <h3 style={heading}>Presets</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <select
            style={field}
            value={state.preset === '' ? '__custom' : state.preset}
            onChange={(e) => {
              if (e.target.value !== '__custom') applyPreset(e.target.value)
            }}
          >
            {state.preset === '' && <option value="__custom">Custom (not saved)</option>}
            <optgroup label="Built-in">
              {Object.keys(PRESETS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
            {customNames.length > 0 && (
              <optgroup label="My presets">
                {customNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {isCustomSaved && (
            <button style={button} onClick={() => deleteCustomPreset(state.preset)}>
              Delete this preset
            </button>
          )}

          <input
            placeholder="Name for a new preset"
            value={newName}
            maxLength={40}
            onChange={(e) => {
              setNewName(e.target.value)
              setMessage('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
            }}
            style={{ ...field, width: 200, userSelect: 'text' }}
          />
          <button style={button} onClick={handleSave}>
            Save current as preset
          </button>
        </div>
        {message && <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.8 }}>{message}</p>}
      </div>

      <div style={{ ...section, opacity: state.enabled ? 1 : 0.5 }}>
        <h3 style={heading}>Bands</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {BANDS.map((freq, i) => (
            <div
              key={freq}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                width: 52,
                fontSize: 12
              }}
            >
              <div style={{ opacity: 0.8, height: 16 }}>{state.bands[i].toFixed(1)}</div>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={state.bands[i]}
                onChange={(e) => setBand(i, Number(e.target.value))}
                onDoubleClick={() => setBand(i, 0)}
                title="Double-click to reset"
                style={{
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  height: 150,
                  width: 22,
                  accentColor: 'var(--accent)'
                }}
              />
              <div style={{ opacity: 0.7 }}>{BAND_LABELS[i]}</div>
            </div>
          ))}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.6 }}>
          Values are in dB. Loud boosts lower the overall volume a little on purpose, so songs
          don&apos;t distort.
        </p>
      </div>

      <div style={section}>
        <h3 style={heading}>Tone and balance</h3>
        <SliderRow
          label="Preamp"
          min={-12}
          max={12}
          step={0.5}
          value={state.preamp}
          display={formatDb(state.preamp)}
          onChange={(v) => setValue('preamp', v)}
          resetTo={0}
        />
        <SliderRow
          label="Bass"
          min={-12}
          max={12}
          step={0.5}
          value={state.bass}
          display={formatDb(state.bass)}
          onChange={(v) => setValue('bass', v)}
          resetTo={0}
        />
        <SliderRow
          label="Treble"
          min={-12}
          max={12}
          step={0.5}
          value={state.treble}
          display={formatDb(state.treble)}
          onChange={(v) => setValue('treble', v)}
          resetTo={0}
        />
        <SliderRow
          label="Balance"
          min={-1}
          max={1}
          step={0.05}
          value={state.balance}
          display={formatBalance(state.balance)}
          onChange={(v) => setValue('balance', v)}
          resetTo={0}
        />
      </div>

      <div style={section}>
        <h3 style={heading}>Playback speed</h3>
        <SliderRow
          label="Speed"
          min={0.5}
          max={2}
          step={0.05}
          value={state.speed}
          display={`${state.speed.toFixed(2)}×`}
          onChange={(v) => setValue('speed', v)}
          resetTo={1}
        />
        <div style={{ display: 'flex', gap: 8, marginLeft: 82 }}>
          {[0.75, 1, 1.25, 1.5].map((s) => (
            <button key={s} style={button} onClick={() => setValue('speed', s)}>
              {s}×
            </button>
          ))}
        </div>
        <p style={{ margin: '8px 0 0 82px', fontSize: 12, opacity: 0.6 }}>
          The pitch stays natural at any speed.
        </p>
      </div>

      <div style={section}>
        <h3 style={heading}>Normalization</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={state.normalize}
            onChange={(e) => setNormalize(e.target.checked)}
          />
          Even out loud and quiet parts
        </label>
        <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.6 }}>
          Uses a compressor that tames sudden loud peaks and lifts the overall level. It works on
          what is playing, so it does not need song tags.
        </p>
      </div>

      <div style={section}>
        <h3 style={heading}>Song transitions</h3>
        <SliderRow
          label="Crossfade"
          min={0}
          max={12}
          step={1}
          value={player.crossfade}
          display={player.crossfade === 0 ? 'Off' : `${player.crossfade} s`}
          onChange={(v) => player.setCrossfade(v)}
          resetTo={0}
        />
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginLeft: 82 }}
        >
          <input
            type="checkbox"
            checked={player.gapless}
            onChange={(e) => player.setGapless(e.target.checked)}
          />
          Gapless (a 0.15 second overlap hides the gap between songs)
        </label>
        <p style={{ margin: '8px 0 0 82px', fontSize: 12, opacity: 0.6 }}>
          Crossfade takes priority when it is above 0. Clicking a song, Next and Previous switch
          instantly. Transitions are skipped for repeat-one and the sleep timer&apos;s stop after
          this song.
        </p>
      </div>

      <button style={button} onClick={resetAll}>
        Reset everything
      </button>
    </div>
  )
}

export default EqualizerPage
