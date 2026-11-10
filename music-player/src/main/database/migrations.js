// Each migration runs once, in order. To change the database later,
// add a new entry with the next version number. Never edit old ones.
export const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `
  },
  {
    version: 2,
    sql: `
      CREATE TABLE library_folders (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        recursive INTEGER NOT NULL DEFAULT 1,
        added_at INTEGER NOT NULL
      );
      CREATE TABLE tracks (
        id INTEGER PRIMARY KEY,
        folder_id INTEGER NOT NULL REFERENCES library_folders(id) ON DELETE CASCADE,
        path TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        artist TEXT,
        album TEXT,
        album_artist TEXT,
        track_no INTEGER,
        disc_no INTEGER,
        year INTEGER,
        duration REAL,
        artwork TEXT,
        size INTEGER NOT NULL,
        mtime INTEGER NOT NULL,
        added_at INTEGER NOT NULL
      );
      CREATE INDEX idx_tracks_folder ON tracks(folder_id);
    `
  },
  {
    version: 3,
    sql: `
      CREATE TABLE favourites (
        track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
        added_at INTEGER NOT NULL
      );
      CREATE TABLE play_history (
        track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
        played_at INTEGER NOT NULL
      );
            CREATE INDEX idx_history_played ON play_history(played_at);
    `
  },
  {
    version: 4,
    sql: `
      ALTER TABLE tracks ADD COLUMN genre TEXT;
      UPDATE tracks SET mtime = 0;
    `
  },
  {
    version: 5,
    sql: `
      CREATE TABLE playlists (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE playlist_tracks (
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id)
      );
      CREATE INDEX idx_playlist_tracks_order ON playlist_tracks(playlist_id, position);
    `
  },
  {
    version: 6,
    sql: `
      ALTER TABLE playlists ADD COLUMN shuffle INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE playlists ADD COLUMN repeat TEXT NOT NULL DEFAULT 'off';
    `
  },
  {
    version: 7,
    sql: `
      ALTER TABLE tracks ADD COLUMN composer TEXT;
      ALTER TABLE play_history ADD COLUMN play_count INTEGER NOT NULL DEFAULT 1;
      CREATE INDEX idx_tracks_added ON tracks(added_at);
      CREATE INDEX idx_history_count ON play_history(play_count);
      UPDATE tracks SET mtime = 0;
    `
  }
]

export function runMigrations(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version

  for (const migration of migrations) {
    if (migration.version <= current) continue
    db.exec('BEGIN')
    try {
      db.exec(migration.sql)
      db.exec(`PRAGMA user_version = ${migration.version}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
