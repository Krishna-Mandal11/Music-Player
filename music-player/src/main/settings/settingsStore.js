import { getDb } from '../database/connection'

const DEFAULTS = {
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: 'off'
}

export function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)
  if (!row) return key in DEFAULTS ? DEFAULTS[key] : null
  try {
    return JSON.parse(row.value)
  } catch {
    return DEFAULTS[key] ?? null
  }
}

export function setSetting(key, value) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, JSON.stringify(value))
}

export function getAllSettings() {
  const result = { ...DEFAULTS }
  const rows = getDb().prepare('SELECT key, value FROM settings').all()
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value)
    } catch {
      // ignore unreadable value, keep the default
    }
  }
  return result
}
