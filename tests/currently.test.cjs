const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../currently.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

async function preview(payload, { hidden = false } = {}) {
    class Element {
        constructor() { this.children = []; this.dataset = {}; this.listeners = {}; this.text = ''; this.attributes = {}; this.style = { setProperty() {} }; }
        set textContent(value) { this.text = value; this.children = []; }
        get textContent() { return this.text + this.children.map(child => child.textContent).join(' '); }
        appendChild(child) { this.children.push(child); }
        replaceChildren(...children) { this.text = ''; this.children = children; }
        setAttribute(name, value) { this.attributes[name] = value; }
        addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
        emit(name) { for (const handler of this.listeners[name] || []) handler(); }
    }
    const card = new Element(); card.dataset.discordId = '1009828837141528696';
    const status = new Element(), content = new Element(), custom = new Element();
    const document = new Element(); document.hidden = hidden;
    document.getElementById = id => ({ currentlyCard: card, currentlyStatus: status, currentlyActivity: content, currentlyCustomStatus: custom })[id];
    document.createElement = () => new Element();
    const window = new Element();
    let now = 0, serial = 0, nextPayload = payload, failure = false, applicationPayload = null;
    const timers = new Map(), calls = [];
    window.setTimeout = (fn, delay) => { const id = ++serial; timers.set(id, { fn, due: now + delay }); return id; };
    window.clearTimeout = id => timers.delete(id);
    const fetch = (url, options) => {
        calls.push({ url, options });
        if (url.includes('/api/v10/applications/')) return Promise.resolve({ ok: !!applicationPayload, json: async () => applicationPayload });
        if (failure === 'timeout') return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));
        if (failure) return Promise.reject(new Error('network unavailable'));
        return Promise.resolve({ ok: true, json: async () => nextPayload });
    };
    vm.runInNewContext(source, { document, window, fetch, AbortController, URL, Date: { now: () => now } });
    await settle();
    return {
        card, status, content, custom, document, window, calls,
        setApplication: value => { applicationPayload = value; },
        setPayload: value => { nextPayload = value; failure = false; },
        fail: value => { failure = value; },
        async advance(ms) {
            const end = now + ms;
            while (true) {
                const next = [...timers].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
                if (!next) break;
                const [id, timer] = next; now = timer.due; timers.delete(id); timer.fn(); await settle();
            }
            now = end;
        }
    };
}
const activity = { success: true, data: { discord_status: 'online', listening_to_spotify: true,
    spotify: { song: 'Example song', artist: 'Example artist' }, activities: [{ type: 0, name: 'Example game', details: 'In a match' }] } };

test('shows listening and playing together from the owner presence', async () => {
    const page = await preview(activity);
    assert.equal(page.card.dataset.status, 'online');
    assert.equal(page.content.children.length, 2);
    assert.match(page.content.textContent, /listening to\s+Example song Example artist/);
    assert.match(page.content.textContent, /playing Example game In a match/);
    assert.equal(page.calls[0].url, 'https://api.lanyard.rest/v1/users/1009828837141528696');
    assert.equal(page.calls[0].options.credentials, 'omit');
});

test('offline clears stale activities; online without activities has its own empty state', async () => {
    const page = await preview(activity);
    page.setPayload({ success: true, data: { ...activity.data, discord_status: 'offline' } });
    await page.advance(30000);
    assert.equal(page.status.textContent, 'status: offline');
    assert.equal(page.content.textContent, 'off the radar for a bit');
    page.setPayload({ success: true, data: { discord_status: 'idle', activities: [] } });
    await page.advance(30000);
    assert.equal(page.status.textContent, 'status: idle');
    assert.equal(page.content.textContent, '[nothing on the record right now]');
});

test('unmonitored accounts, malformed responses, network failures and timeouts never look offline or active', async () => {
    const page = await preview({ success: false, error: { code: 'user_not_monitored' } });
    assert.equal(page.card.dataset.status, 'unavailable');
    page.setPayload(activity); await page.advance(30000);
    page.fail(true); await page.advance(30000);
    assert.equal(page.content.textContent, 'activity unavailable right now');
    page.setPayload(null); await page.advance(30000);
    assert.equal(page.card.dataset.status, 'unavailable');
    page.fail('timeout'); await page.advance(38000);
    assert.equal(page.calls.at(-1).options.signal.aborted, true);
    page.setPayload(activity); await page.advance(30000);
    assert.equal(page.card.dataset.status, 'online');
});

test('pauses polling while hidden and refreshes immediately on return', async () => {
    const page = await preview(activity, { hidden: true });
    assert.equal(page.calls.length, 0);
    page.document.hidden = false; page.document.emit('visibilitychange'); await settle();
    assert.equal(page.calls.length, 1);
    page.document.hidden = true; page.document.emit('visibilitychange'); await page.advance(90000);
    assert.equal(page.calls.length, 1);
    page.document.hidden = false; page.document.emit('visibilitychange'); await settle();
    assert.equal(page.calls.length, 2);
});

test('supports other listening activities, shows custom status separately, and renders external strings as text', async () => {
    const title = '<img src=x onerror=alert(1)>';
    const page = await preview({ success: true, data: { discord_status: 'dnd', activities: [
        { type: 4, name: 'Custom Status', state: 'private-looking status' },
        { type: 2, name: 'Music player', details: title, state: 'Artist' }
    ] } });
    assert.equal(page.status.textContent, 'status: do not disturb');
    assert.equal(page.content.children.length, 1);
    const titleNode = page.content.children[0].children[1].children[1];
    assert.equal(titleNode.textContent, title);
    assert.equal(titleNode.innerHTML, undefined);
    assert.equal(page.content.textContent.includes('private-looking status'), false);
    assert.equal(page.custom.textContent, 'custom status: private-looking status');
    assert.equal(page.custom.hidden, false);
});

test('album and game covers use Spotify and Discord image URLs with fallbacks', async () => {
    const data = structuredClone(activity);
    data.data.spotify.album_art_url = 'https://i.scdn.co/image/example';
    data.data.activities[0].application_id = '123456789';
    data.data.activities[0].assets = { large_image: '987654321' };
    const page = await preview(data);
    assert.equal(page.content.children[0].children[0].children[0].src, 'https://i.scdn.co/image/example');
    assert.equal(page.content.children[1].children[0].children[0].src, 'https://cdn.discordapp.com/app-assets/123456789/987654321.png?size=128');
    page.content.children[0].children[0].children[0].emit('error');
    assert.match(page.content.children[0].children[0].innerHTML, /<svg/);
    data.data.spotify.album_art_url = 'javascript:alert(1)';
    data.data.activities[0].assets.large_image = 'mp:external/example/image.png';
    page.setPayload(data); await page.advance(30000);
    assert.equal(page.content.children[0].children[0].children.length, 0);
    assert.equal(page.content.children[1].children[0].children[0].src, 'https://media.discordapp.net/external/example/image.png');
});

test('known games use local artwork after Discord assets and before the gamepad', async () => {
    const data = structuredClone(activity);
    data.data.activities[0].name = 'Counter-Strike 2';
    const page = await preview(data);
    let image = page.content.children[1].children[0].children[0];
    assert.equal(image.src, '/assets/games/counter-strike-2.png');

    data.data.activities[0].application_id = '123456789';
    data.data.activities[0].assets = { large_image: '987654321' };
    page.setPayload(data); await page.advance(30000);
    image = page.content.children[1].children[0].children[0];
    assert.equal(image.src, 'https://cdn.discordapp.com/app-assets/123456789/987654321.png?size=128');
    image.emit('error');
    assert.equal(image.src, '/assets/games/counter-strike-2.png');
    image.emit('error');
    assert.match(page.content.children[1].children[0].innerHTML, /<svg/);
});

test('uses the Discord application icon when an activity omits rich-presence artwork', async () => {
    const data = structuredClone(activity);
    data.data.activities[0].application_id = '1158877933042143272';
    const page = await preview(data);
    page.setApplication({ id: '1158877933042143272', icon: '558f5a26ecb3b17c3dea3d15c1df537a' });
    page.setPayload(data); await page.advance(30000);
    const image = page.content.children[1].children[0].children[0];
    assert.equal(image.src, 'https://cdn.discordapp.com/app-icons/1158877933042143272/558f5a26ecb3b17c3dea3d15c1df537a.png?size=128');
    assert.ok(page.calls.some(call => call.url === 'https://discord.com/api/v10/applications/1158877933042143272/rpc'));
});

test('song progress advances from Discord timestamps, clamps at the end, and stops the listening animation', async () => {
    const data = structuredClone(activity);
    data.data.spotify.timestamps = { start: 0, end: 10000 };
    const page = await preview(data);
    const row = page.content.children[0];
    const progress = row.children[1].children.at(-1);
    assert.equal(progress.className, 'currently-progress');
    assert.equal(progress.children[0].max, 10);
    await page.advance(5000);
    assert.equal(progress.children[0].value, 5);
    assert.equal(progress.children[1].children[0].textContent, '0:05');
    assert.equal(row.dataset.playing, 'true');
    await page.advance(15000);
    assert.equal(progress.children[0].value, 10);
    assert.equal(row.dataset.playing, 'false');
    assert.equal(progress.children[0].attributes['aria-valuetext'], '0:10 of 0:10');
    page.setPayload({ success: true, data: { discord_status: 'offline' } });
    await page.advance(10000);
    assert.equal(page.content.children[0].className, 'currently-empty');
});

test('missing or invalid timestamps never fabricate a progress bar', async () => {
    const data = structuredClone(activity);
    data.data.spotify.timestamps = { start: 10000, end: 2000 };
    const page = await preview(data);
    assert.equal(page.content.children[0].children[1].children.some(child => child.className === 'currently-progress'), false);
});

test('restoring a cached page resumes progress even when Discord activity has not changed', async () => {
    const data = structuredClone(activity);
    data.data.spotify.timestamps = { start: 0, end: 120000 };
    const page = await preview(data);
    const bar = page.content.children[0].children[1].children.at(-1).children[0];
    page.window.emit('pagehide');
    await page.advance(5000);
    assert.equal(bar.value, 0);
    page.window.emit('pageshow'); await settle();
    assert.equal(bar.value, 5);
    await page.advance(1000);
    assert.equal(bar.value, 6);
});
