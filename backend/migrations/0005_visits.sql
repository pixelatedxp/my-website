-- Visit counter: one visit per visitor per day. Visitors are recognised only by a salted hash that
-- changes every day, and both the hashes and the salts are deleted after two days. No IPs are stored.
CREATE TABLE site_counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
INSERT INTO site_counters (name, value) VALUES ('visits', 0);
CREATE TABLE visit_salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL);
CREATE TABLE visit_seen (day TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY (day, visitor));
