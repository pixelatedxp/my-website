(function () {
    'use strict';
    var card = document.getElementById('currentlyCard');
    if (!card) return;
    var userId = card.dataset.discordId;
    if (!/^\d{17,20}$/.test(userId)) return;
    var statusText = document.getElementById('currentlyStatus');
    var content = document.getElementById('currentlyActivity');
    var customStatus = document.getElementById('currentlyCustomStatus');
    var labels = { online: 'online', idle: 'idle', dnd: 'do not disturb', offline: 'offline', unavailable: 'unavailable' };
    var timer;
    var controller;
    var lastView;
    var playback = [];
    var progressTimer;
    var icons = {
        listening: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></svg>',
        playing: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8c3 0 4 3 5 8s-2 6-5 1H8c-3 5-6 4-5-1s2-8 5-8Z"/><path d="M7 10v4m-2-2h4m6-1h.01m3 2h.01"/></svg>'
    };
    function text(value) { return typeof value === 'string' ? value.trim().slice(0, 200) : ''; }
    function imageUrl(value) {
        if (typeof value !== 'string' || value.length > 2048) return '';
        try {
            var url = new URL(value);
            var hosts = ['i.scdn.co', 'cdn.discordapp.com', 'media.discordapp.net', 'images-ext-1.discordapp.net', 'images-ext-2.discordapp.net'];
            return url.protocol === 'https:' && !url.username && !url.password && hosts.indexOf(url.hostname) !== -1 ? url.href : '';
        } catch (error) { return ''; }
    }
    function activityImage(activity) {
        var asset = activity.assets && (activity.assets.large_image || activity.assets.small_image);
        if (typeof asset !== 'string') return '';
        if (asset.indexOf('mp:') === 0) return imageUrl('https://media.discordapp.net/' + asset.slice(3));
        if (/^spotify:[a-zA-Z0-9]+$/.test(asset)) return imageUrl('https://i.scdn.co/image/' + asset.slice(8));
        if (/^\d+$/.test(asset) && /^\d+$/.test(activity.application_id)) {
            return imageUrl('https://cdn.discordapp.com/app-assets/' + activity.application_id + '/' + asset + '.png?size=128');
        }
        return imageUrl(asset);
    }
    function clockLabel(seconds) {
        seconds = Math.max(0, Math.floor(seconds));
        return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    }
    function updateProgress() {
        window.clearTimeout(progressTimer);
        if (document.hidden) return;
        playback.forEach(function (song) {
            var duration = (song.end - song.start) / 1000;
            var elapsed = Math.max(0, Math.min(duration, (Date.now() - song.start) / 1000));
            song.item.dataset.playing = String(Date.now() >= song.start && elapsed < duration);
            song.bar.value = elapsed;
            song.bar.setAttribute('aria-valuetext', clockLabel(elapsed) + ' of ' + clockLabel(duration));
            song.elapsed.textContent = clockLabel(elapsed);
        });
        if (playback.length) progressTimer = window.setTimeout(updateProgress, 1000);
    }
    function row(kind, title, detail, cover, timestamps) {
        var item = document.createElement('div');
        item.className = 'currently-row';
        var icon = document.createElement('span');
        icon.className = 'currently-icon';
        icon.innerHTML = icons[kind];
        if (cover) {
            var image = document.createElement('img');
            image.alt = title + (kind === 'listening' ? ' album art' : ' artwork');
            image.decoding = 'async';
            image.referrerPolicy = 'no-referrer';
            image.addEventListener('error', function () { icon.innerHTML = icons[kind]; });
            image.src = cover;
            icon.replaceChildren(image);
        }
        var copy = document.createElement('div');
        copy.className = 'currently-copy';
        [['currently-label', kind === 'listening' ? 'listening to' : 'playing'], ['currently-title', title], ['currently-detail', detail]].forEach(function (part) {
            if (!part[1]) return;
            var line = document.createElement('p');
            line.className = part[0];
            line.textContent = part[1];
            if (part[0] === 'currently-label' && kind === 'listening') {
                var bars = document.createElement('span');
                bars.className = 'currently-bars';
                bars.setAttribute('aria-hidden', 'true');
                for (var i = 0; i < 8; i++) {
                    var bar = document.createElement('span');
                    bar.style.setProperty('--bar-delay', (-i * .13) + 's');
                    bar.style.setProperty('--bar-duration', (.5 + (i % 3) * .17) + 's');
                    bars.appendChild(bar);
                }
                line.appendChild(bars);
            }
            copy.appendChild(line);
        });
        if (kind === 'listening') {
            item.dataset.playing = 'true';
            if (timestamps && Number.isFinite(timestamps.start) && Number.isFinite(timestamps.end) && timestamps.end > timestamps.start) {
                var progress = document.createElement('div');
                progress.className = 'currently-progress';
                progress.setAttribute('aria-live', 'off');
                var bar = document.createElement('progress');
                bar.max = (timestamps.end - timestamps.start) / 1000;
                bar.value = 0;
                bar.setAttribute('aria-label', 'Song progress');
                var times = document.createElement('div');
                times.className = 'currently-times';
                times.setAttribute('aria-hidden', 'true');
                var elapsed = document.createElement('span');
                var duration = document.createElement('span');
                duration.textContent = clockLabel(bar.max);
                times.appendChild(elapsed);
                times.appendChild(duration);
                progress.appendChild(bar);
                progress.appendChild(times);
                copy.appendChild(progress);
                playback.push({ item: item, start: timestamps.start, end: timestamps.end, bar: bar, elapsed: elapsed });
            }
        }
        item.appendChild(icon);
        item.appendChild(copy);
        return item;
    }
    function render(data) {
        var status = data && Object.prototype.hasOwnProperty.call(labels, data.discord_status) ? data.discord_status : 'unavailable';
        var rows = [];
        var activities = data && Array.isArray(data.activities) ? data.activities : [];
        var custom = status !== 'unavailable' && activities.find(function (activity) { return activity && activity.type === 4; });
        var customText = custom ? text(custom.state) : '';
        if (status !== 'offline' && status !== 'unavailable') {
            var spotify = data.listening_to_spotify && data.spotify;
            var listening = activities.find(function (activity) { return activity && activity.type === 2 && text(activity.name); });
            var game = activities.find(function (activity) { return activity && activity.type === 0 && text(activity.name); });
            if (spotify && text(spotify.song)) rows.push(['listening', text(spotify.song), text(spotify.artist), imageUrl(spotify.album_art_url), spotify.timestamps]);
            else if (listening) rows.push(['listening', text(listening.details) || text(listening.name), text(listening.state), activityImage(listening), listening.timestamps]);
            if (game) rows.push(['playing', text(game.name), [text(game.details), text(game.state)].filter(Boolean).join(' · '), activityImage(game)]);
        }
        var view = JSON.stringify([status, customText, rows]);
        if (view === lastView) return;
        lastView = view;
        card.dataset.status = status;
        statusText.textContent = 'status: ' + labels[status];
        customStatus.textContent = customText ? 'custom status: ' + customText : '';
        customStatus.hidden = !customText;
        playback = [];
        window.clearTimeout(progressTimer);
        content.replaceChildren();
        rows.forEach(function (entry) { content.appendChild(row.apply(null, entry)); });
        updateProgress();
        if (!rows.length) {
            var empty = document.createElement('p');
            empty.className = 'currently-empty';
            empty.textContent = status === 'unavailable' ? 'activity unavailable right now' : status === 'offline' ? 'off the radar for a bit' : '[nothing on the record right now]';
            content.appendChild(empty);
        }
    }
    async function refresh() {
        if (document.hidden || controller) return;
        window.clearTimeout(timer);
        controller = new AbortController();
        var timeout = window.setTimeout(function () { controller.abort(); }, 8000);
        try {
            var response = await fetch('https://api.lanyard.rest/v1/users/' + userId, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
            if (!response.ok) throw new Error('Presence unavailable');
            var payload = await response.json();
            if (!document.hidden) render(payload.success === true && payload.data && typeof payload.data === 'object' ? payload.data : null);
        } catch (error) {
            if (!document.hidden) render(null);
        } finally {
            window.clearTimeout(timeout);
            controller = null;
            if (!document.hidden) timer = window.setTimeout(refresh, 30000);
        }
    }
    document.addEventListener('visibilitychange', function () {
        window.clearTimeout(timer);
        updateProgress();
        if (!document.hidden) refresh();
    });
    window.addEventListener('pagehide', function () {
        window.clearTimeout(timer);
        window.clearTimeout(progressTimer);
        if (controller) controller.abort();
    });
    window.addEventListener('pageshow', function () { updateProgress(); refresh(); });
    refresh();
})();
