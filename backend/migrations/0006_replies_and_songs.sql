-- Pixel's reply under an approved postcard (written from Discord).
ALTER TABLE notes ADD COLUMN reply TEXT;
ALTER TABLE notes ADD COLUMN replied_at INTEGER;

-- Songs visitors suggest on the music page. Reviewed on Discord like postcards.
CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  discord_message_id TEXT,
  delivery_after INTEGER NOT NULL DEFAULT 0,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  sync_needed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX songs_public ON songs(status, created_at DESC);
