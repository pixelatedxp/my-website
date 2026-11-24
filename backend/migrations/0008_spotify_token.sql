-- Spotify sometimes replaces the refresh token; the newest one is kept here.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
