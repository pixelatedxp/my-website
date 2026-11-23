// "Songs people sent me" on the music page. A visitor suggests a song; Pixel approves or
// rejects it on Discord, the same way as postcards. Only approved songs are public.
import { HttpError, UUID, lengthOf, discordText } from './validation.mjs';

const api = 'https://discord.com/api/v10';
const controls = /[\u0000-\u0008\u000b-\u001f\u007f‪-‮⁦-⁩]/;
const clean = value => (typeof value === 'string' ? value.normalize('NFC').replace(/\s+/g, ' ').trim() : '');

function field(value, label, max, required) {
  const text = clean(value);
  if (required && !text) throw new HttpError(400, `Please add the ${label}.`);
  if (lengthOf(text) > max || text.length > max * 4 || controls.test(text)) throw new HttpError(400, `Keep the ${label} under ${max} characters.`);
  return text;
}

export function validateSong(input) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Invalid song.');
  if (!UUID.test(input.id || '')) throw new HttpError(400, 'Invalid submission. Please reload and try again.');
  if (input.website) throw new HttpError(400, 'Invalid submission.'); // honeypot: people never fill it
  return {
    id: input.id.toLowerCase(),
    title: field(input.title, 'song name', 80, true),
    artist: field(input.artist, 'artist', 80, true),
    name: field(input.name, 'name', 32, false) || 'someone',
    note: field(input.note, 'note', 200, false) || null
  };
}

const plain = text => discordText([{ text }]);

export function songMessage(song) {
  const pending = song.status === 'pending';
  const embed = {
    title: pending ? 'Someone sent a song' : song.status === 'approved' ? 'Song added' : 'Song rejected / removed',
    description: `**${plain(song.title)}** by ${plain(song.artist)}`,
    color: pending ? 0x1db954 : song.status === 'approved' ? 0x43b581 : 0xed4245,
    fields: [
      { name: 'From', value: plain(song.name), inline: true },
      { name: 'Sent', value: `<t:${Math.floor(song.created_at / 1000)}:f>`, inline: true },
      ...(song.note ? [{ name: 'Why this one', value: plain(song.note) }] : [])
    ],
    footer: { text: `Song ${song.id} · ${pending ? 'Waiting for your approval' : 'Reviewed'}` },
    timestamp: new Date(song.created_at).toISOString()
  };
  const buttons = pending
    ? [{ type: 2, style: 3, label: 'Add to the page', custom_id: `song:approve:${song.id}` }, { type: 2, style: 4, label: 'Reject', custom_id: `song:reject:${song.id}` }]
    : song.status === 'approved'
      ? [{ type: 2, style: 2, label: 'Remove', custom_id: `song:unpublish:${song.id}` }]
      : [{ type: 2, style: 3, label: 'Add anyway', custom_id: `song:approve:${song.id}` }];
  return { embeds: [embed], components: [{ type: 1, components: buttons }], allowed_mentions: { parse: [] } };
}

export async function sendSong(env, id) {
  const time = Date.now();
  const song = await env.DB.prepare(`UPDATE songs SET delivery_after=?, delivery_attempts=delivery_attempts+1
    WHERE id=? AND status='pending' AND discord_message_id IS NULL AND delivery_after<=? RETURNING *`).bind(time + 120000, id, time).first();
  if (!song) return;
  try {
    const payload = songMessage(song);
    payload.content = `<@${env.MODERATOR_USER_ID}>`;
    payload.allowed_mentions = { parse: [], users: [env.MODERATOR_USER_ID] };
    const response = await fetch(`${api}/channels/${env.DISCORD_CHANNEL_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Discord delivery HTTP ${response.status}`);
    const sent = await response.json();
    await env.DB.prepare('UPDATE songs SET discord_message_id=? WHERE id=?').bind(sent.id, id).run();
  } catch (error) {
    console.error('Song delivery will retry:', error.message);
    await env.DB.prepare('UPDATE songs SET delivery_after=? WHERE id=?')
      .bind(Date.now() + Math.min(21600000, 60000 * 2 ** Math.min(song.delivery_attempts, 8)), id).run();
  }
}

export async function syncSong(env, id) {
  const song = await env.DB.prepare('SELECT * FROM songs WHERE id=? AND sync_needed=1').bind(id).first();
  if (!song?.discord_message_id) return;
  const response = await fetch(`${api}/channels/${env.DISCORD_CHANNEL_ID}/messages/${song.discord_message_id}`, {
    method: 'PATCH', headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(songMessage(song)), signal: AbortSignal.timeout(8000)
  });
  if (response.ok || response.status === 404) await env.DB.prepare('UPDATE songs SET sync_needed=0 WHERE id=? AND status=?').bind(id, song.status).run();
  else throw new Error(`Discord update HTTP ${response.status}`);
}

export async function applySongDecision(env, id, action, messageId) {
  const after = action === 'approve' ? 'approved' : 'rejected';
  const allowed = action === 'approve' ? "('pending','rejected')" : action === 'unpublish' ? "('approved')" : "('pending')";
  await env.DB.prepare(`UPDATE songs SET status=?, reviewed_at=?, sync_needed=1 WHERE id=? AND status IN ${allowed} AND discord_message_id=?`)
    .bind(after, Date.now(), id, messageId).run();
  await syncSong(env, id);
}

export async function publicSongs(env) {
  const { results } = await env.DB.prepare("SELECT title,artist,name,note,reviewed_at FROM songs WHERE status='approved' ORDER BY reviewed_at DESC LIMIT 30").all();
  return { songs: results.map(s => ({ title: s.title, artist: s.artist, name: s.name, note: s.note || null })) };
}

export async function insertSong(env, song) {
  await env.DB.prepare('INSERT INTO songs(id,title,artist,name,note,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
    .bind(song.id, song.title, song.artist, song.name, song.note, Date.now()).run();
}
