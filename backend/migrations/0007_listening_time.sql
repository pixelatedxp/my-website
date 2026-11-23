-- Songs Spotify reports as played, recorded every few minutes so the music page can
-- total up listening time (today, this week, this year). One row per play.
CREATE TABLE plays (
  played_at INTEGER PRIMARY KEY,
  track_id TEXT NOT NULL,
  duration_ms INTEGER NOT NULL
);
