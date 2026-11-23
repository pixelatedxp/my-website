// /now: live Discord status + game (Lanyard) and the current or last Spotify song.
(function () {
    'use strict';
    var P = window.PixelPresence; if (!P) return;
    var base = ((window.PIXEL_NOTES_CONFIG || {}).apiBase || '').replace(/\/$/, '');
    var USER = '1009828837141528696';
    var LABELS = { online: 'online', idle: 'idle', dnd: 'do not disturb', offline: 'offline', unavailable: 'status unavailable' };
    var $ = function (id) { return document.getElementById(id); };
    var noteIcon = $('nowSongArt').innerHTML, gameIcon = $('gameIcon').innerHTML;
    function setImage(target, url, fallback) {
        target.replaceChildren();
        if (!url) { target.innerHTML = fallback; return; }
        var img = document.createElement('img'); img.src = url; img.alt = ''; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', function () { target.innerHTML = fallback; });
        target.appendChild(img);
    }
    // Game icon straight from Discord's public app info, when Lanyard gives no image (Roblox, etc).
    var icons = {};
    function appIcon(id) {
        if (!icons[id]) icons[id] = fetch('https://discord.com/api/v10/applications/' + id + '/rpc', { credentials: 'omit', cache: 'force-cache' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (app) { return app && app.id === id && /^(?:a_)?[a-f0-9]{32}$/.test(app.icon) ? P.imageUrl('https://cdn.discordapp.com/app-icons/' + id + '/' + app.icon + '.png?size=128') : ''; })
            .catch(function () { return ''; });
        return icons[id];
    }
    async function refresh() {
        var results = await Promise.allSettled([
            fetch('https://api.lanyard.rest/v1/users/' + USER, { credentials: 'omit', cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }),
            base ? fetch(base + '/api/now-playing', { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.json(); }) : Promise.reject()
        ]);
        var lanyard = results[0].status === 'fulfilled' && results[0].value.success ? results[0].value.data : null;
        var view = P.summarize(lanyard);
        $('statusCard').dataset.status = view.status;
        $('statusText').textContent = LABELS[view.status];
        $('customStatus').textContent = view.custom ? '“' + view.custom + '”' : ''; $('customStatus').hidden = !view.custom;
        $('polaroidBubbleText').textContent = view.custom || ''; $('polaroidBubble').hidden = !view.custom;
        $('game').hidden = !view.game;
        if (view.game && !view.game.icon && view.game.applicationId) view.game.icon = await appIcon(view.game.applicationId);
        if (view.game) { $('gameName').textContent = view.game.name; $('gameDetail').textContent = view.game.detail || ''; setImage($('gameIcon'), view.game.icon, gameIcon); }
        var payload = results[1].status === 'fulfilled' ? results[1].value : null;
        var direct = P.directSong(payload, Date.now());
        var song = direct !== undefined ? direct : view.song;
        var last = !song && P.lastSong(payload);
        var shown = song || last;
        $('nowSongLabel').textContent = song ? (song.paused ? 'paused' : 'playing now') : last ? P.lastLabel(last, Date.now()) : 'nothing playing';
        $('nowSongTitle').textContent = shown ? shown.title : 'silence, for now';
        $('nowSongArtist').textContent = shown ? shown.artist : '';
        setImage($('nowSongArt'), shown && shown.art, noteIcon);
    }
    refresh();
    setInterval(function () { if (!document.hidden) refresh(); }, 30000);
})();
