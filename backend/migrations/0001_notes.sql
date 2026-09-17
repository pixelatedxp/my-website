CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    anonymous INTEGER NOT NULL CHECK (anonymous IN (0, 1)),
    content TEXT NOT NULL,
    doodle BLOB,
    colour TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    reviewed_by TEXT,
    discord_message_id TEXT,
    delivery_attempts INTEGER NOT NULL DEFAULT 0,
    delivery_after INTEGER NOT NULL DEFAULT 0,
    delivery_lease TEXT,
    sync_needed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX notes_public ON notes(status, created_at DESC, id DESC);
CREATE INDEX notes_delivery ON notes(status, discord_message_id, delivery_after);
CREATE INDEX notes_sync ON notes(sync_needed);
CREATE TABLE submission_limits (
    bucket TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
