ALTER TABLE notes ADD COLUMN pinned_rank INTEGER;
CREATE INDEX notes_public_pinned_rank ON notes(status, pinned_rank ASC, created_at DESC, id DESC);
