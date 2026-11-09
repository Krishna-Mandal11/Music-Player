import { app } from 'electron'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations } from './migrations'

let db = null

export function openDatabase() {
  if (db) return db
  const file = join(app.getPath('userData'), 'music-player.db')
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
  return db
}

export function getDb() {
  if (!db) throw new Error('Database is not open')
  return db
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}

export function getSchemaVersion() {
  return getDb().prepare('PRAGMA user_version').get().user_version
}

export function recordAppOpen() {
  const database = getDb()
  database
    .prepare(
      `INSERT INTO app_meta (key, value) VALUES ('open_count', '1')
       ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`
    )
    .run()
  const row = database.prepare(`SELECT value FROM app_meta WHERE key = 'open_count'`).get()
  return Number(row.value)
}
