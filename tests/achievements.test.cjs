const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../easter-eggs.js'), 'utf8');

// Deterministic browser fixtures let us check active time without waiting 30 minutes.
function site({ pathname = '/', storage = new Map(), errorPage = false, portraits = false } = {}) {
    let now = 100000000, nextTimer = 0;
    const timers = new Map();
    class Element {
        constructor() {
            this.listeners = {}; this.children = []; this.selectors = {}; this.dataset = {};
            this.attributes = {}; this.style = {}; this.textContent = ''; this.value = '';
            const classes = new Set();
            this.classList = { add: (...items) => items.forEach(x => classes.add(x)), remove: x => classes.delete(x), contains: x => classes.has(x) };
        }
        addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
        emit(name, event = {}) { for (const handler of this.listeners[name] || []) handler({ target: this, preventDefault() {}, stopPropagation() {}, ...event }); }
        appendChild(child) { this.children.push(child); }
        querySelector(selector) { return this.selectors[selector] ||= new Element(); }
        setAttribute(name, value) { this.attributes[name] = value; }
        getAttribute(name) { return this.attributes[name]; }
        matches() { return false; }
        closest() { return null; }
        focus() {}
        remove() {}
    }
    const body = new Element(); body.dataset.page = errorPage ? '404' : '';
    const cards = portraits ? Array.from({ length: 7 }, (_, i) => {
        const card = new Element(); card.querySelector('img').setAttribute('src', `friend-${i}.png`); return card;
    }) : [];
    const count = new Element();
    const document = new Element();
    Object.assign(document, {
        readyState: 'complete', body, hidden: false, focused: true,
        hasFocus: () => document.focused,
        createElement: () => new Element(), getElementById: () => null,
        querySelectorAll: selector => selector === '#hall-of-fame .friend-card' ? cards : selector === '[data-achievement-count]' ? [count] : []
    });
    const window = new Element();
    function schedule(fn, delay, interval, args) { const id = ++nextTimer; timers.set(id, { fn, due: now + delay, interval, args }); return id; }
    Object.assign(window, {
        location: { pathname, href: 'https://pixelis.dev' + pathname },
        setInterval: (fn, delay) => schedule(fn, delay, delay, []),
        setTimeout: (fn, delay, ...args) => schedule(fn, delay, 0, args),
        clearTimeout: id => timers.delete(id),
        matchMedia: () => ({ matches: false })
    });
    const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
    vm.runInNewContext(source, { document, window, localStorage, Date: ClockDate, URL, requestAnimationFrame: fn => fn() });
    function advance(ms) {
        const end = now + ms;
        while (true) {
            let next;
            for (const entry of timers) if (entry[1].due <= end && (!next || entry[1].due < next[1].due)) next = entry;
            if (!next) break;
            const [id, timer] = next; now = timer.due;
            if (timer.interval) timer.due += timer.interval; else timers.delete(id);
            timer.fn(...timer.args);
        }
        now = end;
    }
    const terminal = body.children.find(el => el.className === 'egg-terminal');
    return {
        storage, document, window, cards, advance, count,
        awards: () => JSON.parse(storage.get('pixelisAchievements') || '{}'),
        totalTime: () => JSON.parse(storage.get('pixelisActiveTimeMs') || '0'),
        award: id => window.emit('pixelis:achievement', { detail: { id } }),
        command: cmd => {
            terminal.querySelector('.egg-terminal-input').value = cmd;
            terminal.querySelector('form').emit('submit');
            return terminal.querySelector('.egg-terminal-output').textContent;
        },
        listen(file, seconds, extra = {}) {
            const audio = { id: 'siteAudio', currentSrc: `https://pixelis.dev/assets/music/${file}.mp3`, paused: false, seeking: false, ...extra };
            for (let t = 0; t <= seconds; t++) { audio.currentTime = t; document.emit('timeupdate', { target: audio }); }
        }
    };
}

test('retired awards migrate away, commands fail, and current awards remain', () => {
    const storage = new Map([['pixelisAchievements', JSON.stringify({ goat: { title: 'certified goat' }, fivehours: {}, biscuits: {}, blackmail: {}, lockin: {} })]]);
    const page = site({ storage });
    assert.deepEqual(Object.keys(page.awards()), ['goat']);
    for (const cmd of ['fivehours', 'biscuits', 'blackmail', 'lockin', 'pixel']) {
        assert.ok(page.command(cmd).includes('command not found: ' + cmd));
        page.award(cmd);
    }
    assert.deepEqual(Object.keys(page.awards()), ['goat']);
    assert.match(page.command('achievements'), /2\/20 unlocked/);
    assert.equal(Number(page.count.textContent), 20);
});

test('nosy requires all seven distinct Hall of Fame portraits and persists between visits', () => {
    let page = site({ portraits: true });
    for (let i = 0; i < 8; i++) page.cards[0].emit('click');
    assert.equal(page.awards().nosy, undefined);
    for (let i = 1; i < 6; i++) page.cards[i].emit('click');
    assert.equal(page.awards().nosy, undefined);
    page = site({ storage: page.storage, portraits: true });
    page.cards[6].emit('keydown', { key: 'Enter', repeat: true });
    assert.equal(page.awards().nosy, undefined);
    page.cards[6].emit('keydown', { key: 'Enter' });
    assert.ok(page.awards().nosy);
    assert.match(page.command('achievements'), /somehow managed to inspect everybody/);
});

test('lost detects the error-page marker even at an unknown nested URL', () => {
    const page = site({ pathname: '/missing/deep/page', errorPage: true });
    assert.ok(page.awards().lost);
    assert.equal(page.storage.has('pixelisMainPagesSeen'), false);
    assert.equal(site({ pathname: '/404.html' }).awards().lost, undefined);
});

test('completionist requires the eight main pages, canonicalizes URLs, and excludes maintenance pages', () => {
    const storage = new Map();
    for (const pathname of ['/index.html', '/games', '/changelog.html', '/games/chess/index.html', '/games/typing/', '/games/sequence-memory/', '/games/reaction-time/', '/games/snake/', '/games/aim-trainer/']) {
        assert.equal(site({ pathname, storage }).awards().completionist, undefined);
    }
    const page = site({ pathname: '/games/wordle/', storage });
    assert.ok(page.awards().completionist);
    assert.match(page.command('achievements'), /there was genuinely no reason to visit all of this/);
});

test('meta achievement counts five distinct hidden interactions, not commands or repetitions', () => {
    let page = site();
    for (let i = 0; i < 6; i++) page.award('terminal');
    for (const cmd of ['whoami', 'sudo', 'secrets', 'achievements']) page.command(cmd);
    assert.equal(page.awards()['why-like-this'], undefined);
    for (const id of ['goat', 'hall-secret', 'secret-track']) page.award(id);
    assert.equal(page.awards()['why-like-this'], undefined);
    page = site({ storage: page.storage });
    page.award('snowstorm');
    assert.ok(page.awards()['why-like-this']);
    const awarded = page.awards()['why-like-this'].unlockedAt;
    page.award('snowstorm');
    assert.equal(page.awards()['why-like-this'].unlockedAt, awarded);
});

test('audiophile needs five distinct tracks with five seconds of playback each', () => {
    const page = site();
    for (let i = 0; i < 5; i++) page.listen('same-track', 6);
    assert.equal(page.awards().audiophile, undefined);
    page.listen('paused-track', 10, { paused: true });
    page.listen('seeking-track', 10, { seeking: true });
    page.listen('short-track', 4);
    for (const file of ['two', 'three', 'four']) page.listen(file, 5);
    assert.equal(page.awards().audiophile, undefined);
    page.listen('five', 5);
    assert.ok(page.awards().audiophile);
});

test('active time stops after one minute idle and excludes hidden or unfocused tabs', () => {
    const page = site();
    page.advance(2 * 60 * 60 * 1000);
    assert.equal(page.totalTime(), 60000);
    assert.equal(page.awards()['touch-grass'], undefined);
    page.document.hidden = true;
    page.document.emit('pointerdown'); page.advance(60000);
    assert.equal(page.totalTime(), 60000);
    page.document.hidden = false; page.document.focused = false;
    page.document.emit('pointerdown'); page.advance(60000);
    assert.equal(page.totalTime(), 60000);
});

test('touch grass unlocks at 30 minutes of activity accumulated across page visits', () => {
    let page = site();
    for (let i = 0; i < 30; i++) { page.advance(30000); page.document.emit('pointerdown'); }
    assert.equal(page.totalTime(), 900000);
    page = site({ pathname: '/games/', storage: page.storage });
    for (let i = 0; i < 29; i++) { page.advance(30000); page.document.emit('pointerdown'); }
    assert.equal(page.awards()['touch-grass'], undefined);
    page.advance(30000);
    assert.equal(page.totalTime(), 1800000);
    assert.ok(page.awards()['touch-grass']);
});
