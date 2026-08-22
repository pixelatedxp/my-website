(function () {
    var scriptEl = document.currentScript;
    var autoplay = scriptEl && scriptEl.getAttribute('data-autoplay') === 'true';
    var segs = window.location.pathname.split('/').filter(Boolean);
    if (segs.length && /\.html?$/i.test(segs[segs.length - 1])) segs.pop();
    var prefix = '';
    for (var i = 0; i < segs.length; i++) prefix += '../';

    function init() {
        if (document.getElementById('siteAudio')) return;

        var css = document.createElement('style');
        css.textContent =
            '.music-player{position:fixed;bottom:20px;right:20px;display:flex;align-items:center;gap:12px;padding:10px 12px;background-color:var(--card-bg, rgba(30,30,35,0.85));border:1px solid var(--card-border, rgba(255,255,255,0.06));border-radius:16px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,0.25);z-index:9000;opacity:0;transform:translateY(16px);transition:opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.4s ease, border-color 0.4s ease;pointer-events:none}' +
            '.music-player.visible{opacity:1;transform:translateY(0);pointer-events:auto}' +
            '.music-thumb{width:44px;height:44px;border-radius:10px;object-fit:cover;-webkit-user-select:none;user-select:none}' +
            '.music-info{display:flex;flex-direction:column;gap:2px;max-width:150px;font-family:\'Syne\',sans-serif}' +
            '.music-label{font-family:\'Share Tech Mono\',monospace;color:var(--text-secondary,#98989d);font-size:.75rem;text-transform:lowercase}' +
            '.music-track{font-size:.8rem;font-weight:700;color:var(--text-primary,#f5f5f7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
            '.music-eq{display:flex;align-items:flex-end;gap:2px;height:10px}' +
            '.music-eq span{width:3px;height:3px;border-radius:1px;background-color:var(--accent-teal,#3ca7cb);opacity:.4;transition:opacity .3s}' +
            '.music-player.playing .music-eq span{opacity:1;animation:eqBounce .9s ease-in-out infinite}' +
            '.music-player.playing .music-eq span:nth-child(2){animation-delay:.15s}' +
            '.music-player.playing .music-eq span:nth-child(3){animation-delay:.3s}' +
            '.music-player.playing .music-eq span:nth-child(4){animation-delay:.45s}' +
            '@keyframes eqBounce{0%,100%{height:3px}50%{height:10px}}' +
            '.music-toggle{background:none;border:none;display:flex;align-items:center;justify-content:center;padding:5px;color:var(--text-secondary,#98989d);transition:color .2s,transform .2s}' +
            '.music-toggle:hover{color:var(--accent-teal,#3ca7cb);transform:scale(1.1)}' +
            '.music-icon{width:22px;height:22px}' +
            '@media(max-width:600px){.music-player{bottom:14px;right:14px;max-width:calc(100vw - 28px)}}';
        document.head.appendChild(css);

        var player = document.createElement('div');
        player.className = 'music-player';
        player.id = 'musicPlayer';
        player.innerHTML =
            '<img src="' + prefix + 'assets/music/thumb.jpg" alt="Never Been With A Baddie" class="music-thumb" draggable="false">' +
            '<div class="music-info">' +
                '<span class="music-label">[now playing]</span>' +
                '<span class="music-track">Never Been With A Baddie</span>' +
                '<div class="music-eq"><span></span><span></span><span></span><span></span></div>' +
            '</div>' +
            '<button class="music-toggle" id="musicToggle" aria-label="Play or pause music">' +
                '<svg viewBox="0 0 24 24" fill="currentColor" class="music-icon" id="musicPlayIcon"><path d="M8 5v14l11-7z"/></svg>' +
                '<svg viewBox="0 0 24 24" fill="currentColor" class="music-icon" id="musicPauseIcon" style="display: none;"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' +
            '</button>';
        document.body.appendChild(player);

        var audio = document.createElement('audio');
        audio.id = 'siteAudio';
        audio.src = prefix + 'assets/music/never-been-with-a-baddie.mp3';
        audio.loop = true;
        audio.preload = 'auto';
        document.body.appendChild(audio);

        var playIcon = document.getElementById('musicPlayIcon');
        var pauseIcon = document.getElementById('musicPauseIcon');
        var toggleBtn = document.getElementById('musicToggle');
        var userPaused = false;

        function setPlayingUI(isPlaying) {
            player.classList.toggle('playing', isPlaying);
            if (playIcon) playIcon.style.display = isPlaying ? 'none' : '';
            if (pauseIcon) pauseIcon.style.display = isPlaying ? '' : 'none';
        }
        audio.addEventListener('play', function () { setPlayingUI(true); });
        audio.addEventListener('pause', function () { setPlayingUI(false); });

        function tryStart() {
            audio.play().catch(function () {});
        }

        toggleBtn.addEventListener('click', function () {
            if (audio.paused) {
                userPaused = false;
                tryStart();
            } else {
                userPaused = true;
                audio.pause();
            }
        });

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                player.classList.add('visible');
            });
        });

        if (autoplay) {
            var startOnInteraction = function (e) {
                if (player.contains(e.target)) return;
                interactionEvents.forEach(function (ev) { document.removeEventListener(ev, startOnInteraction); });
                if (!userPaused && audio.paused) tryStart();
            };
            var interactionEvents = ['pointerdown', 'keydown', 'touchstart'];
            tryStart();
            interactionEvents.forEach(function (ev) { document.addEventListener(ev, startOnInteraction, { passive: true }); });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
