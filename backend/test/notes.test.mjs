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
