(function () {
    'use strict';

    var ACHIEVEMENT_KEY = 'pixelisAchievements';
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
            var names = Object.keys(unlocked).map(function (key) { return unlocked[key].title; });
            return names.length ? names.join('\n- ') : 'none yet. suspicious.';
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
            if (cmd === 'clear') { output.textContent = ''; return; }
            if (cmd === 'exit') { close(); return; }
            if (cmd === 'achievements') { print('- ' + achievementsText()); unlock('auditor', 'checked the receipts'); return; }
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
        var konami = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
        var konamiIndex = 0;
        document.addEventListener('keydown', function (event) {
            var key = event.key.toLowerCase();
            if (key === konami[konamiIndex]) {
                konamiIndex++;
                if (konamiIndex === konami.length) {
                    konamiIndex = 0;
                    document.body.classList.add('egg-overdrive');
                    unlock('overdrive', 'glitch overdrive');
                    window.setTimeout(function () { document.body.classList.remove('egg-overdrive'); }, 18000);
                }
            } else {
                konamiIndex = key === konami[0] ? 1 : 0;
            }
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
        var simp = document.getElementById('simpDoodle');
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
        if (simp) {
            simp.classList.add('egg-ready');
            var simpClicks = 0;
            simp.addEventListener('click', function (event) {
                simpClicks++;
                spawnHeart(event.clientX, event.clientY);
                if (simpClicks === 5) unlock('simp', 'professional simp');
            });
        }
    }

    function initThemeEgg() {
        if (localStorage.getItem('pixelisPurpleTheme') === 'true') document.body.classList.add('egg-purple');
        var toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        var clicks = [];
        toggle.addEventListener('click', function () {
            var now = Date.now();
            clicks.push(now);
            clicks = clicks.filter(function (time) { return now - time < 3200; });
            if (clicks.length >= 7) {
                clicks = [];
                document.body.classList.toggle('egg-purple');
                localStorage.setItem('pixelisPurpleTheme', document.body.classList.contains('egg-purple'));
                unlock('purple', 'forbidden purple theme');
            }
        });
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
                toast('[system] snowstorm active for 15 seconds');
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

    function initLogo() {
        var brand = document.querySelector('.brand');
        if (!brand || !document.getElementById('goatDoodle')) return;
        var original = brand.textContent;
        var names = ['pixelis.dev', 'probably-not-a-virus.exe', 'homework-later.dev', 'still pixel.'];
        var count = 0;
        var resetTimer;
        brand.addEventListener('click', function (event) {
            event.preventDefault();
            window.clearTimeout(resetTimer);
            count++;
            brand.textContent = names[count % names.length];
            brand.classList.add('egg-logo-glitch');
            if (count >= 5) { unlock('logo', 'identity carousel'); count = 0; }
            resetTimer = window.setTimeout(function () {
                brand.textContent = original;
                brand.classList.remove('egg-logo-glitch');
                count = 0;
            }, 1800);
        });
    }

    function initMusicSecret() {
        document.addEventListener('dblclick', function (event) {
            if (!event.target.closest('.music-thumb')) return;
            var audio = document.getElementById('siteAudio');
            var label = document.querySelector('.music-track');
            if (!audio) return;
            var wasPlaying = !audio.paused;
            if (!audio.dataset.originalSrc) {
                audio.dataset.originalSrc = audio.src;
                audio.dataset.originalLabel = label ? label.textContent : '';
            }
            var secretOn = audio.dataset.secretOn !== 'true';
            audio.dataset.secretOn = String(secretOn);
            audio.src = secretOn ? new URL('never-been-with-a-baddie.mp3', audio.src).href : audio.dataset.originalSrc;
            if (label) label.textContent = secretOn ? 'secret track - never been with a baddie' : audio.dataset.originalLabel;
            if (wasPlaying) audio.play().catch(function () {});
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
        var images = document.querySelectorAll('.hall-of-fame-grid img');
        if (!images.length) return;
        var target = images[Math.min(3, images.length - 1)];
        var clicks = 0;
        target.style.cursor = 'help';
        target.addEventListener('click', function () {
            clicks++;
            if (clicks !== 3) return;
            var rect = target.getBoundingClientRect();
            var bubble = document.createElement('div');
            bubble.className = 'egg-speech';
            bubble.textContent = 'bro why did you click me three times 😭';
            bubble.style.left = Math.min(rect.right, window.innerWidth - 230) + 'px';
            bubble.style.top = Math.max(12, rect.top - 20) + 'px';
            document.body.appendChild(bubble);
            window.setTimeout(function () { bubble.remove(); }, 4200);
            unlock('hall-secret', 'the portrait speaks');
        });
    }

    function initRedactedLog() {
        if (!/changelog/i.test(window.location.pathname)) return;
        var first = document.querySelector('.changelog-entry');
        if (!first || !first.parentNode) return;
        var entry = document.createElement('div');
        entry.className = 'changelog-entry fade-up egg-redacted';
        entry.innerHTML = '<div class="changelog-dot"></div><div class="changelog-date">[REDACTED] UTC</div>' +
            '<div class="changelog-title">Classified Maintenance</div><ul class="changelog-list">' +
            '<li class="egg-censored">██████████████████████████████</li>' +
            '<li class="egg-secret-copy">Added things that definitely do not exist. You saw nothing.</li></ul>';
        first.parentNode.insertBefore(entry, first);
        entry.addEventListener('click', function () {
            entry.classList.add('revealed');
            unlock('redacted', 'security clearance: questionable');
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
        if (localStorage.getItem('pixelisPurpleTheme') === 'true') document.body.classList.add('egg-purple');
        var openTerminal = initTerminal();
        initKeyboardEggs(openTerminal);
        initDoodles();
        initThemeEgg();
        initSnowstorm();
        initLogo();
        initMusicSecret();
        initRareNote();
        initCursorHeart();
        initHallSecret();
        initRedactedLog();
        initExplorer();
        initArcadeVisits();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
