(function () {
    'use strict';

    var ACHIEVEMENT_KEY = 'pixelisAchievements';
    var ACHIEVEMENTS = {
        terminal: 'there is no terminal', auditor: 'checked the receipts', whoami: 'identity crisis resolved',
        sudo: 'not in the sudoers file', secrets: 'asked the obvious question', goat: 'certified goat',
        snowstorm: 'weather warning', 'secret-track': 'the B-side',
        'rare-note': 'two percent club', 'hall-secret': 'the portrait speaks', explorer: 'scrolled the whole thing',
        'arcade-tourist': 'arcade regular', 'beat-pixel': 'faster than Pixel',
        nosy: 'nosy', 'touch-grass': 'touch grass', completionist: 'completionist',
        audiophile: 'audiophile', lost: 'lost', 'why-like-this': 'why are you like this'
    };
    var DESCRIPTIONS = {
        nosy: 'somehow managed to inspect everybody',
        lost: "found a page that doesn't exist",
        'why-like-this': 'triggered five different hidden interactions',
        completionist: 'there was genuinely no reason to visit all of this',
        'touch-grass': '30 minutes of active browsing. the outside world misses you.',
        audiophile: 'played five different songs'
    };
    var HIDDEN_INTERACTIONS = ['terminal', 'goat', 'snowstorm', 'secret-track', 'rare-note', 'hall-secret', 'biscuit-vault'];
    var MAIN_PAGES = ['/', '/games/', '/changelog.html', '/games/chess/', '/games/typing/',
        '/games/sequence-memory/', '/games/reaction-time/', '/games/wordle/'];
    var unlocked = loadJson(ACHIEVEMENT_KEY, {});
    var toastStack;
    // Preserve current awards while retiring removed commands and their saved awards.
    Object.keys(unlocked).forEach(function (id) { if (!ACHIEVEMENTS[id]) delete unlocked[id]; });
    saveAchievements();

    function loadJson(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
    }
    function saveAchievements() {
        Object.keys(unlocked).forEach(function (id) { if (!ACHIEVEMENTS[id]) delete unlocked[id]; });
        try { localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(unlocked)); } catch (e) {}
    }
    function toast(message, description) {
        if (!toastStack) {
            toastStack = document.createElement('div');
            toastStack.className = 'egg-toast-stack';
            document.body.appendChild(toastStack);
        }
        var item = document.createElement('div');
        item.className = 'egg-toast';
        item.textContent = message;
        if (description) {
            var detail = document.createElement('span');
            detail.className = 'egg-toast-description';
            detail.textContent = description;
            item.appendChild(detail);
        }
        toastStack.appendChild(item);
        window.setTimeout(function () { item.remove(); }, 4200);
    }
    function unlock(id, title) {
        if (!ACHIEVEMENTS[id]) return false;
        unlocked = Object.assign({}, unlocked, loadJson(ACHIEVEMENT_KEY, {}));
        if (HIDDEN_INTERACTIONS.indexOf(id) !== -1) recordHiddenInteraction(id);
        if (unlocked[id]) return false;
        title = title || ACHIEVEMENTS[id] || id;
        unlocked[id] = { title: title, unlockedAt: new Date().toISOString() };
        saveAchievements();
        toast('[achievement unlocked] ' + title, DESCRIPTIONS[id]);
        return true;
    }
    function recordHiddenInteraction(id) {
        var discoveries = loadJson('pixelisDiscoveries', {});
        HIDDEN_INTERACTIONS.forEach(function (key) { if (unlocked[key]) discoveries[key] = true; });
        if (HIDDEN_INTERACTIONS.indexOf(id) !== -1) discoveries[id] = true;
        try { localStorage.setItem('pixelisDiscoveries', JSON.stringify(discoveries)); } catch (e) {}
        if (HIDDEN_INTERACTIONS.filter(function (key) { return discoveries[key]; }).length >= 5) unlock('why-like-this');
    }
    function spawnHeart(x, y) {
        var heart = document.createElement('span');
        heart.className = 'egg-heart';
        heart.textContent = Math.random() > .5 ? '♥' : '♡';
        heart.style.left = (x - 8 + Math.random() * 16) + 'px';
        heart.style.top = (y - 8 + Math.random() * 16) + 'px';
        document.body.appendChild(heart);
        window.setTimeout(function () { heart.remove(); }, 1500);
    }

    function initTerminal() {
        var terminal = document.createElement('div');
        terminal.className = 'egg-terminal';
        terminal.setAttribute('aria-hidden', 'true');
        terminal.innerHTML = '<div class="egg-terminal-window" role="dialog" aria-modal="true" aria-label="Secret terminal">' +
            '<div class="egg-terminal-bar"><span>pixelis://hidden-terminal</span><button class="egg-terminal-close" type="button" aria-label="Close terminal">[x]</button></div>' +
            '<div class="egg-terminal-output"></div>' +
            '<form class="egg-terminal-form"><span>&gt;</span><input class="egg-terminal-input" autocomplete="off" spellcheck="false" aria-label="Terminal command"><button type="submit">[run]</button></form></div>';
        document.body.appendChild(terminal);
        var output = terminal.querySelector('.egg-terminal-output');
        var input = terminal.querySelector('.egg-terminal-input');
        function print(line) {
            output.textContent += (output.textContent ? '\n' : '') + line;
            output.scrollTop = output.scrollHeight;
        }
        function open(message) {
            terminal.classList.add('open');
            terminal.setAttribute('aria-hidden', 'false');
            if (message) print(message);
            input.focus();
            unlock('terminal', 'there is no terminal');
        }
        function close() {
            terminal.classList.remove('open');
            terminal.setAttribute('aria-hidden', 'true');
        }
        function achievementsText() {
            var names = Object.keys(ACHIEVEMENTS).filter(function (key) { return unlocked[key]; }).map(function (key) {
                return '[x] ' + ACHIEVEMENTS[key] + (DESCRIPTIONS[key] ? '\n    ' + DESCRIPTIONS[key] : '');
            });
            var remaining = Object.keys(ACHIEVEMENTS).filter(function (key) { return !unlocked[key]; }).length;
            return (names.length ? names.join('\n') : '[ ] none yet. suspicious.') +
                '\n\n[ ' + names.length + '/' + Object.keys(ACHIEVEMENTS).length + ' unlocked · ' + remaining + ' remaining ]';
        }
        function run(command) {
            var cmd = command.trim().toLowerCase();
            print('> ' + command);
            var replies = {
                help: 'commands: help, whoami, sudo, secrets, achievements, clear, exit',
                whoami: 'pixel. allegedly a developer. definitely avoiding homework.',
                sudo: 'permission denied. nice try though.',
                secrets: 'poke around. some things respond when you least expect it.'
            };
            if (cmd === 'clear') { output.textContent = ''; return; }
            if (cmd === 'exit') { close(); return; }
            if (cmd === 'achievements') { unlock('auditor', 'checked the receipts'); print(achievementsText()); return; }
            print(replies[cmd] || 'command not found: ' + (cmd || '[silence]'));
            if (cmd === 'whoami') unlock('whoami', 'identity crisis resolved');
            if (cmd === 'sudo') unlock('sudo', 'not in the sudoers file');
            if (cmd === 'secrets') unlock('secrets', 'asked the obvious question');
        }
        terminal.querySelector('.egg-terminal-close').addEventListener('click', close);
        terminal.addEventListener('click', function (event) { if (event.target === terminal) close(); });
        terminal.querySelector('form').addEventListener('submit', function (event) {
            event.preventDefault();
            run(input.value);
            input.value = '';
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && terminal.classList.contains('open')) close();
        });
        return open;
    }

    function initKeyboardEggs(openTerminal) {
        var typed = '';
        document.addEventListener('keydown', function (event) {
            var key = event.key.toLowerCase();
            var target = event.target;
            if (target && (target.matches('input, textarea, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey)) return;
            if (key.length === 1) typed = (typed + key).slice(-5);
            if (typed === 'pixel') {
                typed = '';
                openTerminal('[signal found] type "help" if you are lost.');
            }
        });
    }

    function initDoodles() {
        var goat = document.getElementById('goatDoodle');
        if (goat) {
            goat.classList.add('egg-ready');
            var goatClicks = 0;
            goat.addEventListener('click', function () {
                goatClicks++;
                if (goatClicks === 5) {
                    goat.classList.add('egg-certified');
                    var label = document.createElement('span');
                    label.className = 'egg-doodle-label';
                    label.textContent = '[certified goat]';
                    goat.appendChild(label);
                    unlock('goat', 'certified goat');
                }
            });
        }
    }

    function initSnowstorm() {
        var toggle = document.getElementById('snowToggle');
        if (!toggle) return;
        var timer;
        var held = false;
        function start() {
            held = false;
            timer = window.setTimeout(function () {
                held = true;
                window.dispatchEvent(new CustomEvent('easteregg:snowstorm'));
                unlock('snowstorm', 'weather warning');
                toast('[system] snowstorm rolling in...');
            }, 3000);
        }
        function cancel() { window.clearTimeout(timer); }
        toggle.addEventListener('pointerdown', start);
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (name) { toggle.addEventListener(name, cancel); });
        document.addEventListener('click', function (event) {
            if (held && (event.target === toggle || toggle.contains(event.target))) {
                event.preventDefault();
                event.stopPropagation();
                held = false;
            }
        }, true);
    }

    function initMusicSecret() {
        document.addEventListener('dblclick', function (event) {
            if (!event.target.closest('.music-thumb')) return;
            window.dispatchEvent(new CustomEvent('pixelis:rare-track'));
            unlock('secret-track', 'the B-side');
        });
    }

    function initRareNote() {
        if (!document.getElementById('goatDoodle') || Math.random() >= .02) return;
        var notes = ['you were not supposed to see this one.', 'rare note acquired. odds: terrible.', 'the website noticed you noticing it.'];
        var note = document.createElement('button');
        note.type = 'button';
        note.className = 'egg-rare-note';
        note.textContent = notes[Math.floor(Math.random() * notes.length)];
        note.addEventListener('click', function () { unlock('rare-note', 'two percent club'); note.remove(); });
        document.body.appendChild(note);
    }

    function initCursorHeart() {
        var cooldown = false;
        document.addEventListener('pointermove', function (event) {
            if (cooldown || Math.random() > .004) return;
            cooldown = true;
            spawnHeart(event.clientX, event.clientY);
            window.setTimeout(function () { cooldown = false; }, 7000);
        }, { passive: true });
    }

    function initHallSecret() {
        var cards = Array.prototype.slice.call(document.querySelectorAll('.lore-card'));
        if (!cards.length) return;
        var seen = loadJson('pixelisLoreSeen', {});

        function bubble(card, message) {
            var old = card.querySelector('.lore-bubble');
            if (old) old.remove();
            var item = document.createElement('div');
            item.className = 'lore-bubble';
            item.setAttribute('role', 'status');
            item.textContent = message;
            card.appendChild(item);
            requestAnimationFrame(function () { item.classList.add('show'); });
            window.setTimeout(function () { item.classList.remove('show'); window.setTimeout(function () { item.remove(); }, 250); }, 5200);
        }

        function scatter(card, symbols) {
            var rect = card.getBoundingClientRect();
            for (var i = 0; i < 9; i++) {
                var bit = document.createElement('span');
                bit.className = 'lore-particle';
                bit.textContent = symbols[i % symbols.length];
                bit.style.left = (rect.left + rect.width / 2) + 'px';
                bit.style.top = (rect.top + rect.height / 2) + 'px';
                bit.style.setProperty('--lore-x', ((Math.random() - .5) * 190) + 'px');
                bit.style.setProperty('--lore-y', (-40 - Math.random() * 130) + 'px');
                document.body.appendChild(bit);
                window.setTimeout(function (node) { node.remove(); }, 1700, bit);
            }
        }

        function mark(card) {
            var id = card.dataset.loreId;
            if (!seen[id]) {
                seen[id] = true;
                try { localStorage.setItem('pixelisLoreSeen', JSON.stringify(seen)); } catch (e) {}
            }
            unlock('hall-secret');
        }

        function reveal(card) {
            var id = card.dataset.loreId;
            if (id === 'biscuits-tea') {
                bubble(card, 'she loves biscuits and tea. do NOT take her biscuits if you value your life.');
                scatter(card, ['🍪', '☕']);
                mark(card);
            }
        }

        cards.forEach(function (card) {
            var clicks = 0;
            var busy = false;
            function activate() {
                if (busy) return;
                clicks++;
                if (card.dataset.loreId !== 'biscuits-tea' || clicks < 5) {
                    reveal(card);
                    return;
                }
                busy = true;
                clicks = 0;
                var oldBubble = card.querySelector('.lore-bubble');
                if (oldBubble) oldBubble.remove();
                var room = card.querySelector('.vault-room');
                var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                card.classList.add('vault-busy');
                card.setAttribute('aria-disabled', 'true');
                card.setAttribute('aria-expanded', 'true');
                room.setAttribute('aria-hidden', 'false');
                // Establish the closed door before starting its outward swing.
                void card.offsetWidth;
                card.classList.add('vault-open');
                mark(card);
                recordHiddenInteraction('biscuit-vault');
                window.setTimeout(function () {
                    card.classList.remove('vault-open');
                    card.setAttribute('aria-expanded', 'false');
                    window.setTimeout(function () {
                        card.classList.remove('vault-busy');
                        card.removeAttribute('aria-disabled');
                        room.setAttribute('aria-hidden', 'true');
                        busy = false;
                    }, reducedMotion ? 0 : 850);
                }, (reducedMotion ? 0 : 1100) + 2400);
            }
            card.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (!event.repeat) activate();
                }
            });
            card.addEventListener('click', activate);
        });
    }

    function initNosy() {
        var portraits = Array.prototype.slice.call(document.querySelectorAll('#hall-of-fame .friend-card'));
        var ids = portraits.map(function (card) { return card.getAttribute('data-portrait-id') || card.querySelector('img').getAttribute('src'); });
        portraits.forEach(function (card, index) {
            function inspect() {
                var seen = loadJson('pixelisPortraitsSeen', {});
                seen[ids[index]] = true;
                try { localStorage.setItem('pixelisPortraitsSeen', JSON.stringify(seen)); } catch (e) {}
                if (ids.every(function (id) { return seen[id]; })) unlock('nosy');
            }
            card.addEventListener('click', inspect);
            card.addEventListener('keydown', function (event) {
                if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
                    event.preventDefault();
                    inspect();
                }
            });
        });
    }

    function initPageAchievements() {
        document.querySelectorAll('[data-achievement-count]').forEach(function (node) {
            node.textContent = Object.keys(ACHIEVEMENTS).length;
        });
        if (document.body.dataset.page === '404') {
            unlock('lost');
            return;
        }
        var path = window.location.pathname.replace(/\/index\.html$/, '/');
        if (path !== '/' && !/\.[^/]+$/.test(path)) path = path.replace(/\/?$/, '/');
        if (MAIN_PAGES.indexOf(path) === -1) return;
        var visited = loadJson('pixelisMainPagesSeen', {});
        visited[path] = true;
        try { localStorage.setItem('pixelisMainPagesSeen', JSON.stringify(visited)); } catch (e) {}
        if (MAIN_PAGES.every(function (page) { return visited[page]; })) unlock('completionist');
    }

    function initActiveTime() {
        var lastInput = Date.now();
        var lastTick = lastInput;
        var idleAfter = 60000;
        var target = 30 * 60 * 1000;
        function tick() {
            var now = Date.now();
            // Ignore background tabs, inactivity, and long gaps caused by sleep or throttling.
            var elapsed = Math.max(0, Math.min(now, lastInput + idleAfter) - lastTick);
            if (!document.hidden && document.hasFocus() && now - lastTick <= 5000 && elapsed > 0) {
                var saved = Number(loadJson('pixelisActiveTimeMs', 0));
                var total = Math.min(target, (Number.isFinite(saved) ? Math.max(0, saved) : 0) + elapsed);
                try { localStorage.setItem('pixelisActiveTimeMs', JSON.stringify(total)); } catch (e) {}
                if (total >= target) unlock('touch-grass');
            }
            lastTick = now;
        }
        function activity() {
            if (Date.now() - lastInput < 1000) return;
            tick();
            if (!document.hidden && document.hasFocus()) lastInput = Date.now();
        }
        ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'].forEach(function (name) {
            document.addEventListener(name, activity, { passive: true });
        });
        window.addEventListener('focus', function () { lastInput = lastTick = Date.now(); });
        window.addEventListener('blur', tick);
        window.addEventListener('pagehide', tick);
        document.addEventListener('visibilitychange', function () { lastTick = Date.now(); });
        window.setInterval(tick, 1000);
    }

    function initAudiophile() {
        var previous = null;
        document.addEventListener('timeupdate', function (event) {
            var audio = event.target;
            if (audio.id !== 'siteAudio') return;
            var file = audio.currentSrc || audio.src;
            var position = audio.currentTime;
            if (audio.paused || audio.seeking || !file) { previous = null; return; }
            var delta = previous && previous.file === file ? position - previous.position : 0;
            previous = { file: file, position: position };
            // Credit real playback, not selections, pauses, or jumps through a track.
            if (delta <= 0 || delta > 2) return;
            var id = new URL(file, window.location.href).pathname.split('/').pop();
            var listened = loadJson('pixelisSongsPlayed', {});
            listened[id] = Math.min(5, (Number(listened[id]) || 0) + delta);
            try { localStorage.setItem('pixelisSongsPlayed', JSON.stringify(listened)); } catch (e) {}
            if (Object.keys(listened).filter(function (key) { return listened[key] >= 5; }).length >= 5) unlock('audiophile');
        }, true);
    }

    function initExplorer() {
        var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));
        if (sections.length < 3 || !('IntersectionObserver' in window)) return;
        var seen = {};
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) { if (entry.isIntersecting) seen[entry.target.id] = true; });
            if (sections.every(function (section) { return seen[section.id]; })) {
                unlock('explorer', 'scrolled the whole thing');
                observer.disconnect();
            }
        }, { threshold: .35 });
        sections.forEach(function (section) { observer.observe(section); });
    }

    function initArcadeVisits() {
        var match = window.location.pathname.match(/\/games\/([^/]+)/i);
        if (!match || match[1] === 'index.html') return;
        var visits = loadJson('pixelisGameVisits', {});
        visits[match[1]] = true;
        try { localStorage.setItem('pixelisGameVisits', JSON.stringify(visits)); } catch (e) {}
        if (Object.keys(visits).length >= 4) unlock('arcade-tourist', 'arcade regular');
    }

    function init() {
        if (window.__pixelisEggsLoaded) return;
        window.__pixelisEggsLoaded = true;
        var openTerminal = initTerminal();
        initKeyboardEggs(openTerminal);
        initDoodles();
        initSnowstorm();
        initMusicSecret();
        initRareNote();
        initCursorHeart();
        initHallSecret();
        initNosy();
        initPageAchievements();
        initActiveTime();
        initAudiophile();
        recordHiddenInteraction();
        initExplorer();
        initArcadeVisits();
        window.addEventListener('pixelis:achievement', function (event) {
            if (event.detail && event.detail.id) unlock(event.detail.id, event.detail.title);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
