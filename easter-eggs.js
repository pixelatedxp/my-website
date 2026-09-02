(function () {
    'use strict';

    var ACHIEVEMENT_KEY = 'pixelisAchievements';
    var ACHIEVEMENTS = {
        terminal: 'there is no terminal', auditor: 'checked the receipts', whoami: 'identity crisis resolved',
        sudo: 'not in the sudoers file', secrets: 'asked the obvious question', goat: 'certified goat',
        snowstorm: 'weather warning', 'secret-track': 'the B-side',
        'rare-note': 'two percent club', 'hall-secret': 'the portrait speaks', explorer: 'scrolled the whole thing',
        'arcade-tourist': 'arcade regular', fivehours: 'five minutes later', biscuits: 'hands off the biscuits',
        blackmail: 'nothing to blackmail', lockin: 'locked all the way in',
        'beat-pixel': 'faster than Pixel'
    };
    var unlocked = loadJson(ACHIEVEMENT_KEY, {});
    var toastStack;

    function loadJson(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
    }
    function saveAchievements() {
        try { localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(unlocked)); } catch (e) {}
    }
    function toast(message) {
        if (!toastStack) {
            toastStack = document.createElement('div');
            toastStack.className = 'egg-toast-stack';
            document.body.appendChild(toastStack);
        }
        var item = document.createElement('div');
        item.className = 'egg-toast';
        item.textContent = message;
        toastStack.appendChild(item);
        window.setTimeout(function () { item.remove(); }, 4200);
    }
    function unlock(id, title) {
        if (unlocked[id]) return false;
        title = title || ACHIEVEMENTS[id] || id;
        unlocked[id] = { title: title, unlockedAt: new Date().toISOString() };
        saveAchievements();
        toast('[achievement unlocked] ' + title);
        return true;
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
                return '[x] ' + ACHIEVEMENTS[key];
            });
            var remaining = Object.keys(ACHIEVEMENTS).filter(function (key) { return !unlocked[key]; }).length;
            return (names.length ? names.join('\n') : '[ ] none yet. suspicious.') +
                '\n\n[ ' + remaining + ' hidden achievement' + (remaining === 1 ? '' : 's') + ' remaining ]';
        }
        function run(command) {
            var cmd = command.trim().toLowerCase();
            print('> ' + command);
            var replies = {
                help: 'commands: help, whoami, sudo, secrets, achievements, clear, exit',
                whoami: 'pixel. allegedly a developer. definitely avoiding homework.',
                sudo: 'permission denied. nice try though.',
                secrets: 'the good secrets are not listed in the help menu.',
                pixel: 'you found me twice. that feels intentional.'
            };
            var secretCommands = {
                fivehours: ['context: the first guy always says, "bro I\'m hopping on CS2 in five minutes," then finally appears about five hours later asking if everyone is still on.', 'fivehours'],
                biscuits: ['context: she loves biscuits and tea. taking one of her biscuits is treated like a serious personal betrayal, so keep your hands off them.', 'biscuits'],
                blackmail: ['context: the GOAT will blackmail you with absolutely anything you send him, so give him no material whatsoever. he is still the GOAT though.', 'blackmail'],
                lockin: ['context: this guy went through a dark-psychology phase, a religious phase, and finally a delete-Discord, block-everyone, fully-locked-in phase.', 'lockin']
            };
            if (cmd === 'clear') { output.textContent = ''; return; }
            if (cmd === 'exit') { close(); return; }
            if (cmd === 'achievements') { unlock('auditor', 'checked the receipts'); print(achievementsText()); return; }
            if (secretCommands[cmd]) {
                print(secretCommands[cmd][0]);
                unlock(secretCommands[cmd][1]);
                return;
            }
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

        function bubble(card, message, duration, inside) {
            var old = card.querySelector('.lore-bubble');
            if (old) old.remove();
            var item = document.createElement('div');
            item.className = 'lore-bubble';
            if (inside) item.classList.add('lore-bubble-inside');
            item.textContent = message;
            card.appendChild(item);
            requestAnimationFrame(function () { item.classList.add('show'); });
            if (duration !== 0) {
                window.setTimeout(function () { item.classList.remove('show'); window.setTimeout(function () { item.remove(); }, 250); }, duration || 5200);
            }
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
                unlock('hall-secret');
            }
        }

        function reveal(card) {
            var id = card.dataset.loreId;
            if (id === 'biscuits-tea') {
                bubble(card, 'she loves biscuits and tea. do NOT take her biscuits if you value your life.');
                scatter(card, ['🍪', '☕']);
                mark(card);
            } else if (id === 'pookie') {
                bubble(card, 'poookie </3', 0, true);
                mark(card);
            }
        }

        cards.forEach(function (card) {
            var id = card.dataset.loreId;
            card.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); reveal(card); } });
            if (id === 'biscuits-tea') {
                card.addEventListener('dblclick', function () { reveal(card); });
            } else {
                card.addEventListener('click', function () { reveal(card); });
            }
        });
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
        initExplorer();
        initArcadeVisits();
        window.addEventListener('pixelis:achievement', function (event) {
            if (event.detail && event.detail.id) unlock(event.detail.id, event.detail.title);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
