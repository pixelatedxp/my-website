// Music page: live Spotify card, "on repeat" top five, and songs visitors sent (with the send form).
(function () {
    'use strict';
    var config = window.PIXEL_NOTES_CONFIG || {};
    var base = (config.apiBase || '').replace(/\/$/, '');
    var $ = function (id) { return document.getElementById(id); };
    var NOTE_ICON = $('spotifyArt').innerHTML;

    var text = function (v) { return typeof v === 'string' ? v.trim().slice(0, 200) : ''; };
    function spotifyUrl(v) { return typeof v === 'string' && /^https:\/\/open\.spotify\.com\/(track|episode)\/[A-Za-z0-9]+(\?[A-Za-z0-9=&_-]*)?$/.test(v) ? v : ''; }
    function imageUrl(v) { return typeof v === 'string' && /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/.test(v) ? v : ''; }
    function clock(seconds) { seconds = Math.max(0, Math.floor(seconds)); return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); }
    function ago(time) {
        if (!Number.isFinite(time)) return '';
        var minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
        if (minutes < 1) return 'just now';
        if (minutes < 60) return minutes + 'm ago';
        var hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + 'h ago';
        var days = Math.floor(hours / 24);
        return days === 1 ? 'yesterday' : days + 'd ago';
    }
    function setArt(target, url, alt) {
        target.replaceChildren();
        if (!url) { target.innerHTML = NOTE_ICON; return; }
        var img = document.createElement('img');
        img.src = url; img.alt = alt; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', function () { target.innerHTML = NOTE_ICON; });
        target.appendChild(img);
    }

    // ---- right now
    var song = null, last = null, key = '';
    function render(view) {
        var next = JSON.stringify(view);
        if (next === key) return tick();
        key = next; song = view.song; last = view.last;
        var card = $('spotify'), shown = song || last;
        card.dataset.state = song ? (song.paused ? 'paused' : 'playing') : last ? 'last' : 'idle';
        $('spotifyLabelText').textContent = song ? (song.paused ? 'paused on spotify' : 'listening on spotify')
            : last ? 'last played' + (ago(last.playedAt) ? ' · ' + ago(last.playedAt) : '') : view.error ? 'spotify unavailable' : 'not listening right now';
        $('spotifyTitle').textContent = shown ? shown.title : 'silence, for now';
        $('spotifyArtist').textContent = shown ? shown.artist : 'check back later';
        setArt($('spotifyArt'), shown && shown.art, shown ? 'Album art for ' + shown.title : '');
        var link = $('spotifyLink');
        link.hidden = !(shown && shown.url);
        if (shown && shown.url) { link.href = shown.url; link.setAttribute('aria-label', 'Open ' + shown.title + ' on Spotify'); } else link.removeAttribute('href');
        $('spotifyProgress').hidden = !(song && song.length);
        tick();
    }
    function tick() {
        if (!song || !song.length) return;
        var done = song.paused ? song.progress : Math.min(song.length, Date.now() - song.start);
        $('spotifyBar').max = song.length / 1000; $('spotifyBar').value = done / 1000;
        $('spotifyElapsed').textContent = clock(done / 1000); $('spotifyLength').textContent = clock(song.length / 1000);
        if (!song.paused && done >= song.length) setTimeout(refresh, 1500);
    }
    async function refresh() {
        if (!base) return render({ error: true });
        try {
            var data = await fetch(base + '/api/now-playing', { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.json(); });
            var received = Date.now(), view = {};
            if (data && data.configured === true && !data.error && text(data.title) && (data.playing === true || data.paused === true)) {
                var length = Math.max(0, Number(data.durationMs) || 0);
                var progress = Math.max(0, Number(data.progressMs) || 0);
                view.song = { title: text(data.title), artist: text(data.artist), art: imageUrl(data.albumArt), url: spotifyUrl(data.url), length: length, paused: data.playing !== true };
                if (view.song.paused) view.song.progress = Math.min(progress, length || Infinity);
                else view.song.start = received - progress - Math.max(0, Number(data.ageMs) || 0);
                // keep a steady start time so the card doesn't redraw on clock jitter
                if (song && !song.paused && !view.song.paused && song.title === view.song.title && Math.abs(song.start - view.song.start) < 4000) view.song.start = song.start;
            } else if (data && data.last && text(data.last.title)) {
                var played = Date.parse(data.last.playedAt);
                view.last = { title: text(data.last.title), artist: text(data.last.artist), art: imageUrl(data.last.albumArt), url: spotifyUrl(data.last.url), playedAt: Number.isFinite(played) ? played : null };
            } else if (!data || data.error) view.error = true;
            render(view);
        } catch (e) { render({ error: true }); }
    }
    refresh();
    setInterval(function () { if (!document.hidden) refresh(); }, 20000);
    setInterval(tick, 1000);
    setInterval(function () { if (last && !song) $('spotifyLabelText').textContent = 'last played' + (ago(last.playedAt) ? ' · ' + ago(last.playedAt) : ''); }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });

    // ---- on repeat
    async function loadTop() {
        var list = $('topTracks'), status = $('topStatus');
        if (!base) { status.textContent = 'the tape deck is unplugged.'; list.setAttribute('aria-busy', 'false'); return; }
        try {
            var data = await fetch(base + '/api/top-tracks', { credentials: 'omit' }).then(function (r) { return r.json(); });
            var tracks = (data && Array.isArray(data.tracks) ? data.tracks : []).slice(0, 5);
            list.replaceChildren();
            tracks.forEach(function (t, i) {
                if (!text(t.title)) return;
                var li = document.createElement('li');
                var inner = document.createElement(spotifyUrl(t.url) ? 'a' : 'span');
                if (inner.tagName === 'A') { inner.href = spotifyUrl(t.url); inner.target = '_blank'; inner.rel = 'noopener noreferrer'; }
                var num = document.createElement('span'); num.className = 'side-num mono'; num.textContent = String(i + 1).padStart(2, '0');
                var art = document.createElement('span'); art.className = 'track-art';
                if (imageUrl(t.albumArt)) { var img = document.createElement('img'); img.src = imageUrl(t.albumArt); img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; art.appendChild(img); }
                var copy = document.createElement('span'); copy.className = 'track-copy';
                var b = document.createElement('b'); b.textContent = text(t.title);
                var a = document.createElement('span'); a.textContent = text(t.artist);
                copy.append(b, a); inner.append(num, art, copy); li.appendChild(inner); list.appendChild(li);
            });
            status.hidden = list.children.length > 0;
            status.textContent = data && data.needsPermission ? 'this tape needs one more spotify permission. soon.' : 'nothing on repeat yet.';
        } catch (e) { status.textContent = 'the tape got tangled. try again later.'; }
        list.setAttribute('aria-busy', 'false');
    }
    loadTop();

    // ---- always: add album art and direct links once Spotify has matched each song
    async function loadAlways() {
        if (!base) return;
        try {
            var data = await fetch(base + '/api/always', { credentials: 'omit' }).then(function (r) { return r.json(); });
            (data && Array.isArray(data.tracks) ? data.tracks : []).forEach(function (t, i) {
                var holder = document.querySelector('[data-always="' + i + '"]');
                if (!holder) return;
                if (imageUrl(t.albumArt)) { var img = document.createElement('img'); img.src = imageUrl(t.albumArt); img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; holder.replaceChildren(img); }
                if (spotifyUrl(t.url)) holder.closest('a').href = spotifyUrl(t.url);
            });
        } catch (e) { /* the plain list still works */ }
    }
    loadAlways();

    // ---- recently played receipt
    async function loadRecent() {
        var list = $('recentTracks'), status = $('recentStatus');
        if (!base) { status.textContent = 'printer offline.'; list.setAttribute('aria-busy', 'false'); return; }
        try {
            var data = await fetch(base + '/api/recent', { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.json(); });
            list.replaceChildren();
            // Back-to-back plays of the same song become one line: "Buttercup ×3".
            var groups = [];
            (data && Array.isArray(data.tracks) ? data.tracks : []).forEach(function (t) {
                if (!text(t.title)) return;
                var prev = groups[groups.length - 1];
                if (prev && prev.title === t.title && prev.artist === t.artist) prev.count++;
                else groups.push({ title: t.title, artist: t.artist, url: t.url, playedAt: t.playedAt, count: 1 });
            });
            groups.slice(0, 5).forEach(function (t) {
                var li = document.createElement('li');
                var link = document.createElement(spotifyUrl(t.url) ? 'a' : 'span');
                if (link.tagName === 'A') { link.href = spotifyUrl(t.url); link.target = '_blank'; link.rel = 'noopener noreferrer'; }
                var copy = document.createElement('span'); copy.className = 'receipt-copy';
                var b = document.createElement('b'); b.textContent = text(t.title);
                var a = document.createElement('span'); a.textContent = text(t.artist);
                copy.append(b, a);
                var when = document.createElement('span'); when.className = 'receipt-when mono';
                if (t.count > 1) { var times = document.createElement('span'); times.className = 'receipt-times'; times.textContent = '×' + t.count; when.append(times, ' '); }
                when.append(ago(Date.parse(t.playedAt)));
                link.append(copy, when); li.appendChild(link); list.appendChild(li);
            });
            status.hidden = list.children.length > 0;
            status.textContent = 'nothing played lately.';
        } catch (e) { status.textContent = 'out of paper. try again later.'; }
        list.setAttribute('aria-busy', 'false');
    }
    loadRecent();

    // ---- time listened
    // Minutes, like Spotify Wrapped: big number, small "min" after it.
    function setMinutes(el, minutes) {
        var unit = document.createElement('span'); unit.className = 'unit'; unit.textContent = ' min';
        el.replaceChildren(Math.max(0, Math.round(Number(minutes) || 0)).toLocaleString('en'), unit);
    }
    async function loadTime() {
        if (!base) return;
        try {
            var data = await fetch(base + '/api/listening-time', { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.json(); });
            setMinutes($('timeToday'), data.today); setMinutes($('timeWeek'), data.week);
            setMinutes($('timeYear'), data.year); setMinutes($('timeAll'), data.allTime);
            var since = Date.parse(data.since);
            if (Number.isFinite(since)) $('timeNote').textContent = 'all time counts every song since ' + new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(since).toLowerCase() + '. updated from spotify every few minutes.';
        } catch (e) { $('timeToday').textContent = $('timeWeek').textContent = $('timeYear').textContent = $('timeAll').textContent = '?'; }
    }
    loadTime();
    setInterval(function () { if (!document.hidden) { loadRecent(); loadTime(); } }, 60000);

    // ---- songs people sent me
    async function loadSent() {
        var list = $('sentSongs'), status = $('sentStatus');
        if (!base) { status.textContent = 'the mailbox opens soon.'; list.setAttribute('aria-busy', 'false'); return; }
        try {
            var data = await fetch(base + '/api/songs', { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.json(); });
            list.replaceChildren();
            (data && Array.isArray(data.songs) ? data.songs : []).forEach(function (s, i) {
                if (!text(s.title)) return;
                var li = document.createElement('li'); li.className = 'sent-song'; li.style.setProperty('--tilt', ['-1deg', '.8deg', '-.4deg', '1.2deg'][i % 4]);
                var link = document.createElement('a');
                link.href = 'https://open.spotify.com/search/' + encodeURIComponent(text(s.title) + ' ' + text(s.artist));
                link.target = '_blank'; link.rel = 'noopener noreferrer';
                var b = document.createElement('b'); b.textContent = text(s.title);
                var a = document.createElement('span'); a.className = 'muted'; a.textContent = text(s.artist);
                link.append(b, a); li.appendChild(link);
                if (text(s.note)) { var n = document.createElement('p'); n.className = 'sent-note hand'; n.textContent = '“' + text(s.note) + '”'; li.appendChild(n); }
                var from = document.createElement('span'); from.className = 'sent-from mono'; from.textContent = 'from ' + (text(s.name) || 'someone'); li.appendChild(from);
                list.appendChild(li);
            });
            status.hidden = list.children.length > 0;
            status.textContent = 'no picks yet. be the first.';
        } catch (e) { status.textContent = 'the mailbox is stuck. try again later.'; }
        list.setAttribute('aria-busy', 'false');
    }
    loadSent();

    // ---- send a song
    var form = $('songForm'), token = '', widgetId, submissionId = crypto.randomUUID ? crypto.randomUUID() : null;
    var setStatus = function (msg, bad) { $('songStatus').textContent = msg; $('songStatus').classList.toggle('error', !!bad); };
    $('songNote').addEventListener('input', function () { $('songNoteCount').textContent = $('songNote').value.length + ' / 200'; });
    form.addEventListener('input', function () { submissionId = crypto.randomUUID ? crypto.randomUUID() : null; });
    if (!base || !config.turnstileSiteKey || !submissionId) { $('songSubmit').disabled = true; setStatus('song picks open soon.'); }
    else {
        window.pixelSongTurnstileReady = function () {
            widgetId = window.turnstile.render('#songTurnstile', { sitekey: config.turnstileSiteKey, action: 'send-song', theme: 'auto', size: 'flexible',
                callback: function (t) { token = t; }, 'expired-callback': function () { token = ''; }, 'error-callback': function () { token = ''; } });
        };
        var script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=pixelSongTurnstileReady&render=explicit';
        script.async = true; script.defer = true; document.head.appendChild(script);
    }
    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        var title = $('songTitle').value.trim(), artist = $('songArtist').value.trim();
        if (!title) { setStatus('add the song name first.', true); $('songTitle').focus(); return; }
        if (!artist) { setStatus('who is it by?', true); $('songArtist').focus(); return; }
        if (!token) { setStatus('give the spam check a second, then try again.', true); return; }
        $('songSubmit').disabled = true; setStatus('sending…');
        try {
            var response = await fetch(base + '/api/songs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
                body: JSON.stringify({ id: submissionId, title: title, artist: artist, name: $('songName').value.trim(), note: $('songNote').value.trim(), website: $('songWebsite').value, turnstileToken: token }) });
            var result = await response.json().catch(function () { return {}; });
            if (!response.ok) throw new Error(result.error || 'That did not send. Try again in a bit.');
            form.reset(); $('songNoteCount').textContent = '0 / 200';
            submissionId = crypto.randomUUID();
            setStatus('sent! it shows up here once Pixel gives it a listen.');
        } catch (e) { setStatus(e.message || 'That did not send. Try again in a bit.', true); }
        token = ''; if (window.turnstile && widgetId !== undefined) window.turnstile.reset(widgetId);
        $('songSubmit').disabled = false;
    });
})();
