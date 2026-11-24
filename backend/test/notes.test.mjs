import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { deflateSync } from 'node:zlib';
import worker, { applyDecision, moderationMessage, verifyDiscord } from '../src/worker.mjs';
import { validateNote, validateDoodle, crc32, discordText } from '../src/validation.mjs';

const valid = () => ({ id: crypto.randomUUID(), name: 'Visitor', anonymous: false, content: [{ text: 'Glad I stopped by.', bold: true }], colour: 'yellow', rulesAccepted: true, turnstileToken: 'test-token' });
function database() {
  const sqlite = new DatabaseSync(':memory:');
  const migrations = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(migrations).sort()) sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'));
  return { sqlite, prepare(sql) {
    let args = [];
    return { bind(...values) { args = values.map(v => v instanceof ArrayBuffer ? new Uint8Array(v) : v); return this; },
      async first() { return sqlite.prepare(sql).get(...args) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
      async run() { return { meta: sqlite.prepare(sql).run(...args) }; } };
  } };
}
function fixture(t) {
  const DB = database(); const tasks = []; const sent = []; let failDiscord = false, verification = { success: true, hostname: 'pixelis.dev', action: 'leave-note' };
  const env = { DB, DISCORD_BOT_TOKEN: 'test-only', TURNSTILE_SECRET_KEY: 'test-only', ALLOWED_ORIGINS: 'https://pixelis.dev', TURNSTILE_HOSTNAMES: 'pixelis.dev', DISCORD_APPLICATION_ID: '100', DISCORD_CHANNEL_ID: '200', DISCORD_GUILD_ID: '300', MODERATOR_USER_ID: '400' };
  const ctx = { waitUntil(promise) { tasks.push(promise); } };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.includes('siteverify')) return Response.json(verification);
    sent.push({ url, ...init });
    if (failDiscord) return Response.json({}, { status: 503 });
    return Response.json({ id: '999' });
  });
  const request = (payload, origin = 'https://pixelis.dev') => new Request('https://notes.example/api/notes', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' }, body: JSON.stringify(payload) });
  return { env, ctx, DB, sent, request, failDelivery() { failDiscord = true; }, setVerification(v) { verification = v; }, async drain() { await Promise.all(tasks); tasks.length = 0; } };
}
function png(width = 480, height = 240, expandedExtra = 0) {
  const chunk = (type, data) => {
    const label = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([label, data])));
    return Buffer.concat([length, label, data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const data = Buffer.alloc(height * (1 + width * 4) + expandedExtra);
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

function palettePng(extraChunk = null) {
  const chunk = (type, data) => {
    const label = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([label, data])));
    return Buffer.concat([length, label, data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(480); ihdr.writeUInt32BE(240, 4); ihdr[8] = 8; ihdr[9] = 3;
  const pixels = Buffer.alloc(240 * 481); // one filter byte plus 480 palette indexes per row
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('PLTE', Buffer.from([255, 245, 173])), ...(extraChunk ? [chunk(...extraChunk)] : []), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

test('250 visible characters, safe formatting, rules, and anonymous names are enforced server-side', () => {
  assert.equal(validateNote({ ...valid(), content: [{ text: '💚'.repeat(250) }] }).content[0].text.length, 500);
  assert.throws(() => validateNote({ ...valid(), content: [{ text: 'a'.repeat(251) }] }), /250/);
  assert.throws(() => validateNote({ ...valid(), rulesAccepted: false }), /rules/);
  assert.equal(validateNote({ ...valid(), anonymous: true, name: 'Must not be stored' }).name, 'Anonymous');
  assert.throws(() => validateNote({ ...valid(), name: 'x'.repeat(33) }), /32/);
  assert.deepEqual(validateNote({ ...valid(), content: [{ text: '<img onerror=evil>', bold: 'true', html: '<script>' }] }).content, [{ text: '<img onerror=evil>', bold: false, italic: false, underline: false }]);
  assert.match(discordText([{ text: '@everyone <@123> [link](url)' }]), /\\</);
});

test('doodles accept bounded PNGs and reject wrong dimensions, SVGs, corrupted CRCs, and decompression overflow', async () => {
  assert.ok(await validateDoodle(png()) instanceof Uint8Array);
  assert.ok(await validateDoodle(palettePng()) instanceof Uint8Array);
  assert.ok(await validateDoodle(palettePng(['iCCP', Buffer.from('Display P3\0\0profile')])) instanceof Uint8Array);
  assert.equal(await validateDoodle(null), null);
  await assert.rejects(validateDoodle(png(4096, 240)), /doodle/);
  await assert.rejects(validateDoodle('data:image/svg+xml;base64,PHN2Zz4='), /doodle/);
  await assert.rejects(validateDoodle(png(480, 240, 1)), /doodle/);
  const corrupt = Buffer.from(png().slice(22), 'base64'); corrupt[30] ^= 1;
  await assert.rejects(validateDoodle('data:image/png;base64,' + corrupt.toString('base64')), /doodle/);
});

test('submission remains private until owner approval; repeated retries do not duplicate notes or embeds', async t => {
  const f = fixture(t); const input = { ...valid(), anonymous: true, name: 'Hidden name', doodle: png() };
  const first = await worker.fetch(f.request(input), f.env, f.ctx); assert.equal(first.status, 202); await f.drain();
  assert.equal(f.sent.length, 1);
  const payload = JSON.parse(f.sent[0].body.get('payload_json'));
  assert.equal(payload.content, '<@400>');
  assert.deepEqual(payload.allowed_mentions, { parse: [], users: ['400'] });
  assert.equal(payload.embeds[0].fields[0].value, 'Anonymous');
  assert.equal(payload.components[0].components[0].style, 3); assert.equal(payload.components[0].components[1].style, 4);
  assert.equal(payload.embeds[0].image.url, 'attachment://doodle.png');
  assert.equal(f.DB.sqlite.prepare('SELECT name FROM notes').get().name, 'Anonymous');
  assert.deepEqual((await (await worker.fetch(new Request('https://notes.example/api/notes'), f.env, f.ctx)).json()).notes, []);
  assert.equal((await worker.fetch(new Request(`https://notes.example/api/notes/${input.id}/doodle`), f.env, f.ctx)).status, 404);
  assert.equal((await worker.fetch(f.request(input), f.env, f.ctx)).status, 202); await f.drain(); assert.equal(f.sent.length, 1);
  assert.equal((await worker.fetch(f.request({ ...input, content: [{ text: 'Changed' }] }), f.env, f.ctx)).status, 409);
  await applyDecision(f.env, input.id, 'approve', '999');
  const result = await (await worker.fetch(new Request('https://notes.example/api/notes'), f.env, f.ctx)).json();
  assert.equal(result.notes.length, 1); assert.equal(result.notes[0].name, 'Anonymous');
  assert.ok(result.notes[0].createdAt.endsWith('Z'));
  assert.equal((await worker.fetch(new Request(`https://notes.example/api/notes/${input.id}/doodle`), f.env, f.ctx)).status, 200);
  await applyDecision(f.env, input.id, 'reject', '999'); assert.equal(f.DB.sqlite.prepare('SELECT status FROM notes').get().status, 'approved');
  await applyDecision(f.env, input.id, 'unpublish', '999');
  assert.equal((await worker.fetch(new Request(`https://notes.example/api/notes/${input.id}/doodle`), f.env, f.ctx)).status, 404);
  f.DB.sqlite.prepare("UPDATE notes SET status='rejected'").run();
  await applyDecision(f.env, input.id, 'approve', '999');
  assert.equal(f.DB.sqlite.prepare('SELECT status FROM notes').get().status, 'approved');
  assert.equal(moderationMessage({ ...f.DB.sqlite.prepare('SELECT * FROM notes').get(), doodle: null }).components[0].components[0].label, 'Unpublish');
});

test('rejected notes have an approve-anyway button', () => {
  const message = moderationMessage({ id: crypto.randomUUID(), status: 'rejected', content: JSON.stringify([{ text: 'Second thoughts.' }]), anonymous: 1, name: 'Anonymous', created_at: Date.now(), doodle: null });
  assert.equal(message.components[0].components[0].label, 'Approve anyway');
  assert.equal(message.components[0].components[0].style, 3);
});

test('untrusted origins, missing Turnstile, wrong hostname/action, and submission floods fail closed', async t => {
  const f = fixture(t);
  assert.equal((await worker.fetch(f.request(valid(), 'https://evil.example'), f.env, f.ctx)).status, 403);
  assert.equal((await worker.fetch(f.request({ ...valid(), turnstileToken: '' }), f.env, f.ctx)).status, 400);
  f.setVerification({ success: true, hostname: 'evil.example', action: 'leave-note' });
  assert.equal((await worker.fetch(f.request(valid()), f.env, f.ctx)).status, 400);
  assert.equal(f.DB.sqlite.prepare("SELECT count(*) AS n FROM submission_limits WHERE bucket LIKE 'global:%'").get().n, 0);
  f.setVerification({ success: true, hostname: 'pixelis.dev', action: 'wrong' });
  assert.equal((await worker.fetch(f.request(valid()), f.env, f.ctx)).status, 400);
  f.setVerification({ success: true, hostname: 'pixelis.dev', action: 'leave-note' });
  for (let i = 0; i < 5; i++) { assert.equal((await worker.fetch(f.request(valid()), f.env, f.ctx)).status, 202); await f.drain(); }
  assert.equal((await worker.fetch(f.request(valid()), f.env, f.ctx)).status, 429);
});

test('Discord delivery failures leave a durable retryable note without publishing it', async t => {
  const f = fixture(t); f.failDelivery();
  assert.equal((await worker.fetch(f.request(valid()), f.env, f.ctx)).status, 202); await f.drain();
  const row = f.DB.sqlite.prepare('SELECT * FROM notes').get();
  assert.equal(row.status, 'pending'); assert.equal(row.discord_message_id, null); assert.equal(row.delivery_lease, null); assert.ok(row.delivery_after > Date.now());
});

test('signed Discord interactions restrict moderator, server, channel and application and reject stale or forged requests', async t => {
  const f = fixture(t); const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('hex'); f.env.DISCORD_PUBLIC_KEY = publicKey;
  const event = { type: 3, application_id: '100', guild_id: '300', channel_id: '200', member: { user: { id: '400' } }, data: { custom_id: `note:approve:${crypto.randomUUID()}` }, message: { id: '999' } };
  async function signed(value, timestamp = String(Math.floor(Date.now() / 1000))) {
    const body = JSON.stringify(value); const signature = Buffer.from(await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(timestamp + body))).toString('hex');
    return new Request('https://notes.example/discord/interactions', { method: 'POST', body, headers: { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp } });
  }
  assert.equal((await worker.fetch(await signed({ type: 1, application_id: '100' }), f.env, f.ctx)).status, 200);
  for (const changed of [{ ...event, member: { user: { id: '401' } } }, { ...event, guild_id: '301' }, { ...event, channel_id: '201' }]) {
    assert.equal((await (await worker.fetch(await signed(changed), f.env, f.ctx)).json()).data.flags, 64);
  }
  assert.equal((await worker.fetch(await signed({ ...event, application_id: '101' }), f.env, f.ctx)).status, 403);
  assert.equal((await worker.fetch(await signed(event, '1'), f.env, f.ctx)).status, 401);
  assert.equal(await verifyDiscord(new Request('https://notes.example'), '{}', publicKey), false);
  assert.equal((await (await worker.fetch(await signed(event), f.env, f.ctx)).json()).type, 6); await f.drain();
});

test('approved notes paginate without exposing private records or delivery metadata', async t => {
  const f = fixture(t); const insert = f.DB.sqlite.prepare("INSERT INTO notes(id,request_hash,name,anonymous,content,colour,status,created_at) VALUES (?,?,?,?,?,?,?,?)");
  for (let i = 0; i < 27; i++) insert.run(crypto.randomUUID(), 'privatehash', 'Person', 0, '[{"text":"hello"}]', 'blue', i === 26 ? 'pending' : 'approved', 1700000000000 + i);
  const first = await (await worker.fetch(new Request('https://notes.example/api/notes'), f.env, f.ctx)).json();
  assert.equal(first.notes.length, 24); assert.ok(first.nextCursor); assert.equal(first.notes[0].request_hash, undefined);
  const second = await (await worker.fetch(new Request('https://notes.example/api/notes?before=' + first.nextCursor), f.env, f.ctx)).json();
  assert.equal(second.notes.length, 2); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.notes, ...second.notes].map(n => n.id)).size, 26);
});

test('postmark badges are optional, validated, shown to the moderator, and returned once approved', async t => {
  assert.equal(validateNote(valid()).badge, null);
  assert.equal(validateNote({ ...valid(), badge: 'cat' }).badge, 'cat');
  assert.throws(() => validateNote({ ...valid(), badge: 'dragon' }), /postmark/);
  assert.throws(() => validateNote({ ...valid(), badge: '<b>' }), /postmark/);
  const f = fixture(t); const input = { ...valid(), badge: 'ghost' };
  assert.equal((await worker.fetch(f.request(input), f.env, f.ctx)).status, 202); await f.drain();
  const payload = JSON.parse(f.sent[0].body.get('payload_json'));
  assert.deepEqual(payload.embeds[0].fields.find(field => field.name === 'Postmark'), { name: 'Postmark', value: 'ghost', inline: true });
  await applyDecision(f.env, input.id, 'approve', '999');
  const result = await (await worker.fetch(new Request('https://notes.example/api/notes'), f.env, f.ctx)).json();
  assert.equal(result.notes[0].badge, 'ghost');
});

test('now playing comes straight from Spotify, shaped like the card, cached, and safe when not set up', async t => {
  const { resetSpotifyCache, shapePlaying } = await import('../src/spotify.mjs');
  const base = { DB: database(), ALLOWED_ORIGINS: 'https://pixelis.dev' };
  const get = env => worker.fetch(new Request('https://notes.example/api/now-playing', { headers: { Origin: 'https://pixelis.dev' } }), env, { waitUntil() {} });

  resetSpotifyCache();
  let res = await get(base);
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), { configured: false });

  const env = { ...base, SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh' };
  let playingCalls = 0, tokenCalls = 0, mode = 'track';
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).startsWith('https://accounts.spotify.com/api/token')) {
      tokenCalls++;
      assert.match(init.headers.Authorization, /^Basic /);
      assert.equal(new URLSearchParams(init.body).get('refresh_token'), 'refresh');
      return Response.json({ access_token: 'token', expires_in: 3600 });
    }
    playingCalls++;
    assert.equal(init.headers.Authorization, 'Bearer token');
    if (mode === 'none') return new Response(null, { status: 204 });
    return Response.json({ is_playing: true, progress_ms: 72000, currently_playing_type: 'track', item: {
      name: 'unhappy', duration_ms: 171000, external_urls: { spotify: 'https://open.spotify.com/track/abc' },
      artists: [{ name: 's0rrow' }, { name: 'friend' }],
      album: { images: [{ url: 'https://i.scdn.co/image/big', width: 640 }, { url: 'https://i.scdn.co/image/mid', width: 300 }, { url: 'https://i.scdn.co/image/small', width: 64 }] } } });
  });

  res = await get(env);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://pixelis.dev');
  const body = await res.json();
  assert.equal(body.playing, true); assert.equal(body.title, 'unhappy'); assert.equal(body.artist, 's0rrow, friend');
  assert.equal(body.albumArt, 'https://i.scdn.co/image/mid'); assert.equal(body.progressMs, 72000); assert.equal(body.durationMs, 171000);
  assert.equal(body.url, 'https://open.spotify.com/track/abc');

  await get(env); // served from the 10 s cache
  assert.equal(playingCalls, 1); assert.equal(tokenCalls, 1);

  resetSpotifyCache(); mode = 'none';
  assert.deepEqual(await (await get(env)).json(), { configured: true, playing: false, ageMs: 0 });

  // Paused, untrusted art hosts and missing items never show as playing.
  assert.equal(shapePlaying({ is_playing: false, item: { name: 'x' } }).playing, false);
  assert.equal(shapePlaying({ is_playing: true, item: { name: 'x', album: { images: [{ url: 'https://evil.example/x.png', width: 640 }] } } }).albumArt, null);
});

test('visits count each visitor once a day, start from VISITS_START, store no IPs, and forget old days', async () => {
  const { forgetOldVisitors } = await import('../src/visits.mjs');
  const env = { DB: database(), ALLOWED_ORIGINS: 'https://pixelis.dev', VISITS_START: '500' };
  const visit = (ip, agent = 'Firefox', origin = 'https://pixelis.dev') => worker.fetch(new Request('https://notes.example/api/visits', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': ip, 'User-Agent': agent } }), env, { waitUntil() {} });

  assert.deepEqual(await (await worker.fetch(new Request('https://notes.example/api/visits'), env, { waitUntil() {} })).json(), { visits: 500 });
  assert.deepEqual(await (await visit('192.0.2.1')).json(), { visits: 501, counted: true });
  assert.deepEqual(await (await visit('192.0.2.1')).json(), { visits: 501, counted: false }); // same person, same day
  assert.deepEqual(await (await visit('192.0.2.2')).json(), { visits: 502, counted: true });
  assert.equal((await visit('192.0.2.3', 'x', 'https://evil.example')).status, 403);

  const stored = env.DB.sqlite.prepare('SELECT visitor FROM visit_seen').all().map(r => r.visitor).join(' ');
  assert.doesNotMatch(stored, /192\.0\.2/);
  assert.match(stored, /^[0-9a-f]{64} [0-9a-f]{64}$/);

  env.DB.sqlite.prepare("UPDATE visit_seen SET day='2000-01-01'").run();
  env.DB.sqlite.prepare("UPDATE visit_salts SET day='2000-01-01'").run();
  await forgetOldVisitors(env);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM visit_seen').get().n, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM visit_salts').get().n, 0);
  assert.deepEqual(await (await worker.fetch(new Request('https://notes.example/api/visits'), env, { waitUntil() {} })).json(), { visits: 502 });
});

test('a paused Spotify song keeps its details so the card can show it as paused', async () => {
  const { shapePlaying } = await import('../src/spotify.mjs');
  const paused = shapePlaying({ is_playing: false, progress_ms: 5000, currently_playing_type: 'track', item: { name: 'Lucid Dreams', duration_ms: 239835, artists: [{ name: 'Juice WRLD' }], album: { images: [{ url: 'https://i.scdn.co/image/abc', width: 300 }] }, external_urls: { spotify: 'https://open.spotify.com/track/x' } } });
  assert.equal(paused.playing, false); assert.equal(paused.paused, true);
  assert.equal(paused.title, 'Lucid Dreams'); assert.equal(paused.progressMs, 5000); assert.equal(paused.url, 'https://open.spotify.com/track/x');
  assert.equal(shapePlaying({ is_playing: true, item: { name: 'x', external_urls: { spotify: 'javascript:alert(1)' } } }).url, null);
});

test('when nothing is playing, the last played song comes along; an old token without the permission stays idle', async t => {
  const { resetSpotifyCache } = await import('../src/spotify.mjs');
  const env = { DB: database(), ALLOWED_ORIGINS: 'https://pixelis.dev', SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh' };
  const get = () => worker.fetch(new Request('https://notes.example/api/now-playing'), env, { waitUntil() {} });
  let recentStatus = 200, recentCalls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    url = String(url);
    if (url.startsWith('https://accounts.spotify.com/')) return Response.json({ access_token: 'token', expires_in: 3600 });
    if (url.includes('/currently-playing')) return new Response(null, { status: 204 });
    recentCalls++;
    if (recentStatus !== 200) return new Response('{}', { status: recentStatus });
    return Response.json({ items: [{ played_at: '2026-11-23T17:00:00.000Z', track: { name: 'Lucid Dreams', artists: [{ name: 'Juice WRLD' }],
      external_urls: { spotify: 'https://open.spotify.com/track/xyz' }, album: { images: [{ url: 'https://i.scdn.co/image/art', width: 300 }] } } }] });
  });
  resetSpotifyCache();
  const body = await (await get()).json();
  assert.equal(body.playing, false);
  assert.deepEqual(body.last, { title: 'Lucid Dreams', artist: 'Juice WRLD', albumArt: 'https://i.scdn.co/image/art', url: 'https://open.spotify.com/track/xyz', playedAt: '2026-11-23T17:00:00.000Z' });
  resetSpotifyCache(); recentStatus = 403;
  const idle = await (await get()).json();
  assert.equal(idle.last, undefined); assert.equal(idle.playing, false);
  assert.equal(recentCalls, 2);
});

async function signer(f) {
  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  f.env.DISCORD_PUBLIC_KEY = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('hex');
  return async value => {
    const timestamp = String(Math.floor(Date.now() / 1000)); const body = JSON.stringify({ application_id: '100', guild_id: '300', channel_id: '200', member: { user: { id: '400' } }, ...value });
    const signature = Buffer.from(await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(timestamp + body))).toString('hex');
    return new Request('https://notes.example/discord/interactions', { method: 'POST', body, headers: { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp } });
  };
}

test('Pixel can reply to a postcard from Discord; the reply shows on the wall and can be removed', async t => {
  const f = fixture(t); const signed = await signer(f);
  const note = valid();
  await worker.fetch(f.request(note), f.env, f.ctx); await f.drain();
  await applyDecision(f.env, note.id, 'approve', '999');
  // The reply button opens a modal, pre-filled with the current reply.
  const modal = await (await worker.fetch(await signed({ type: 3, data: { custom_id: `note:reply:${note.id}` }, message: { id: '999' } }), f.env, f.ctx)).json();
  assert.equal(modal.type, 9); assert.equal(modal.data.custom_id, `note-reply:${note.id}`); assert.equal(modal.data.components[0].components[0].value, undefined);
  const submit = text => signed({ type: 5, data: { custom_id: `note-reply:${note.id}`, components: [{ type: 1, components: [{ type: 4, custom_id: 'reply', value: text }] }] }, message: { id: '999' } });
  assert.equal((await (await worker.fetch(await submit('  thank you <3  '), f.env, f.ctx)).json()).type, 6); await f.drain();
  const wall = async () => (await (await worker.fetch(new Request('https://notes.example/api/notes'), f.env, f.ctx)).json()).notes[0];
  assert.equal((await wall()).reply, 'thank you <3');
  // The Discord message is updated to show the reply and an "Edit reply" button.
  const patch = JSON.parse(f.sent.at(-1).body);
  assert.equal(patch.embeds[0].fields.at(-1).name, 'Your reply'); assert.equal(patch.components[0].components.at(-1).label, 'Edit reply');
  assert.equal((await (await worker.fetch(await signed({ type: 3, data: { custom_id: `note:reply:${note.id}` }, message: { id: '999' } }), f.env, f.ctx)).json()).data.components[0].components[0].value, 'thank you <3');
  assert.equal((await (await worker.fetch(await submit('x'.repeat(201)), f.env, f.ctx)).json()).data.flags, 64);
  await worker.fetch(await submit(''), f.env, f.ctx); await f.drain();
  assert.equal((await wall()).reply, null);
  // Only Pixel can reply.
  assert.equal((await (await worker.fetch(await signed({ type: 5, member: { user: { id: '401' } }, data: { custom_id: `note-reply:${note.id}`, components: [] } }), f.env, f.ctx)).json()).data.flags, 64);
});

test('visitors can send a song; it shows on the music page only after Pixel adds it', async t => {
  const f = fixture(t); const signed = await signer(f);
  f.setVerification({ success: true, hostname: 'pixelis.dev', action: 'send-song' });
  const post = body => worker.fetch(new Request('https://notes.example/api/songs', { method: 'POST', headers: { Origin: 'https://pixelis.dev', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' }, body: JSON.stringify(body) }), f.env, f.ctx);
  const list = async () => (await (await worker.fetch(new Request('https://notes.example/api/songs'), f.env, f.ctx)).json()).songs;
  const song = { id: crypto.randomUUID(), title: ' Sweater   Weather ', artist: 'The Neighbourhood', name: '', note: 'a classic', turnstileToken: 'ok' };
  assert.equal((await post({ ...song, title: '' })).status, 400);
  assert.equal((await post({ ...song, website: 'spam' })).status, 400);
  assert.equal((await post({ ...song, note: 'x'.repeat(201) })).status, 400);
  assert.equal((await post(song)).status, 202); await f.drain();
  const message = JSON.parse(f.sent.at(-1).body);
  assert.match(message.embeds[0].description, /Sweater Weather/); assert.equal(message.components[0].components[0].custom_id, `song:approve:${song.id}`);
  assert.deepEqual(await list(), []);
  assert.equal((await (await worker.fetch(await signed({ type: 3, data: { custom_id: `song:approve:${song.id}` }, message: { id: '999' } }), f.env, f.ctx)).json()).type, 6); await f.drain();
  assert.deepEqual(await list(), [{ title: 'Sweater Weather', artist: 'The Neighbourhood', name: 'someone', note: 'a classic' }]);
  await worker.fetch(await signed({ type: 3, data: { custom_id: `song:unpublish:${song.id}` }, message: { id: '999' } }), f.env, f.ctx); await f.drain();
  assert.deepEqual(await list(), []);
  // The postcard spam check token cannot be reused for songs.
  f.setVerification({ success: true, hostname: 'pixelis.dev', action: 'leave-note' });
  assert.equal((await post({ ...song, id: crypto.randomUUID() })).status, 400);
});

test('on repeat: top five songs, cached, and a clear flag when the permission is missing', async t => {
  const { topTracks, resetTopCache, resetSpotifyCache } = await import('../src/spotify.mjs');
  const env = { SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh' };
  let status = 200, calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).startsWith('https://accounts.spotify.com/')) return Response.json({ access_token: 'token', expires_in: 3600 });
    calls++;
    if (status !== 200) return new Response('{}', { status });
    return Response.json({ items: Array.from({ length: 6 }, (_, i) => ({ name: `song ${i}`, artists: [{ name: 'artist' }], external_urls: { spotify: `https://open.spotify.com/track/t${i}` }, album: { images: [{ url: 'https://i.scdn.co/image/a', width: 300 }] } })) });
  });
  resetSpotifyCache(); resetTopCache();
  let result = await topTracks(env);
  assert.equal(result.body.tracks.length, 5); assert.deepEqual(result.body.tracks[0], { title: 'song 0', artist: 'artist', albumArt: 'https://i.scdn.co/image/a', url: 'https://open.spotify.com/track/t0' });
  await topTracks(env); assert.equal(calls, 1);
  resetTopCache(); status = 403;
  result = await topTracks(env);
  assert.equal(result.body.needsPermission, true); assert.deepEqual(result.body.tracks, []);
  assert.deepEqual((await topTracks({})).body, { configured: false, tracks: [] });
});

test('listening time: plays are recorded once each and totalled for today, this week and this year', async t => {
  const { recordPlays, listeningTime, periodStarts, resetSpotifyCache } = await import('../src/spotify.mjs');
  const env = { DB: database(), SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh' };
  const now = Date.parse('2026-11-25T12:00:00Z'); // a Wednesday
  const plays = [
    ['2026-11-25T11:00:00Z', 180000], ['2026-11-25T10:00:00Z', 240000], // today: 7 min
    ['2026-11-23T09:00:00Z', 300000],                                    // Monday, same week: 5 min
    ['2026-03-01T09:00:00Z', 600000],                                    // earlier this year: 10 min
    ['2025-12-31T23:00:00Z', 600000]                                     // last year
  ];
  let afterSeen = [];
  t.mock.method(globalThis, 'fetch', async url => {
    url = String(url);
    if (url.startsWith('https://accounts.spotify.com/')) return Response.json({ access_token: 'token', expires_in: 3600 });
    afterSeen.push(new URL(url).searchParams.get('after'));
    return Response.json({ items: plays.map(([at, ms], i) => ({ played_at: at, track: { id: `t${i}`, duration_ms: ms } })) });
  });
  resetSpotifyCache();
  assert.equal(await recordPlays(env), 5);
  assert.equal(await recordPlays(env), 0); // same plays again are ignored
  assert.equal(afterSeen[0], null); assert.equal(afterSeen[1], String(Date.parse('2026-11-25T11:00:00Z')));
  assert.deepEqual(periodStarts(now), { day: Date.parse('2026-11-25T00:00:00Z'), week: Date.parse('2026-11-23T00:00:00Z'), year: Date.parse('2026-01-01T00:00:00Z') });
  assert.deepEqual(await listeningTime(env, now), { today: 7, week: 12, year: 22, allTime: 32, playsThisYear: 4, since: '2025-12-31T23:00:00.000Z' });
});

test('always list is matched to Spotify for art and links, and the recent list holds five songs', async t => {
  const { alwaysTracks, recentlyPlayed, resetSpotifyCache, ALWAYS } = await import('../src/spotify.mjs');
  const env = { SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh' };
  t.mock.method(globalThis, 'fetch', async url => {
    url = String(url);
    if (url.startsWith('https://accounts.spotify.com/')) return Response.json({ access_token: 'token', expires_in: 3600 });
    if (url.includes('/search')) return Response.json({ tracks: { items: [{ external_urls: { spotify: 'https://open.spotify.com/track/x' }, album: { images: [{ url: 'https://i.scdn.co/image/a', width: 300 }] } }] } });
    return Response.json({ items: Array.from({ length: 8 }, (_, i) => ({ played_at: '2026-11-23T10:00:00Z', track: { name: `s${i}`, artists: [{ name: 'a' }] } })) });
  });
  resetSpotifyCache();
  const result = await alwaysTracks(env);
  assert.equal(result.tracks.length, ALWAYS.length);
  assert.deepEqual(result.tracks[0], { title: 'Buttercup', artist: 'Jack Stauber', albumArt: 'https://i.scdn.co/image/a', url: 'https://open.spotify.com/track/x' });
  assert.equal((await recentlyPlayed(env)).tracks.length, 8);
});

test('a failed Spotify answer keeps the last good recently-played list instead of an empty one', async t => {
  const { recentlyPlayed, resetSpotifyCache } = await import('../src/spotify.mjs');
  const env = { SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh' };
  let fail = false; const realNow = Date.now; let clock = realNow();
  t.mock.method(Date, 'now', () => clock);
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).startsWith('https://accounts.spotify.com/')) return Response.json({ access_token: 'token', expires_in: 3600 });
    if (fail) return new Response('{}', { status: 429 });
    return Response.json({ items: [{ played_at: '2026-11-23T10:00:00Z', track: { name: 'Mist', artists: [{ name: 'EsDeeKid' }] } }] });
  });
  resetSpotifyCache();
  assert.equal((await recentlyPlayed(env)).tracks.length, 1);
  fail = true; clock += 120000; // cache expired, and Spotify now says "slow down"
  assert.equal((await recentlyPlayed(env)).tracks[0].title, 'Mist');
});
