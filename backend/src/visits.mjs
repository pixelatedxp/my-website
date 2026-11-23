// Visit counter for the homepage footer. Counts each visitor once per (UTC) day.
// A visitor is a SHA-256 of their IP and user agent with a random salt that exists for one day only;
// the hash and salt are deleted after two days, so nothing can be traced back to a person.
// VISITS_START (a Worker variable) is added to the real count, so the counter can carry on from an older total.

const today = () => new Date().toISOString().slice(0, 10);

function offset(env) {
  const start = Number.parseInt(env.VISITS_START || '0', 10);
  return Number.isFinite(start) && start > 0 ? start : 0;
}

async function total(env) {
  const row = await env.DB.prepare("SELECT value FROM site_counters WHERE name='visits'").first();
  return (row ? Number(row.value) : 0) + offset(env);
}

async function saltFor(env, day) {
  const fresh = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT INTO visit_salts(day, salt) VALUES (?, ?) ON CONFLICT(day) DO NOTHING').bind(day, fresh).run();
  return (await env.DB.prepare('SELECT salt FROM visit_salts WHERE day=?').bind(day).first()).salt;
}

async function fingerprint(request, salt) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const agent = (request.headers.get('User-Agent') || '').slice(0, 300);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${ip}|${agent}`));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function readVisits(env) {
  return { visits: await total(env) };
}

export async function recordVisit(request, env) {
  const day = today();
  const visitor = await fingerprint(request, await saltFor(env, day));
  const seen = await env.DB.prepare('INSERT INTO visit_seen(day, visitor) VALUES (?, ?) ON CONFLICT(day, visitor) DO NOTHING').bind(day, visitor).run();
  const counted = Number(seen?.meta?.changes ?? seen?.meta?.rows_written ?? 0) > 0;
  if (counted) await env.DB.prepare("UPDATE site_counters SET value = value + 1 WHERE name='visits'").run();
  return { visits: await total(env), counted };
}

export async function forgetOldVisitors(env) {
  const keepFrom = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); // today and yesterday
  await env.DB.prepare('DELETE FROM visit_seen WHERE day < ?').bind(keepFrom).run();
  await env.DB.prepare('DELETE FROM visit_salts WHERE day < ?').bind(keepFrom).run();
}
