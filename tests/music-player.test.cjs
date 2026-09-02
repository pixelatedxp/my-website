const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../music-player.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

// These are isolated media-policy fixtures, not browser session data.
function createPlayer(saved, autoplay = true) {
    const ids = new Map();
    const policy = { allowed: false, attempts: 0, contexts: [] };
    class Element {
        constructor(id) {
            this.id = id;
            this.listeners = new Map();
            this.style = { setProperty() {} };
            this.classList = { toggle() {}, add() {} };
            this.clientWidth = 160;
            this.scrollWidth = 220;
        }
        addEventListener(type, fn, options) {
            const list = this.listeners.get(type) || [];
            list.push({ fn, once: !!(options && options.once) });
            this.listeners.set(type, list);
        }
        removeEventListener(type, fn) {
            this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item.fn !== fn));
        }
        emit(type, event = {}) {
            for (const item of [...(this.listeners.get(type) || [])]) {
                if (item.once) this.removeEventListener(type, item.fn);
                item.fn({ target: this, ...event });
            }
        }
        appendChild(el) { if (el.id) ids.set(el.id, el); }
        closest(selector) { return selector === '#' + this.id ? this : null; }
        querySelector(selector) {
            if (!this.children) this.children = new Map();
            if (!this.children.has(selector)) this.children.set(selector, new Element());
            return this.children.get(selector);
        }
        querySelectorAll() { return Array.from({ length: 12 }, () => new Element()); }
        set innerHTML(value) {
            for (const match of value.matchAll(/id="([^"]+)"/g)) ids.set(match[1], new Element(match[1]));
        }
    }
    class Audio extends Element {
        constructor() {
            super();
            this.paused = true;
            this.currentTime = 0;
            this.duration = 166;
            this.volume = .65;
        }
        load() { queueMicrotask(() => this.emit('loadedmetadata')); }
        play() {
            policy.attempts++;
            if (!policy.allowed) return Promise.reject(new Error('NotAllowedError'));
            this.paused = false;
            this.emit('play');
            return Promise.resolve();
        }
        pause() {
            const wasPlaying = !this.paused;
            this.paused = true;
            if (wasPlaying) this.emit('pause');
        }
    }
    class AudioContext {
        constructor() { this.state = 'suspended'; policy.contexts.push(this); }
        resume() {
            if (!policy.allowed) return Promise.reject(new Error('NotAllowedError'));
            this.state = 'running';
            return Promise.resolve();
        }
        createAnalyser() { return { frequencyBinCount: 32, connect() {}, getByteFrequencyData() {} }; }
        createMediaElementSource() { return { connect() {} }; }
    }
    const document = new Element();
    document.readyState = 'complete';
    document.currentScript = { getAttribute: () => autoplay ? 'true' : null };
    document.head = new Element();
    document.body = new Element();
    document.createElement = tag => tag === 'audio' ? new Audio() : new Element();
    document.getElementById = id => ids.get(id);
    const window = new Element();
    window.location = { pathname: '/index.html' };
    window.AudioContext = AudioContext;
    let stored = saved ? JSON.stringify(saved) : null;
    const sessionStorage = { getItem: () => stored, setItem: (_, value) => { stored = value; } };
    vm.runInNewContext(source, {
        window, document, sessionStorage, queueMicrotask,
        requestAnimationFrame: () => 1, cancelAnimationFrame() {}
    });
    return {
        policy, document, window, audio: ids.get('siteAudio'), player: ids.get('musicPlayer'),
        state: () => JSON.parse(stored),
        interact: type => document.emit(type),
        next() { ids.get('musicNext').emit('click'); },
        previous() { ids.get('musicPrev').emit('click'); },
        toggle() {
            const button = ids.get('musicToggle');
            document.emit('click', { target: button });
            button.emit('click');
        }
    };
}

test('blocked initial autoplay retries from an ordinary click and unlocks the audio context', async () => {
    const p = createPlayer();
    await settle();
    assert.equal(p.audio.paused, true);
    assert.equal(p.state().playing, true);
    p.policy.allowed = true;
    p.interact('click');
    await settle();
    assert.equal(p.audio.paused, false);
    assert.equal(p.policy.contexts[0].state, 'running');
    assert.equal(p.audio.loop, true);
});

test('a saved non-playing state does not disable interaction startup; failed gestures can retry', async () => {
    const p = createPlayer({ index: 0, paused: false, playing: false, time: 0 }, false);
    await settle();
    p.interact('pointerup');
    await settle();
    assert.equal(p.audio.paused, true);
    p.policy.allowed = true;
    p.interact('click');
    await settle();
    assert.equal(p.audio.paused, false);
    assert.equal(p.policy.attempts, 2);
});

for (const gesture of ['touchend', 'keydown']) {
    test(gesture + ' starts music without touching play', async () => {
        const p = createPlayer(null, false);
        await settle();
        p.policy.allowed = true;
        p.interact(gesture);
        await settle();
        assert.equal(p.audio.paused, false);
    });
}

test('blocked page-to-page resumption keeps the selected track and position', async () => {
    const p = createPlayer({ file: 'eminem-without-me.mp3', paused: false, playing: true, time: 42 });
    await settle();
    assert.equal(p.audio.currentTime, 42);
    p.policy.allowed = true;
    p.interact('click');
    await settle();
    assert.equal(p.audio.paused, false);
    assert.equal(p.audio.currentTime, 42);
    assert.match(p.audio.src, /eminem-without-me/);
});

test('a deliberate saved pause is respected on ordinary interactions', async () => {
    const p = createPlayer({ file: '180db-130-super-slowed.mp3', paused: true, playing: false, time: 42 });
    await settle();
    p.policy.allowed = true;
    p.interact('click');
    p.interact('keydown');
    await settle();
    assert.equal(p.policy.attempts, 0);
    assert.equal(p.audio.paused, true);
});

test('the play button handles its own click once and pausing prevents later auto-start', async () => {
    const p = createPlayer(null, false);
    await settle();
    p.policy.allowed = true;
    p.toggle();
    await settle();
    assert.equal(p.policy.attempts, 1);
    assert.equal(p.audio.paused, false);
    p.toggle();
    p.interact('click');
    await settle();
    assert.equal(p.audio.paused, true);
    assert.equal(p.state().paused, true);
    assert.equal(p.state().playing, false);
});

test('Without Me is the default looping song with its official single cover', async () => {
    const p = createPlayer(null, false);
    await settle();
    assert.match(p.audio.src, /eminem-without-me\.mp3$/);
    assert.equal(p.audio.loop, true);
    assert.equal(p.player.querySelector('.music-track').textContent, 'Eminem - Without Me');
    assert.match(p.player.querySelector('.music-thumb').src, /eminem-without-me-cover\.jpg$/);
});

test('sessions on the previous default move to Without Me without carrying over its time', async () => {
    const p = createPlayer({ file: '180db-130-super-slowed.mp3', time: 42, playing: true, volume: .4 });
    await settle();
    assert.match(p.audio.src, /eminem-without-me\.mp3$/);
    assert.equal(p.audio.currentTime, 0);
    assert.equal(p.audio.volume, .4);
    assert.equal(p.state().defaultFile, 'eminem-without-me.mp3');
    p.policy.allowed = true;
    p.interact('click');
    await settle();
    assert.equal(p.audio.paused, false);
});

test('180db remains selectable and resumes after the one-time default migration', async () => {
    const p = createPlayer(null, false);
    await settle();
    p.next();
    await settle();
    assert.match(p.audio.src, /180db-130-super-slowed\.mp3$/);
    const resumed = createPlayer({ ...p.state(), time: 42 }, false);
    await settle();
    assert.match(resumed.audio.src, /180db-130-super-slowed\.mp3$/);
    assert.equal(resumed.audio.currentTime, 42);
    p.previous();
    await settle();
    assert.match(p.audio.src, /eminem-without-me\.mp3$/);
    assert.equal(p.audio.loop, true);
});

test('other selected songs and the secret track keep their position across the update', async () => {
    const p = createPlayer({ file: 'close my eyes.mp3', time: 42 }, false);
    const rare = createPlayer({ file: '180db-130-super-slowed.mp3', rare: true, time: 64 }, false);
    await settle();
    assert.match(p.audio.src, /close%20my%20eyes\.mp3$/);
    assert.equal(p.audio.currentTime, 42);
    assert.match(rare.audio.src, /i%20have%20no%20friends\.mp3$/);
    assert.equal(rare.audio.currentTime, 64);
});

test('legacy numeric playlist saves still map to the same non-default song', async () => {
    const p = createPlayer({ index: 1, time: 42 }, false);
    await settle();
    assert.match(p.audio.src, /close%20my%20eyes\.mp3$/);
    assert.equal(p.audio.currentTime, 42);
});
