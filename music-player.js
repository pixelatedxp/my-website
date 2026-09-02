(function () {
    'use strict';

    var scriptEl = document.currentScript;
    var autoplay = scriptEl && scriptEl.getAttribute('data-autoplay') === 'true';
    var segs = window.location.pathname.split('/').filter(Boolean);
    if (segs.length && /\.html?$/i.test(segs[segs.length - 1])) segs.pop();
    var prefix = '';
    for (var i = 0; i < segs.length; i++) prefix += '../';

    var tracks = [
        // Official single artwork: https://www.eminem.com/releases/without-me/
        { title: 'Eminem - Without Me', file: 'eminem-without-me.mp3', cover: 'eminem-without-me-cover.jpg', loop: true },
        // Release artwork: https://open.spotify.com/track/2VKJotTHpawDXLAKYt2UV2
        { title: '180db_ [130] (Super Slowed)', file: '180db-130-super-slowed.mp3', cover: '180db-cover.jpg', loop: true },
        { title: 's0rrow - unhappy', file: 's0rrow-unhappy.mp3' },
        { title: 'close my eyes', file: 'close my eyes.mp3' },
        { title: 'fake ur face', file: 'fake ur face.mp3' },
        { title: 'give me hints', file: 'give me hints.mp3' },
        { title: 'i can see your evil soul', file: 'i can see your evil soul.mp3' },
        { title: 'unhappy', file: 'unhappy.mp3' }
    ];
    var rareTrack = { title: '??? - i have no friends', file: 'i have no friends.mp3', rare: true };

    function init() {
        if (document.getElementById('siteAudio')) return;

        var css = document.createElement('style');
        css.textContent =
            '.music-player{position:fixed;bottom:20px;right:20px;display:grid;grid-template-columns:auto minmax(0,165px) auto;align-items:center;gap:10px;padding:10px 12px;background:var(--card-bg,rgba(30,30,35,.88));border:1px solid var(--card-border,rgba(255,255,255,.08));border-radius:16px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,.28);z-index:9000;opacity:0;transform:translateY(16px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1),background-color .4s,border-color .4s;pointer-events:none}' +
            '.music-player.visible{opacity:1;transform:translateY(0);pointer-events:auto}.music-player.rare{border-color:#ff5c9a;box-shadow:0 8px 36px rgba(255,92,154,.16)}' +
            '.music-thumb{width:46px;height:46px;border-radius:10px;object-fit:cover;user-select:none;-webkit-user-select:none}.music-info{min-width:0;font-family:\'Syne\',sans-serif}.music-label{display:block;color:var(--text-secondary,#98989d);font:.68rem \'Share Tech Mono\',monospace;text-transform:lowercase}.music-track-window{width:100%;overflow:hidden;white-space:nowrap}.music-track-inner{display:inline-block;font-size:.8rem;font-weight:700;color:var(--text-primary,#f5f5f7);will-change:transform}.music-track-inner.scrolling{animation:musicMarquee 6s ease-in-out 1s infinite alternate}@keyframes musicMarquee{to{transform:translateX(var(--scroll-distance,0px))}}' +
            '.music-visualizer{display:flex;align-items:flex-end;gap:2px;height:12px;margin-top:3px}.music-visualizer span{width:3px;height:2px;border-radius:2px;background:var(--accent-teal,#3ca7cb);opacity:.35;transition:height .09s linear,opacity .2s}.music-player.playing .music-visualizer span{opacity:.95}.music-player.rare .music-visualizer span{background:#ff5c9a}' +
            '.music-controls{display:flex;align-items:center;gap:1px}.music-btn{border:0;background:none;color:var(--text-secondary,#98989d);display:grid;place-items:center;padding:4px;transition:color .2s,transform .2s}.music-btn:hover{color:var(--accent-teal,#3ca7cb);transform:scale(1.1)}.music-btn svg{width:18px;height:18px}.music-toggle svg{width:22px;height:22px}' +
            '.music-volume{position:relative;display:flex;align-items:center}.music-volume-panel{position:absolute;right:-8px;bottom:34px;width:110px;padding:9px;border:1px solid var(--card-border,rgba(255,255,255,.08));border-radius:10px;background:var(--card-bg,#202024);box-shadow:0 8px 22px rgba(0,0,0,.3);opacity:0;transform:translateY(5px);pointer-events:none;transition:.2s}.music-volume:hover .music-volume-panel,.music-volume:focus-within .music-volume-panel{opacity:1;transform:none;pointer-events:auto}.music-volume-panel input{width:100%;accent-color:var(--accent-teal,#3ca7cb)}' +
            '@media(max-width:600px){.music-player{bottom:12px;right:12px;grid-template-columns:auto minmax(0,125px) auto;max-width:calc(100vw - 24px);gap:7px}.music-thumb{width:40px;height:40px}.music-btn{padding:3px}}@media(prefers-reduced-motion:reduce){.music-track-inner.scrolling{animation:none}}';
        document.head.appendChild(css);

        var player = document.createElement('div');
        player.className = 'music-player';
        player.id = 'musicPlayer';
        player.innerHTML =
            '<img alt="Album art" class="music-thumb" draggable="false">' +
            '<div class="music-info"><span class="music-label">[now playing]</span><div class="music-track-window"><span class="music-track music-track-inner"></span></div><div class="music-visualizer" aria-hidden="true">' +
                '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>' +
            '</div></div>' +
            '<div class="music-controls">' +
                '<button class="music-btn" id="musicPrev" aria-label="Previous track"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg></button>' +
                '<button class="music-btn music-toggle" id="musicToggle" aria-label="Play or pause music"><svg viewBox="0 0 24 24" fill="currentColor" id="musicPlayIcon"><path d="M8 5v14l11-7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor" id="musicPauseIcon" style="display:none"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg></button>' +
                '<button class="music-btn" id="musicNext" aria-label="Next track"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg></button>' +
                '<div class="music-volume"><button class="music-btn" id="musicVolumeButton" aria-label="Adjust volume"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4zm11.5 3a3.5 3.5 0 0 0-1.5-2.87v5.74A3.5 3.5 0 0 0 15.5 12zm0-6.18v2.06a5 5 0 0 1 0 8.24v2.06a7 7 0 0 0 0-12.36z"/></svg></button><div class="music-volume-panel"><input id="musicVolume" type="range" min="0" max="1" step="0.02" value="0.65" aria-label="Music volume"></div></div>' +
            '</div>';
        document.body.appendChild(player);

        var audio = document.createElement('audio');
        audio.id = 'siteAudio';
        audio.preload = 'metadata';
        document.body.appendChild(audio);

        var title = player.querySelector('.music-track');
        var thumbnail = player.querySelector('.music-thumb');
        var titleWindow = player.querySelector('.music-track-window');
        var playIcon = document.getElementById('musicPlayIcon');
        var pauseIcon = document.getElementById('musicPauseIcon');
        var volume = document.getElementById('musicVolume');
        var bars = Array.prototype.slice.call(player.querySelectorAll('.music-visualizer span'));
        var STORAGE_KEY = 'musicPlayerState';
        var currentIndex = 0;
        var currentRare = false;
        var userPaused = false;
        var shouldResume = false;
        var playToken = 0;
        var audioContext;
        var analyser;
        var frequencyData;
        var visualFrame;
        var lastSavedSecond = -1;
        var interactionEvents = ['pointerup', 'touchend', 'click', 'keydown'];

        function stopWaitingForInteraction() {
            interactionEvents.forEach(function (name) {
                document.removeEventListener(name, startOnInteraction, true);
            });
        }
        function startOnInteraction(event) {
            if (userPaused || event.repeat) return;
            // Let the play/pause button handle its own gesture exactly once.
            if (event.target.closest && event.target.closest('#musicToggle')) return;
            if (audio.paused || (audioContext && audioContext.state === 'suspended')) tryStart();
        }

        function loadState() {
            try { var raw = sessionStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
        }
        function saveState() {
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ defaultFile: tracks[0].file, index: currentIndex, file: tracks[currentIndex].file, rare: currentRare, time: audio.currentTime || 0, playing: shouldResume, paused: userPaused, volume: audio.volume }));
            } catch (e) {}
        }
        function activeTrack() { return currentRare ? rareTrack : tracks[currentIndex]; }
        function updateTitle() {
            var track = activeTrack();
            title.textContent = track.title;
            thumbnail.src = prefix + 'assets/music/' + (track.cover || 'thumb.jpg');
            thumbnail.alt = 'Cover art for ' + track.title;
            player.classList.toggle('rare', !!track.rare);
            player.querySelector('.music-label').textContent = track.rare ? '[rare transmission]' : '[now playing]';
            requestAnimationFrame(function () {
                var distance = Math.min(0, titleWindow.clientWidth - title.scrollWidth);
                title.style.setProperty('--scroll-distance', distance + 'px');
                title.classList.toggle('scrolling', distance < -4);
            });
        }
        function setTrack(index, rare, keepPlaying, resumeAt) {
            var wasPlaying = keepPlaying === undefined ? !audio.paused : keepPlaying;
            currentRare = !!rare;
            if (!currentRare) currentIndex = (index + tracks.length) % tracks.length;
            var track = activeTrack();
            var savedTime = Math.max(0, Number(resumeAt) || 0);
            audio.loop = !!track.loop;
            audio.addEventListener('loadedmetadata', function restoreTrackState() {
                if (savedTime > 0 && Number.isFinite(audio.duration)) {
                    audio.currentTime = Math.min(savedTime, Math.max(0, audio.duration - .5));
                }
                saveState();
                if (wasPlaying && !userPaused) tryStart();
            }, { once: true });
            audio.src = prefix + 'assets/music/' + encodeURIComponent(track.file).replace(/%2F/g, '/');
            audio.load();
            updateTitle();
        }
        function setPlayingUI(playing) {
            player.classList.toggle('playing', playing);
            playIcon.style.display = playing ? 'none' : '';
            pauseIcon.style.display = playing ? '' : 'none';
            if (playing) startVisualizer();
        }
        function ensureAnalyser() {
            if (analyser) return;
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            audioContext = new AudioCtx();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            frequencyData = new Uint8Array(analyser.frequencyBinCount);
            var source = audioContext.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
        }
        function startVisualizer() {
            ensureAnalyser();
            if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(function () {});
            if (visualFrame) return;
            function draw() {
                visualFrame = requestAnimationFrame(draw);
                if (!analyser || audio.paused) {
                    bars.forEach(function (bar) { bar.style.height = '2px'; });
                    if (audio.paused) { cancelAnimationFrame(visualFrame); visualFrame = null; }
                    return;
                }
                analyser.getByteFrequencyData(frequencyData);
                bars.forEach(function (bar, index) {
                    var value = frequencyData[Math.min(frequencyData.length - 1, index + 1)] || 0;
                    bar.style.height = (2 + Math.round(value / 24)) + 'px';
                });
            }
            draw();
        }
        function tryStart() {
            userPaused = false;
            shouldResume = true;
            var token = ++playToken;
            // Unlock both the audio element and its visualizer during the user gesture.
            ensureAnalyser();
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(function () {
                    if (!audio.paused && !userPaused) stopWaitingForInteraction();
                }).catch(function () {});
            }
            var promise = audio.play();
            if (promise && promise.then) promise.then(function () {
                if (userPaused) { audio.pause(); return; }
                if (token !== playToken) return;
                if (!audioContext || audioContext.state === 'running') stopWaitingForInteraction();
                saveState();
            }).catch(function () {
                // Browser autoplay blocking isn't a deliberate pause: retry on interaction.
                if (token === playToken) saveState();
            });
        }
        function stopPlayback() {
            userPaused = true;
            shouldResume = false;
            playToken++;
            stopWaitingForInteraction();
            audio.pause();
            saveState();
        }

        document.getElementById('musicToggle').addEventListener('click', function () { if (audio.paused) tryStart(); else stopPlayback(); });
        document.getElementById('musicPrev').addEventListener('click', function () { setTrack(currentRare ? currentIndex : currentIndex - 1, false); });
        document.getElementById('musicNext').addEventListener('click', function () { setTrack(currentRare ? currentIndex : currentIndex + 1, false); });
        volume.addEventListener('input', function () { audio.volume = Number(volume.value); saveState(); });
        audio.addEventListener('play', function () { setPlayingUI(true); saveState(); });
        audio.addEventListener('pause', function () { setPlayingUI(false); saveState(); });
        audio.addEventListener('timeupdate', function () {
            var second = Math.floor(audio.currentTime);
            if (!audio.paused && second !== lastSavedSecond) {
                lastSavedSecond = second;
                saveState();
            }
        });
        audio.addEventListener('ended', function () { if (!audio.loop) setTrack(currentIndex + 1, false, true); });
        window.addEventListener('pixelis:rare-track', function () { setTrack(currentIndex, !currentRare, !audio.paused); });
        window.addEventListener('pagehide', saveState);
        document.addEventListener('visibilitychange', function () { if (document.hidden) saveState(); });

        var saved = loadState();
        if (saved) {
            // Move sessions on the previous default to the new main song once.
            // Later selections (including 180db) still resume normally by filename.
            var previousDefault = saved.defaultFile || '180db-130-super-slowed.mp3';
            if (!saved.rare && previousDefault !== tracks[0].file && saved.file === previousDefault) {
                saved.file = tracks[0].file;
                saved.time = 0;
            }
            var savedIndex = tracks.findIndex(function (track) { return track.file === saved.file; });
            if (savedIndex >= 0) {
                currentIndex = savedIndex;
            } else if (!saved.file && (saved.rare || Number(saved.index) > 0)) {
                // Legacy saves used the old playlist's numeric index.
                currentIndex = Math.max(2, Math.min(tracks.length - 1, (Number(saved.index) || 0) + 2));
            } else {
                currentIndex = 0;
                saved.time = 0;
            }
            currentRare = !!saved.rare;
            audio.volume = typeof saved.volume === 'number' ? saved.volume : .65;
            volume.value = audio.volume;
        } else audio.volume = .65;
        userPaused = !!(saved && saved.paused);
        shouldResume = !!(saved && saved.playing && !saved.paused);
        setTrack(currentIndex, currentRare, !!(saved && saved.playing && !saved.paused), saved ? saved.time : 0);

        requestAnimationFrame(function () { requestAnimationFrame(function () { player.classList.add('visible'); }); });
        if (!userPaused) {
            interactionEvents.forEach(function (name) {
                document.addEventListener(name, startOnInteraction, { passive: true, capture: true });
            });
            if (!saved && autoplay) tryStart();
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
