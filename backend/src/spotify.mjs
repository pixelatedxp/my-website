// "What is Pixel listening to?" straight from Spotify, so the homepage card works even with Discord closed.
// Needs three Worker secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN
// (see scripts/spotify-auth.mjs). Without them the endpoint answers { configured: false } and the
// homepage keeps using Discord through Lanyard.

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode';
const RECENT_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=1';
const RECENT_MS = 60_000; // the last song changes rarely; ask at most once a minute
const CACHE_MS = 10_000; // every visitor polls; Spotify is asked at most once per 10 s per Worker instance

let token = null; // { value, expiresAt }
let cached = null; // { at, body }
let recent = null; // { at, last }

export function resetSpotifyCache() { token = null; cached = null; recent = null; }

const text = value => (typeof value === 'string' ? value.trim().slice(0, 200) : '');

function art(images) {
  if (!Array.isArray(images)) return null;
  const usable = images.filter(i => typeof i?.url === 'string' && /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/.test(i.url));
  if (!usable.length) return null;
  // Smallest image that is still at least 300px wide (the card shows it at 96px, sharp on 3x screens).
  usable.sort((a, b) => (a.width || 0) - (b.width || 0));
  return (usable.find(i => (i.width || 0) >= 300) || usable[usable.length - 1]).url;
}

function link(item) {
  const url = item?.external_urls?.spotify;
  return typeof url === 'string' && url.startsWith('https://open.spotify.com/') ? url : null;
}

async function accessToken(env) {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`) },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env.SPOTIFY_REFRESH_TOKEN })
  });
  if (!response.ok) throw new Error(`Spotify token refresh failed (${response.status})`);
  const result = await response.json();
  if (typeof result.access_token !== 'string') throw new Error('Spotify token refresh returned no token');
  token = { value: result.access_token, expiresAt: Date.now() + (Number(result.expires_in) || 3600) * 1000 };
  return token.value;
}

// Only what the card shows: title, artist, album art, progress. No device or account details.
export function shapePlaying(data) {
  const item = data?.item;
  if (!data || !item) return { configured: true, playing: false };
  const episode = data.currently_playing_type === 'episode';
  const artist = episode ? text(item.show?.name) : (Array.isArray(item.artists) ? item.artists.map(a => text(a?.name)).filter(Boolean).join(', ') : '');
  const durationMs = Number(item.duration_ms) || 0;
  const progressMs = Math.min(Math.max(Number(data.progress_ms) || 0, 0), durationMs || Infinity);
  return {
    configured: true,
    playing: data.is_playing === true,
    paused: data.is_playing !== true,
    title: text(item.name),
    artist,
    albumArt: art(episode ? (item.images || item.show?.images) : item.album?.images),
    url: link(item),
    progressMs,
    durationMs
  };
}

// Last finished song, for when nothing is playing. Needs the user-read-recently-played permission;
// with an older token Spotify answers 401/403 and the card simply stays idle.
export function shapeRecent(data) {
  const entry = data?.items?.[0];
  const item = entry?.track;
  if (!item || !text(item.name)) return null;
  const playedAt = Date.parse(entry.played_at);
  return {
    title: text(item.name),
    artist: Array.isArray(item.artists) ? item.artists.map(a => text(a?.name)).filter(Boolean).join(', ') : '',
    albumArt: art(item.album?.images),
    url: link(item),
    playedAt: Number.isFinite(playedAt) ? new Date(playedAt).toISOString() : null
  };
}

async function lastPlayed(env) {
  if (recent && Date.now() - recent.at < RECENT_MS) return recent.last;
  try {
    const response = await fetch(RECENT_URL, { headers: { Authorization: `Bearer ${await accessToken(env)}` } });
    const last = response.ok ? shapeRecent(await response.json()) : null;
    recent = { at: Date.now(), last };
    return last;
  } catch (error) {
    console.error('Recently played failed:', error.message);
    return recent ? recent.last : null;
  }
}

export async function nowPlaying(env) {
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_REFRESH_TOKEN) return { status: 200, body: { configured: false } };
  if (cached && Date.now() - cached.at < CACHE_MS) return { status: 200, body: { ...cached.body, ageMs: Date.now() - cached.at } };
  try {
    let response = await fetch(PLAYING_URL, { headers: { Authorization: `Bearer ${await accessToken(env)}` } });
    if (response.status === 401) { token = null; response = await fetch(PLAYING_URL, { headers: { Authorization: `Bearer ${await accessToken(env)}` } }); }
    let body;
    if (response.status === 204) body = { configured: true, playing: false };
    else if (response.ok) body = shapePlaying(await response.json());
    else throw new Error(`Spotify answered ${response.status}`);
    if (!body.title) { const last = await lastPlayed(env); if (last) body.last = last; }
    cached = { at: Date.now(), body };
    return { status: 200, body: { ...body, ageMs: 0 } };
  } catch (error) {
    console.error('Now playing failed:', error.message);
    // Serve the last good answer for a minute rather than flickering the card.
    if (cached && Date.now() - cached.at < 60_000) return { status: 200, body: { ...cached.body, ageMs: Date.now() - cached.at } };
    return { status: 503, body: { configured: true, error: 'Spotify is unavailable right now' } };
  }
}

// "On repeat": the five songs played most over roughly the last four weeks. Needs the
// user-top-read permission; with an older token Spotify answers 403 and the page says so.
const TOP_URL = 'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5';
const TOP_MS = 3_600_000; // changes slowly; ask Spotify at most once an hour
let top = null; // { at, body }

export function shapeTop(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.filter(item => text(item?.name)).slice(0, 5).map(item => ({
    title: text(item.name),
    artist: Array.isArray(item.artists) ? item.artists.map(a => text(a?.name)).filter(Boolean).join(', ') : '',
    albumArt: art(item.album?.images),
    url: link(item)
  }));
}

export function resetTopCache() { top = null; }

export async function topTracks(env) {
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_REFRESH_TOKEN) return { status: 200, body: { configured: false, tracks: [] } };
  if (top && Date.now() - top.at < TOP_MS) return { status: 200, body: top.body };
  try {
    const response = await fetch(TOP_URL, { headers: { Authorization: `Bearer ${await accessToken(env)}` } });
    let body;
    if (response.status === 401 || response.status === 403) body = { configured: true, tracks: [], needsPermission: true };
    else if (response.ok) body = { configured: true, tracks: shapeTop(await response.json()) };
    else throw new Error(`Spotify answered ${response.status}`);
    top = { at: Date.now(), body };
    return { status: 200, body };
  } catch (error) {
    console.error('Top tracks failed:', error.message);
    if (top) return { status: 200, body: top.body };
    return { status: 503, body: { configured: true, tracks: [], error: 'Spotify is unavailable right now' } };
  }
}
