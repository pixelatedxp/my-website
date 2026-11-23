const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
    const window = {};
    const document = { getElementById: () => null };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../presence.js'), 'utf8'), { window, document, URL });
    return window.PixelPresence;
}

test('summarize shows song, game with icon, custom status and avatar while online', () => {
    const P = load();
    const view = P.summarize({
        discord_status: 'dnd',
        discord_user: { id: '1009828837141528696', avatar: 'a_0cc191fc7caf916cac907d9d73ff0207' },
        listening_to_spotify: true,
        spotify: { song: 'unhappy', artist: 's0rrow', album_art_url: 'https://i.scdn.co/image/abc', timestamps: { start: 1, end: 2 } },
        activities: [
            { type: 4, state: 'bleh' },
            { type: 0, name: 'ROBLOX', application_id: '363445589247131668', assets: { large_image: '123456' }, timestamps: { start: 5 } }
        ]
    });
    assert.equal(view.status, 'dnd');
    assert.equal(view.custom, 'bleh');
    assert.equal(view.song.title, 'unhappy');
    assert.equal(view.song.art, 'https://i.scdn.co/image/abc');
    assert.equal(view.game.name, 'ROBLOX');
    assert.equal(view.game.icon, 'https://cdn.discordapp.com/app-assets/363445589247131668/123456.png?size=128');
    assert.equal(view.avatar, 'https://cdn.discordapp.com/avatars/1009828837141528696/a_0cc191fc7caf916cac907d9d73ff0207.png?size=512');
});

test('offline or unavailable presence hides activity, and untrusted image hosts are dropped', () => {
    const P = load();
    const offline = P.summarize({ discord_status: 'offline', listening_to_spotify: true, spotify: { song: 'x' }, activities: [{ type: 0, name: 'Game' }, { type: 4, state: 'hi' }] });
    assert.equal(offline.song, null); assert.equal(offline.game, null); assert.equal(offline.custom, '');
    assert.equal(P.summarize(null).status, 'unavailable');
    assert.equal(P.imageUrl('https://evil.example/a.png'), '');
    assert.equal(P.imageUrl('http://i.scdn.co/image/a'), '');
    const game = P.summarize({ discord_status: 'online', activities: [{ type: 0, name: 'Counter-Strike 2' }] }).game;
    assert.equal(game.icon, 'assets/games/counter-strike-2.png');
});

test('time helpers never mention a place', () => {
    const P = load();
    assert.equal(P.partOfDay(3), 'the middle of the night');
    assert.equal(P.partOfDay(9), 'morning');
    assert.equal(P.partOfDay(19), 'evening');
    assert.equal(P.duration(125 * 60000), 'for 2h 5m');
    assert.equal(P.clock(71), '1:11');
});

test('direct Spotify answers become the same song the card shows, and fall back to Discord when unusable', () => {
    const P = load();
    const song = P.directSong({ configured: true, playing: true, title: 'unhappy', artist: 's0rrow', albumArt: 'https://i.scdn.co/image/mid', progressMs: 72000, durationMs: 171000, ageMs: 3000 }, 1000000);
    assert.equal(song.title, 'unhappy');
    assert.equal(song.artist, 's0rrow');
    assert.equal(song.art, 'https://i.scdn.co/image/mid');
    assert.equal(song.start, 1000000 - 75000);
    assert.equal(song.end, song.start + 171000);
    assert.equal(P.directSong({ configured: true, playing: false }, 1), null);       // Spotify says nothing is playing
    assert.equal(P.directSong({ configured: false }, 1), undefined);                // not set up: use Discord
    assert.equal(P.directSong({ configured: true, error: 'x' }, 1), undefined);     // Spotify down: use Discord
    assert.equal(P.directSong({ configured: true, playing: true, title: 'x', albumArt: 'https://evil.example/a.png' }, 1).art, '');
});

test('paused songs stay on the card with a frozen bar, and only real Spotify links are clickable', () => {
    const P = load();
    const paused = P.directSong({ configured: true, playing: false, paused: true, title: 'Lucid Dreams', artist: 'Juice WRLD', progressMs: 5000, durationMs: 239835, url: 'https://open.spotify.com/track/285pBltuF7vW8TeWk8hdRR' }, 1);
    assert.equal(paused.paused, true); assert.equal(paused.progress, 5000); assert.equal(paused.length, 239835);
    assert.equal(paused.url, 'https://open.spotify.com/track/285pBltuF7vW8TeWk8hdRR');
    assert.equal(P.spotifyUrl('javascript:alert(1)'), '');
    assert.equal(P.spotifyUrl('https://open.spotify.com.evil.example/track/x'), '');
    const lanyard = P.summarize({ discord_status: 'online', listening_to_spotify: true, spotify: { song: 'x', track_id: '285pBltuF7vW8TeWk8hdRR' }, activities: [] });
    assert.equal(lanyard.song.url, 'https://open.spotify.com/track/285pBltuF7vW8TeWk8hdRR');
});

test('last played song and how long ago', () => {
  const P = load();
  assert.equal(P.lastSong({ configured: true, playing: false }), null);
  const last = P.lastSong({ configured: true, playing: false, last: { title: 'Lucid Dreams', artist: 'Juice WRLD', albumArt: 'https://i.scdn.co/image/a', url: 'https://open.spotify.com/track/xyz', playedAt: '2026-11-23T17:00:00.000Z' } });
  assert.equal(last.title, 'Lucid Dreams'); assert.equal(last.url, 'https://open.spotify.com/track/xyz');
  const t = Date.parse('2026-11-23T17:00:00.000Z');
  assert.equal(P.ago(t, t + 20e3), 'just now'); assert.equal(P.ago(t, t + 5 * 60e3), '5m ago');
  assert.equal(P.ago(t, t + 3 * 3600e3), '3h ago'); assert.equal(P.ago(t, t + 30 * 3600e3), 'yesterday'); assert.equal(P.ago(t, t + 80 * 3600e3), '3d ago');
  assert.equal(P.lastLabel(last, t + 2 * 3600e3), 'last played · 2h ago');
  assert.equal(P.lastSong({ configured: true, last: { title: 'x', url: 'https://evil.example/' } }).url, '');
});
