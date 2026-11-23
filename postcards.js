/*
 * Shared postcard rendering for the homepage and the postcard wall.
 * Visitor text is only ever inserted as text nodes, never as HTML.
 */
(function () {
    'use strict';
    var SVG = 'http://www.w3.org/2000/svg';
    // Keep this list in sync with BADGES in backend/src/validation.mjs.
    var BADGES = {
        cat: { label: 'cat', path: 'M5 20v-8L4 5l4 3h8l4-3-1 7v8zM9 13h.01M15 13h.01M10.5 16.5l1.5 1 1.5-1' },
        ghost: { label: 'ghost', path: 'M5 21V10a7 7 0 0 1 14 0v11l-2.5-2-2.3 2-2.2-2-2.2 2-2.3-2zM9.5 10h.01M14.5 10h.01' },
        star: { label: 'star', path: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z' },
        heart: { label: 'heart', path: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' },
        game: { label: 'controller', path: 'M6 8h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 13H9l-1.6 1.8A3 3 0 0 1 2 13v-1a4 4 0 0 1 4-4zM7 10.5v3M5.5 12h3M16 11h.01M18 13h.01' },
        music: { label: 'music note', path: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' }
    };
    var STAMPS = { yellow: 'var(--stamp-yellow)', pink: 'var(--stamp-pink)', blue: 'var(--stamp-blue)', green: 'var(--stamp-green)' };
    var PAPER = { yellow: '#fff0b3', pink: '#f9d6e2', blue: '#d4eaf5', green: '#daebcd' };
    var TILTS = ['-1deg', '1.2deg', '.6deg', '-1.4deg', '.9deg', '-.7deg'];

    function icon(name, label) {
        var badge = BADGES[name];
        if (!badge) return null;
        var svg = document.createElementNS(SVG, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); }
        else svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS(SVG, 'path');
        path.setAttribute('d', badge.path);
        svg.appendChild(path);
        return svg;
    }

    function renderContent(target, content) {
        target.replaceChildren();
        (content || []).forEach(function (part) {
            if (!part || typeof part.text !== 'string') return;
            var node = document.createTextNode(part.text);
            [['underline', 'u'], ['italic', 'em'], ['bold', 'strong']].forEach(function (pair) {
                if (part[pair[0]]) { var wrap = document.createElement(pair[1]); wrap.appendChild(node); node = wrap; }
            });
            target.appendChild(node);
        });
    }

    function initial(name) {
        var first = Array.from(String(name || '?').trim())[0] || '?';
        return first.toLocaleUpperCase();
    }

    function shortDate(iso) {
        var date = new Date(iso);
        if (isNaN(date)) return '';
        return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date);
    }

    function fullDate(iso) {
        var date = new Date(iso);
        if (isNaN(date)) return '';
        return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
    }

    // note: { name, content, colour, badge, createdAt, pinned, doodleUrl }
    function render(note, options) {
        options = options || {};
        var card = document.createElement('article');
        card.className = 'postcard';
        card.style.setProperty('--stamp', STAMPS[note.colour] || STAMPS.yellow);
        card.style.setProperty('--tilt', TILTS[(options.index || 0) % TILTS.length]);

        var body = document.createElement('div');
        body.className = 'postcard-body';
        var text = document.createElement('p');
        text.className = 'postcard-text';
        renderContent(text, note.content);
        body.appendChild(text);

        if (note.doodleUrl) {
            var image = document.createElement('img');
            image.className = 'postcard-doodle';
            image.src = note.doodleUrl;
            image.alt = 'Doodle from ' + (note.name || 'a visitor');
            image.width = 480; image.height = 240;
            image.loading = 'lazy';
            image.addEventListener('error', function () { image.hidden = true; });
            body.appendChild(image);
        }

        var from = document.createElement('p');
        from.className = 'postcard-from';
        from.appendChild(document.createTextNode('— ' + (note.name || 'Anonymous')));
        var badgeIcon = icon(note.badge, BADGES[note.badge] ? BADGES[note.badge].label + ' badge' : '');
        if (badgeIcon) from.appendChild(badgeIcon);
        if (options.preview) from.appendChild(document.createTextNode('· date added when sent'));
        else if (note.createdAt) {
            var time = document.createElement('time');
            time.dateTime = note.createdAt;
            time.title = fullDate(note.createdAt);
            time.textContent = '· ' + shortDate(note.createdAt);
            from.appendChild(time);
        }
        body.appendChild(from);

        var side = document.createElement('div');
        side.className = 'postcard-side';
        side.setAttribute('aria-hidden', 'true');
        var stamp = document.createElement('span');
        stamp.className = 'stamp';
        stamp.textContent = initial(note.name);
        var mark = document.createElement('span');
        mark.className = 'postmark';
        var markIcon = icon(note.badge);
        if (markIcon) mark.appendChild(markIcon);
        else {
            mark.appendChild(document.createTextNode(options.preview ? 'TODAY' : (shortDate(note.createdAt) || '').toUpperCase()));
            mark.appendChild(document.createElement('br'));
            mark.appendChild(document.createTextNode('PIXELIS'));
        }
        side.append(stamp, mark);

        card.append(body, side);
        if (note.pinned) {
            var pin = document.createElement('span');
            pin.className = 'pin';
            pin.textContent = 'pinned';
            card.appendChild(pin);
        }
        return card;
    }

    // Accept only the API's own doodle path, resolved against the API base.
    function safeDoodle(base, path) {
        return typeof path === 'string' && /^\/api\/notes\/[0-9a-f-]{36}\/doodle$/.test(path) ? base + path : null;
    }

    // Masonry: each card spans as many 4px rows as it is tall, so a long
    // postcard no longer stretches its row and leaves gaps beside it.
    var ROW = 4;
    function masonry(grid) {
        if (!grid || grid.dataset.masonry || !('ResizeObserver' in window)) return;
        grid.dataset.masonry = 'on';
        grid.classList.add('is-masonry');
        var fit = function (card) {
            var gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
            card.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((card.offsetHeight + gap) / ROW));
        };
        var sizes = new ResizeObserver(function (entries) { entries.forEach(function (e) { fit(e.target); }); });
        var watch = function () { Array.prototype.forEach.call(grid.children, function (c) { sizes.observe(c); fit(c); }); };
        new MutationObserver(watch).observe(grid, { childList: true });
        watch();
    }
    Array.prototype.forEach.call(document.querySelectorAll('.postcard-grid'), masonry);

    window.PixelPostcards = { masonry: masonry, BADGES: BADGES, PAPER: PAPER, icon: icon, render: render, renderContent: renderContent, safeDoodle: safeDoodle };
})();
