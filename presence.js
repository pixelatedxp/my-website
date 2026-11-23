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

    function spotifyUrl(value) {
        return typeof value === 'string' && /^https:\/\/open\.spotify\.com\/(track|episode)\/[A-Za-z0-9]+(\?[A-Za-z0-9=&_-]*)?$/.test(value) ? value : '';
    }

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
            song = { title: text(s.song), artist: text(s.artist), art: imageUrl(s.album_art_url), url: /^[A-Za-z0-9]{10,40}$/.test(s.track_id || '') ? 'https://open.spotify.com/track/' + s.track_id : '', start: s.timestamps && s.timestamps.start, end: s.timestamps && s.timestamps.end };
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

    // Song straight from Spotify (via the notes Worker). Returns undefined when that source can't be used,
    // so the card falls back to Discord; null when Spotify says nothing is playing.
    function directSong(payload, receivedAt) {
        if (!payload || payload.configured !== true || payload.error) return undefined;
        if (!text(payload.title) || (payload.playing !== true && payload.paused !== true)) return null;
        var length = Math.max(0, Number(payload.durationMs) || 0);
        var song = { title: text(payload.title), artist: text(payload.artist), art: imageUrl(payload.albumArt), url: spotifyUrl(payload.url) };
        if (payload.playing !== true) {
            // Paused: keep the song on the card with the bar frozen where it stopped.
            song.paused = true; song.progress = Math.min(Math.max(0, Number(payload.progressMs) || 0), length || Infinity); song.length = length;
            return song;
        }
        var progress = Math.max(0, Number(payload.progressMs) || 0) + Math.max(0, Number(payload.ageMs) || 0);
        song.start = receivedAt - progress;
        song.end = length ? song.start + length : undefined;
        return song;
    }

    // Last song played, shown on the idle card. null when Spotify gave none.
    function lastSong(payload) {
        var last = payload && payload.configured === true && payload.last;
        if (!last || !text(last.title)) return null;
        var playedAt = Date.parse(last.playedAt);
        return { title: text(last.title), artist: text(last.artist), art: imageUrl(last.albumArt), url: spotifyUrl(last.url), playedAt: Number.isFinite(playedAt) ? playedAt : null };
    }
    function ago(time, now) {
        if (!Number.isFinite(time)) return '';
        var minutes = Math.max(0, Math.floor((now - time) / 60000));
        if (minutes < 1) return 'just now';
        if (minutes < 60) return minutes + 'm ago';
        var hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + 'h ago';
        var days = Math.floor(hours / 24);
        return days === 1 ? 'yesterday' : days + 'd ago';
    }
    function lastLabel(last, now) { var when = ago(last.playedAt, now); return 'last played' + (when ? ' · ' + when : ''); }

    window.PixelPresence = { lastSong: lastSong, ago: ago, lastLabel: lastLabel, spotifyUrl: spotifyUrl, directSong: directSong, summarize: summarize, activityImage: activityImage, imageUrl: imageUrl, clock: clock, duration: duration, partOfDay: partOfDay };

    var root = document.getElementById('presence');
    if (!root) return;
    var userId = root.dataset.discordId;
    var apiBase = ((window.PIXEL_NOTES_CONFIG || {}).apiBase || '').replace(/\/$/, '');
    var timeZone = root.dataset.timezone || 'UTC';
    var $ = function (id) { return document.getElementById(id); };
    var els = {
        avatar: $('avatar'), spotify: $('spotify'), link: $('spotifyLink'), art: $('spotifyArt'), label: $('spotifyLabelText'), title: $('spotifyTitle'), artist: $('spotifyArtist'),
        progress: $('spotifyProgress'), bar: $('spotifyBar'), elapsed: $('spotifyElapsed'), length: $('spotifyLength'),
        status: $('statusCard'), statusText: $('statusText'), custom: $('customStatus'), game: $('game'), gameIcon: $('gameIcon'), gameName: $('gameName'), gameDetail: $('gameDetail'),
        time: $('localTime')
    };
    var noteIcon = els.art ? els.art.innerHTML : '';
    var controllerIcon = els.gameIcon ? els.gameIcon.innerHTML : '';
    var current = summarize(null), lastView = '', timer, ticker, controller, endedRefresh;
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
        if (current.last && !current.song) els.label.textContent = lastLabel(current.last, now);
        if (els.time) {
            var theirs = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timeZone }).format(now);
            els.time.textContent = "it's " + theirs + ' for Pixel, and ' + partOfDay(new Date(now).getHours()) + ' where you are';
        }
        var song = current.song;
        if (song && song.paused && song.length) {
            els.bar.max = song.length / 1000; els.bar.value = song.progress / 1000;
            els.bar.setAttribute('aria-valuetext', 'paused at ' + clock(song.progress / 1000) + ' of ' + clock(song.length / 1000));
            els.elapsed.textContent = clock(song.progress / 1000); els.length.textContent = clock(song.length / 1000);
        } else if (song && Number.isFinite(song.start) && Number.isFinite(song.end) && song.end > song.start) {
            var total = (song.end - song.start) / 1000;
            var done = Math.max(0, Math.min(total, (now - song.start) / 1000));
            els.bar.max = total; els.bar.value = done;
            els.bar.setAttribute('aria-valuetext', clock(done) + ' of ' + clock(total));
            els.elapsed.textContent = clock(done); els.length.textContent = clock(total);
        }
        if (song && Number.isFinite(song.end) && now > song.end + 1500 && song.end !== endedRefresh) { endedRefresh = song.end; refresh(); }
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
            var bubble = document.getElementById('statusBubble');
            if (bubble) { document.getElementById('statusBubbleText').textContent = view.custom || ''; bubble.hidden = !view.custom; }
            // Keep the sharper local copy while the Discord avatar is unchanged; switch only when it changes.
            var knownHash = root.dataset.avatarHash;
            if (view.avatar && els.avatar && els.avatar.dataset.live !== view.avatar && !(knownHash && view.avatar.indexOf('/' + knownHash + '.') !== -1)) {
                var probe = new Image();
                probe.onload = function () { els.avatar.src = view.avatar; els.avatar.dataset.live = view.avatar; };
                probe.referrerPolicy = 'no-referrer';
                probe.src = view.avatar;
            }
            if (view.song) {
                els.spotify.dataset.state = view.song.paused ? 'paused' : 'playing';
                els.label.textContent = view.song.paused ? 'paused on spotify' : 'listening on spotify';
                els.title.textContent = view.song.title;
                els.artist.textContent = view.song.artist;
                setImage(els.art, view.song.art, 'Album art for ' + view.song.title, noteIcon);
                els.progress.hidden = view.song.paused ? !view.song.length : !(Number.isFinite(view.song.start) && Number.isFinite(view.song.end));
            } else if (view.last) {
                els.spotify.dataset.state = 'last';
                els.label.textContent = lastLabel(view.last, Date.now());
                els.title.textContent = view.last.title;
                els.artist.textContent = view.last.artist;
                setImage(els.art, view.last.art, 'Album art for ' + view.last.title, noteIcon);
                els.progress.hidden = true;
            } else {
                els.spotify.dataset.state = 'idle';
                els.label.textContent = view.status === 'unavailable' ? 'spotify unavailable' : 'not listening right now';
                els.title.textContent = 'silence, for now';
                els.artist.textContent = 'check back later';
                els.art.innerHTML = noteIcon;
                els.progress.hidden = true;
            }
            if (els.link) {
                var shown = view.song || view.last;
                var url = shown && shown.url;
                els.link.hidden = !url;
                if (url) {
                    els.link.href = url;
                    els.link.setAttribute('aria-label', 'Open ' + shown.title + (shown.artist ? ' by ' + shown.artist : '') + ' on Spotify');
                } else els.link.removeAttribute('href');
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
            var nowPlayingUrl = apiBase ? apiBase + '/api/now-playing' : '';
            var results = await Promise.allSettled([
                fetch('https://api.lanyard.rest/v1/users/' + userId, { signal: controller.signal, credentials: 'omit', cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('unavailable'); return r.json(); }),
                nowPlayingUrl ? fetch(nowPlayingUrl, { signal: controller.signal, credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.json(); }) : Promise.reject(new Error('not set up'))
            ]);
            var receivedAt = Date.now();
            var payload = results[0].status === 'fulfilled' ? results[0].value : null;
            var view = summarize(payload && payload.success === true ? payload.data : null);
            // Spotify itself wins when it answers, so the song shows even with Discord closed.
            var direct = results[1].status === 'fulfilled' ? directSong(results[1].value, receivedAt) : undefined;
            if (direct !== undefined) view.song = direct;
            if (!view.song && results[1].status === 'fulfilled') view.last = lastSong(results[1].value);
            // Keep the same start time across refreshes so the card doesn't redraw for clock jitter.
            if (view.song && !view.song.paused && current.song && !current.song.paused && view.song.title === current.song.title && Math.abs((view.song.start || 0) - (current.song.start || 0)) < 4000) {
                view.song.start = current.song.start; view.song.end = current.song.end;
            }
            if (results[0].status === 'rejected' && direct === undefined) throw new Error('unavailable');
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
