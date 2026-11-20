/*
 * Live presence from Lanyard (https://github.com/Phineas/lanyard): Discord status,
 * custom status, Spotify, and the current game with its icon. No Discord token is
 * used. Pixel's local time is shown without naming a place.
 */
(function () {
    'use strict';
    var IMAGE_HOSTS = ['i.scdn.co', 'cdn.discordapp.com', 'media.discordapp.net', 'images-ext-1.discordapp.net', 'images-ext-2.discordapp.net'];
    var LABELS = { online: 'online', idle: 'idle', dnd: 'do not disturb', offline: 'offline', unavailable: 'status unavailable' };
    // Local artwork for games whose Discord app has no usable icon.
    var LOCAL_GAME_ART = { 'counter-strike 2': 'assets/games/counter-strike-2.png', 'cs2': 'assets/games/counter-strike-2.png' };

    function text(value) { return typeof value === 'string' ? value.trim().slice(0, 200) : ''; }

    function imageUrl(value) {
        if (typeof value !== 'string' || value.length > 2048) return '';
        try {
            var url = new URL(value);
            return url.protocol === 'https:' && !url.username && !url.password && IMAGE_HOSTS.indexOf(url.hostname) !== -1 ? url.href : '';
        } catch (error) { return ''; }
    }

    function activityImage(activity) {
        var asset = activity && activity.assets && (activity.assets.large_image || activity.assets.small_image);
        if (typeof asset !== 'string') return '';
        if (asset.indexOf('mp:') === 0) return imageUrl('https://media.discordapp.net/' + asset.slice(3));
        if (/^spotify:[a-zA-Z0-9]+$/.test(asset)) return imageUrl('https://i.scdn.co/image/' + asset.slice(8));
        if (/^\d+$/.test(asset) && /^\d+$/.test(activity.application_id || '')) {
            return imageUrl('https://cdn.discordapp.com/app-assets/' + activity.application_id + '/' + asset + '.png?size=128');
        }
        return imageUrl(asset);
    }

    function avatarUrl(user) {
        if (!user || !/^\d{17,20}$/.test(user.id || '') || !/^(?:a_)?[a-f0-9]{32}$/.test(user.avatar || '')) return '';
        return 'https://cdn.discordapp.com/avatars/' + user.id + '/' + user.avatar + '.png?size=512';
    }

    function clock(seconds) {
        seconds = Math.max(0, Math.floor(seconds));
        return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    }

    function duration(ms) {
        var minutes = Math.max(0, Math.floor(ms / 60000));
        if (minutes < 1) return 'just started';
        if (minutes < 60) return 'for ' + minutes + 'm';
        var hours = Math.floor(minutes / 60);
        return 'for ' + hours + 'h' + (minutes % 60 ? ' ' + (minutes % 60) + 'm' : '');
    }

    function partOfDay(hour) {
        return hour < 5 ? 'the middle of the night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    }

    // Reduce a Lanyard payload to exactly what the page shows.
    function summarize(data) {
        var status = data && Object.prototype.hasOwnProperty.call(LABELS, data.discord_status) ? data.discord_status : 'unavailable';
        var activities = data && Array.isArray(data.activities) ? data.activities : [];
        var live = status !== 'offline' && status !== 'unavailable';
        var custom = live ? activities.find(function (a) { return a && a.type === 4 && text(a.state); }) : null;
        var song = null, game = null;
        if (live && data.listening_to_spotify && data.spotify && text(data.spotify.song)) {
            var s = data.spotify;
            song = { title: text(s.song), artist: text(s.artist), art: imageUrl(s.album_art_url), start: s.timestamps && s.timestamps.start, end: s.timestamps && s.timestamps.end };
        }
        var playing = live ? activities.find(function (a) { return a && a.type === 0 && text(a.name); }) : null;
        if (playing) {
            game = {
                name: text(playing.name),
                detail: [text(playing.details), text(playing.state)].filter(Boolean).join(' · '),
                icon: activityImage(playing) || imageUrl(playing.discord_application_icon) || LOCAL_GAME_ART[text(playing.name).toLowerCase()] || '',
                start: playing.timestamps && playing.timestamps.start,
                applicationId: /^\d+$/.test(playing.application_id || '') ? playing.application_id : ''
            };
        }
        return { status: status, custom: custom ? text(custom.state) : '', song: song, game: game, avatar: avatarUrl(data && data.discord_user) };
    }

    window.PixelPresence = { summarize: summarize, activityImage: activityImage, imageUrl: imageUrl, clock: clock, duration: duration, partOfDay: partOfDay };

    var root = document.getElementById('presence');
    if (!root) return;
    var userId = root.dataset.discordId;
    var timeZone = root.dataset.timezone || 'UTC';
    var $ = function (id) { return document.getElementById(id); };
    var els = {
        avatar: $('avatar'), spotify: $('spotify'), art: $('spotifyArt'), label: $('spotifyLabelText'), title: $('spotifyTitle'), artist: $('spotifyArtist'),
        progress: $('spotifyProgress'), bar: $('spotifyBar'), elapsed: $('spotifyElapsed'), length: $('spotifyLength'),
        status: $('statusCard'), statusText: $('statusText'), custom: $('customStatus'), game: $('game'), gameIcon: $('gameIcon'), gameName: $('gameName'), gameDetail: $('gameDetail'),
        time: $('localTime')
    };
    var noteIcon = els.art ? els.art.innerHTML : '';
    var controllerIcon = els.gameIcon ? els.gameIcon.innerHTML : '';
    var current = summarize(null), lastView = '', timer, ticker, controller;
    var iconCache = {};

    function appIcon(id, signal) {
        if (!id) return Promise.resolve('');
        if (!iconCache[id]) {
            iconCache[id] = fetch('https://discord.com/api/v10/applications/' + id + '/rpc', { signal: signal, credentials: 'omit', cache: 'force-cache' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (app) { return app && app.id === id && /^(?:a_)?[a-f0-9]{32}$/.test(app.icon) ? imageUrl('https://cdn.discordapp.com/app-icons/' + id + '/' + app.icon + '.png?size=128') : ''; })
                .catch(function () { return ''; })
                .then(function (url) { if (!url) delete iconCache[id]; return url; });
        }
        return iconCache[id];
    }

    function setImage(holder, url, alt, fallbackHtml) {
        if (!holder) return;
        if (!url) { holder.innerHTML = fallbackHtml; return; }
        var img = document.createElement('img');
        img.alt = alt; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', function () { holder.innerHTML = fallbackHtml; });
        img.src = url;
        holder.replaceChildren(img);
    }

    function tick() {
        var now = Date.now();
        if (els.time) {
            var theirs = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timeZone }).format(now);
            els.time.textContent = "it's " + theirs + ' for Pixel, and ' + partOfDay(new Date(now).getHours()) + ' where you are';
        }
        var song = current.song;
        if (song && Number.isFinite(song.start) && Number.isFinite(song.end) && song.end > song.start) {
            var total = (song.end - song.start) / 1000;
            var done = Math.max(0, Math.min(total, (now - song.start) / 1000));
            els.bar.max = total; els.bar.value = done;
            els.bar.setAttribute('aria-valuetext', clock(done) + ' of ' + clock(total));
            els.elapsed.textContent = clock(done); els.length.textContent = clock(total);
        }
        if (current.game && Number.isFinite(current.game.start)) els.gameDetail.textContent = [current.game.detail, duration(now - current.game.start)].filter(Boolean).join(' · ');
    }

    function render(view) {
        current = view;
        var key = JSON.stringify(view);
        if (key !== lastView) {
            lastView = key;
            els.status.dataset.status = view.status;
            els.statusText.textContent = LABELS[view.status];
            els.custom.textContent = view.custom ? '“' + view.custom + '”' : '';
            els.custom.hidden = !view.custom;
            // Keep the sharper local copy while the Discord avatar is unchanged; switch only when it changes.
            var knownHash = root.dataset.avatarHash;
            if (view.avatar && els.avatar && els.avatar.dataset.live !== view.avatar && !(knownHash && view.avatar.indexOf('/' + knownHash + '.') !== -1)) {
                var probe = new Image();
                probe.onload = function () { els.avatar.src = view.avatar; els.avatar.dataset.live = view.avatar; };
                probe.referrerPolicy = 'no-referrer';
                probe.src = view.avatar;
            }
            if (view.song) {
                els.spotify.dataset.state = 'playing';
                els.label.textContent = 'listening on spotify';
                els.title.textContent = view.song.title;
                els.artist.textContent = view.song.artist;
                setImage(els.art, view.song.art, 'Album art for ' + view.song.title, noteIcon);
                els.progress.hidden = !(Number.isFinite(view.song.start) && Number.isFinite(view.song.end));
            } else {
                els.spotify.dataset.state = 'idle';
                els.label.textContent = view.status === 'unavailable' ? 'spotify unavailable' : 'not listening right now';
                els.title.textContent = 'silence, for now';
                els.artist.textContent = 'check back later';
                els.art.innerHTML = noteIcon;
                els.progress.hidden = true;
            }
            els.game.hidden = !view.game;
            if (view.game) {
                els.gameName.textContent = view.game.name;
                setImage(els.gameIcon, view.game.icon, view.game.name + ' icon', controllerIcon);
            }
        }
        tick();
    }

    async function refresh() {
        if (document.hidden || controller) return;
        clearTimeout(timer);
        controller = new AbortController();
        var timeout = setTimeout(function () { controller.abort(); }, 8000);
        try {
            var response = await fetch('https://api.lanyard.rest/v1/users/' + userId, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
            if (!response.ok) throw new Error('unavailable');
            var payload = await response.json();
            var view = summarize(payload && payload.success === true ? payload.data : null);
            if (view.game && !view.game.icon && view.game.applicationId) view.game.icon = await appIcon(view.game.applicationId, controller.signal);
            render(view);
        } catch (error) {
            render(summarize(null));
        } finally {
            clearTimeout(timeout);
            controller = null;
            if (!document.hidden) timer = setTimeout(refresh, 30000);
        }
    }

    if (/^\d{17,20}$/.test(userId || '')) {
        document.addEventListener('visibilitychange', function () { clearTimeout(timer); if (!document.hidden) refresh(); });
        refresh();
    } else render(current);
    ticker = setInterval(function () { if (!document.hidden) tick(); }, 1000);
    window.addEventListener('pagehide', function () { clearTimeout(timer); clearInterval(ticker); if (controller) controller.abort(); });
})();
