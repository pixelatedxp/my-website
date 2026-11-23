// One-time helper: log in to Spotify and print the refresh token for the Worker.
//
//   1. developer.spotify.com/dashboard → Create app. Redirect URI: http://127.0.0.1:8888/callback
//      (tick "Web API"). Copy the Client ID and Client secret.
//   2. node scripts/spotify-auth.mjs <client id> <client secret>
//   3. Open the link it prints, approve, then save the three values it prints with `npx wrangler secret put`.
//
// Nothing is stored on disk. The only permissions asked for are reading what is playing right now.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/spotify-auth.mjs <client id> <client secret>');
  process.exit(1);
}

const redirectUri = 'http://127.0.0.1:8888/callback';
const state = randomBytes(16).toString('hex');
const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  client_id: clientId,
  response_type: 'code',
  redirect_uri: redirectUri,
  scope: 'user-read-currently-playing user-read-playback-state',
  state
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const finish = (message, ok) => {
    res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' })
      .end(`<body style="font:18px system-ui;padding:40px">${message}</body>`);
    server.close();
  };
  if (url.searchParams.get('state') !== state) return finish('State did not match. Run the script again.', false);
  if (url.searchParams.get('error')) return finish('Spotify said: ' + url.searchParams.get('error'), false);
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64') },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code') || '', redirect_uri: redirectUri })
    });
    const result = await response.json();
    if (!response.ok || !result.refresh_token) throw new Error(result.error_description || result.error || `HTTP ${response.status}`);
    finish('Done. Go back to the terminal.', true);
    console.log('\nSuccess. Now run these three commands in the backend folder and paste each value when asked:\n');
    console.log('  npx wrangler secret put SPOTIFY_CLIENT_ID      →', clientId);
    console.log('  npx wrangler secret put SPOTIFY_CLIENT_SECRET  → (your client secret)');
    console.log('  npx wrangler secret put SPOTIFY_REFRESH_TOKEN  →', result.refresh_token);
    console.log('\nThen: npm run deploy\n');
  } catch (error) {
    finish('Could not finish login: ' + error.message, false);
    console.error('Login failed:', error.message);
  }
});

server.listen(8888, '127.0.0.1', () => {
  console.log('\nOpen this link in your browser and approve:\n\n' + authUrl + '\n');
});
