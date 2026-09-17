import { HttpError, UUID, validateNote, validateDoodle, readLimited, discordText } from './validation.mjs';

const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
const list = value => (value || '').split(',').map(v => v.trim()).filter(Boolean);
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
const hash = async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
const now = () => Date.now();
const api = 'https://discord.com/api/v10';

export function moderationMessage(note) {
  const pending = note.status === 'pending';
  const embed = {
    title: pending ? 'A new note for pixelis.dev' : note.status === 'approved' ? 'Note approved' : 'Note rejected / unpublished',
    description: discordText(JSON.parse(note.content)),
    color: pending ? 0x3ca7cb : note.status === 'approved' ? 0x43b581 : 0xed4245,
    fields: [
      { name: 'From', value: note.anonymous ? 'Anonymous' : discordText([{ text: note.name }]), inline: true },
      { name: 'Submitted', value: `<t:${Math.floor(note.created_at / 1000)}:f>`, inline: true },
      { name: 'Rules', value: 'Visitor confirmed the text and doodle follow the rules.' }
    ],
    footer: { text: `Note ${note.id} · ${pending ? 'Waiting for your approval' : 'Reviewed'}` },
    timestamp: new Date(note.created_at).toISOString()
  };
  if (note.doodle) embed.image = { url: 'attachment://doodle.png' };
  const buttons = pending
    ? [{ type: 2, style: 3, label: 'Approve', custom_id: `note:approve:${note.id}` }, { type: 2, style: 4, label: 'Reject', custom_id: `note:reject:${note.id}` }]
    : note.status === 'approved'
      ? [{ type: 2, style: 2, label: 'Unpublish', custom_id: `note:unpublish:${note.id}` }]
      : [{ type: 2, style: 3, label: 'Approve anyway', custom_id: `note:approve:${note.id}` }];
  return { embeds: [embed], components: [{ type: 1, components: buttons }], allowed_mentions: { parse: [] } };
}

async function sendNote(env, id) {
  const lease = crypto.randomUUID(); const time = now();
  const note = await env.DB.prepare(`UPDATE notes SET delivery_lease=?, delivery_after=?, delivery_attempts=delivery_attempts+1
    WHERE id=? AND status='pending' AND discord_message_id IS NULL AND delivery_after<=? RETURNING *`)
    .bind(lease, time + 120000, id, time).first();
  if (!note) return;
  try {
    const payload = moderationMessage(note);
    // Notify only the configured moderator. Visitor text stays in the embed and
    // cannot create mentions because its allowed_mentions list remains empty.
    payload.content = `<@${env.MODERATOR_USER_ID}>`;
    payload.allowed_mentions = { parse: [], users: [env.MODERATOR_USER_ID] };
    payload.nonce = note.id.replaceAll('-', '').slice(0, 25); payload.enforce_nonce = true;
    const form = new FormData();
    if (note.doodle) {
      payload.attachments = [{ id: 0, filename: 'doodle.png', description: 'Visitor doodle submitted with the note' }];
      form.append('files[0]', new Blob([new Uint8Array(note.doodle)], { type: 'image/png' }), 'doodle.png');
    }
    form.append('payload_json', JSON.stringify(payload));
    const response = await fetch(`${api}/channels/${env.DISCORD_CHANNEL_ID}/messages`, { method: 'POST', headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }, body: form, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Discord delivery HTTP ${response.status}`);
    const sent = await response.json();
    await env.DB.prepare('UPDATE notes SET discord_message_id=?, delivery_lease=NULL WHERE id=? AND delivery_lease=?').bind(sent.id, id, lease).run();
  } catch (error) {
    console.error('Note delivery will retry:', error.message);
    await env.DB.prepare('UPDATE notes SET delivery_after=?, delivery_lease=NULL WHERE id=? AND delivery_lease=?')
      .bind(now() + Math.min(21600000, 60000 * 2 ** Math.min(note.delivery_attempts, 8)), id, lease).run();
  }
}

async function syncNote(env, id) {
  const note = await env.DB.prepare('SELECT * FROM notes WHERE id=? AND sync_needed=1').bind(id).first();
  if (!note?.discord_message_id) return;
  const response = await fetch(`${api}/channels/${env.DISCORD_CHANNEL_ID}/messages/${note.discord_message_id}`, {
    method: 'PATCH', headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(moderationMessage(note)), signal: AbortSignal.timeout(8000)
  });
  if (response.ok || response.status === 404) {
    await env.DB.prepare('UPDATE notes SET sync_needed=0 WHERE id=? AND status=?').bind(id, note.status).run();
  } else throw new Error(`Discord update HTTP ${response.status}`);
}

export async function applyDecision(env, id, action, messageId) {
  const after = action === 'approve' ? 'approved' : 'rejected';
  const allowed = action === 'approve' ? "('pending','rejected')" : action === 'unpublish' ? "('approved')" : "('pending')";
  await env.DB.prepare(`UPDATE notes SET status=?, reviewed_at=?, reviewed_by=?, sync_needed=1
    WHERE id=? AND status IN ${allowed} AND discord_message_id=?`)
    .bind(after, now(), env.MODERATOR_USER_ID, id, messageId).run();
  await syncNote(env, id);
}

export async function verifyDiscord(request, body, publicKey) {
  const signature = request.headers.get('x-signature-ed25519') || '';
  const timestamp = request.headers.get('x-signature-timestamp') || '';
  if (!/^[a-f0-9]{128}$/i.test(signature) || !/^\d+$/.test(timestamp) || Math.abs(now() / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/i.test(publicKey || '')) return false;
  const fromHex = value => Uint8Array.from(value.match(/../g), v => parseInt(v, 16));
  try {
    const key = await crypto.subtle.importKey('raw', fromHex(publicKey), 'Ed25519', false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, fromHex(signature), encoder.encode(timestamp + body));
  } catch { return false; }
}

async function interactions(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = new TextDecoder().decode(await readLimited(request.body, 65536));
  if (!await verifyDiscord(request, body, env.DISCORD_PUBLIC_KEY)) return json({ error: 'Invalid signature' }, 401);
  let event; try { event = JSON.parse(body); } catch { return json({ error: 'Invalid request' }, 400); }
  if (event.application_id !== env.DISCORD_APPLICATION_ID) return json({ error: 'Wrong application' }, 403);
  if (event.type === 1) return json({ type: 1 });
  const deny = content => json({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });
  if (event.type !== 3 || event.guild_id !== env.DISCORD_GUILD_ID || event.channel_id !== env.DISCORD_CHANNEL_ID || event.member?.user?.id !== env.MODERATOR_USER_ID) {
    return deny('Only Pixel can review notes in the configured review channel.');
  }
  const match = /^note:(approve|reject|unpublish):(.+)$/.exec(event.data?.custom_id || '');
  if (!match || !UUID.test(match[2]) || !/^\d+$/.test(event.message?.id || '')) return deny('This note action is not valid.');
  // Acknowledge promptly; the durable sync flag lets the scheduled job retry a failed edit.
  ctx.waitUntil(applyDecision(env, match[2], match[1], event.message.id).catch(error => console.error('Review action failed:', error.message)));
  return json({ type: 6 });
}

async function rateLimit(request, env) {
  const time = now(); const day = Math.floor(time / 86400000); const hour = Math.floor(time / 3600000);
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.RATE_LIMIT_SALT || env.DISCORD_BOT_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const privateId = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${day}:${ip}`)));
  // Count only after Turnstile accepts the request. A visitor must be able to
  // retry a bad doodle without failed validation locking them out.
  const buckets = [[`hour:${hour}:${privateId}`, 5], [`day:${day}:${privateId}`, 20], [`global:${day}`, 250]];
  for (const [bucket, limit] of buckets) {
    const row = await env.DB.prepare(`INSERT INTO submission_limits(bucket,count,expires_at) VALUES (?,1,?)
      ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count`).bind(bucket, time + 172800000).first();
    if (row.count > limit) throw new HttpError(429, 'Too many notes for now. Please try again later.');
  }
}

async function submit(request, env, ctx) {
  if (!env.DISCORD_BOT_TOKEN || !env.TURNSTILE_SECRET_KEY) throw new HttpError(503, 'Notes are not accepting submissions just yet. Your draft is safe here.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Please submit through the note form.');
  const raw = new TextDecoder().decode(await readLimited(request.body, 200000));
  let input; try { input = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid submission.'); }
  const note = validateNote(input);
  // Exclude Turnstile's one-use token from the retry fingerprint.
  const requestHash = await hash(JSON.stringify({ ...note, doodle: input.doodle || null }));
  const existing = await env.DB.prepare('SELECT request_hash FROM notes WHERE id=?').bind(note.id).first();
  if (existing) {
    if (existing.request_hash !== requestHash) throw new HttpError(409, 'This draft changed after it was submitted. Please start a new note.');
    return json({ accepted: true, id: note.id }, 202);
  }
  if (typeof input.turnstileToken !== 'string' || !input.turnstileToken || input.turnstileToken.length > 2048) throw new HttpError(400, 'Please complete the spam check.');
  const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: input.turnstileToken, remoteip: request.headers.get('CF-Connecting-IP') || undefined }),
    signal: AbortSignal.timeout(8000)
  });
  const result = await verification.json();
  if (!result.success || !list(env.TURNSTILE_HOSTNAMES).includes(result.hostname) || result.action !== 'leave-note') {
    throw new HttpError(400, 'The spam check expired or failed. Please try it again.');
  }
  const doodle = await validateDoodle(input.doodle);
  await rateLimit(request, env);
  const createdAt = now();
  await env.DB.prepare(`INSERT INTO notes(id,request_hash,name,anonymous,content,doodle,colour,created_at)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .bind(note.id, requestHash, note.name, Number(note.anonymous), JSON.stringify(note.content), doodle ? doodle.buffer : null, note.colour, createdAt).run();
  const stored = await env.DB.prepare('SELECT request_hash FROM notes WHERE id=?').bind(note.id).first();
  if (stored.request_hash !== requestHash) throw new HttpError(409, 'This submission ID is already in use.');
  ctx.waitUntil(sendNote(env, note.id));
  return json({ accepted: true, id: note.id }, 202);
}

async function publicNotes(url, env) {
  const cursor = url.searchParams.get('before');
  let group = 0, rank = -1, timestamp = Number.MAX_SAFE_INTEGER, id = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
  if (cursor) {
    const parts = cursor.split('_'); group = Number(parts[0]); rank = Number(parts[1]); timestamp = Number(parts[2]); id = parts[3];
    if (![0, 1].includes(group) || !Number.isInteger(rank) || !Number.isSafeInteger(timestamp) || timestamp < 0 || !UUID.test(id || '')) throw new HttpError(400, 'Invalid page.');
  }
  const { results } = await env.DB.prepare(`SELECT id,name,anonymous,content,colour,created_at,pinned_rank,doodle IS NOT NULL AS has_doodle,
    CASE WHEN pinned_rank IS NULL THEN 1 ELSE 0 END AS sort_group
    FROM notes WHERE status='approved' AND (
      CASE WHEN pinned_rank IS NULL THEN 1 ELSE 0 END > ? OR
      (CASE WHEN pinned_rank IS NULL THEN 1 ELSE 0 END = ? AND (COALESCE(pinned_rank, -1) > ? OR
        (COALESCE(pinned_rank, -1) = ? AND (created_at < ? OR (created_at = ? AND id < ?)))))
    ) ORDER BY sort_group ASC, pinned_rank ASC, created_at DESC, id DESC LIMIT 25`)
    .bind(group, group, rank, rank, timestamp, timestamp, id).all();
  const rows = results.slice(0, 24);
  return json({ notes: rows.map(n => ({ id: n.id, name: n.anonymous ? 'Anonymous' : n.name, anonymous: !!n.anonymous,
    content: JSON.parse(n.content), colour: n.colour, createdAt: new Date(n.created_at).toISOString(),
    pinned: n.pinned_rank !== null, doodleUrl: n.has_doodle ? `/api/notes/${n.id}/doodle` : null })),
    nextCursor: results.length > 24 ? `${rows.at(-1).sort_group}_${rows.at(-1).pinned_rank ?? -1}_${rows.at(-1).created_at}_${rows.at(-1).id}` : null });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url); const origin = request.headers.get('origin');
    let response;
    try {
      if (url.pathname === '/discord/interactions') return await interactions(request, env, ctx);
      if (origin && !list(env.ALLOWED_ORIGINS).includes(origin)) return json({ error: 'Origin not allowed' }, 403);
      if (request.method === 'OPTIONS') response = new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
      else if (url.pathname === '/health') response = json({ ok: true });
      else if (url.pathname === '/api/notes' && request.method === 'GET') response = await publicNotes(url, env);
      else if (url.pathname === '/api/notes' && request.method === 'POST') {
        if (!origin || !list(env.ALLOWED_ORIGINS).includes(origin)) throw new HttpError(403, 'Please use the note page to submit.');
        response = await submit(request, env, ctx);
      } else {
        const match = /^\/api\/notes\/([^/]+)\/doodle$/.exec(url.pathname);
        if (request.method === 'GET' && match && UUID.test(match[1])) {
          const row = await env.DB.prepare("SELECT doodle FROM notes WHERE id=? AND status='approved'").bind(match[1]).first();
          response = row?.doodle ? new Response(new Uint8Array(row.doodle), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }) : json({ error: 'Not found' }, 404);
        } else response = json({ error: 'Not found' }, 404);
      }
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('Notes request failed:', error.message);
      response = json({ error: error instanceof HttpError ? error.message : 'Something went wrong. Your draft is safe; please try again.' }, error.status || 503);
    }
    if (origin && list(env.ALLOWED_ORIGINS).includes(origin)) { response.headers.set('Access-Control-Allow-Origin', origin); response.headers.set('Vary', 'Origin'); }
    return response;
  },
  async scheduled(event, env, ctx) {
    if (!env.DISCORD_BOT_TOKEN) return;
    const { results: pending } = await env.DB.prepare("SELECT id FROM notes WHERE status='pending' AND discord_message_id IS NULL AND delivery_after<=? LIMIT 3").bind(now()).all();
    const { results: updates } = await env.DB.prepare('SELECT id FROM notes WHERE sync_needed=1 LIMIT 3').all();
    await Promise.allSettled([...pending.map(n => sendNote(env, n.id)), ...updates.map(n => syncNote(env, n.id))]);
    await env.DB.prepare('DELETE FROM submission_limits WHERE expires_at < ?').bind(now()).run();
  }
};
