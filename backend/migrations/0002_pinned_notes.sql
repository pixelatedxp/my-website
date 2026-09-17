ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1));
CREATE INDEX notes_public_pinned ON notes(status, pinned DESC, created_at DESC, id DESC);
