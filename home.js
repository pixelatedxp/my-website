(function () {
    'use strict';
    var P = window.PixelPostcards;
    var config = window.PIXEL_NOTES_CONFIG || {};
    var base = (config.apiBase || '').replace(/\/$/, '');
    var POSTMARK_KEY = 'pixelisPostmark';
    var HOME_MAX_LENGTH = 120;
    // Postcards to leave off the homepage (they stay on the full wall). Add a postcard's id to hide it here.
    var HOME_HIDDEN = [
        '95279080-e98f-4596-9693-c2301aac9c2a', // 重音テト
        'a205f63c-d552-4cc8-8dc7-278d65c05d56', // Hoku
        '3724cff5-8fb5-433e-a638-4c52008d89fa', // Viloes
        'c6646264-705e-497c-ad87-01c8e5736565'  // Kazoch
    ];

    function storageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function storageSet(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

    // Friend photos: drop missing images so the coloured initial shows instead.
    document.querySelectorAll('.friend-photo img').forEach(function (img) {
        function drop() { img.remove(); }
        if (img.complete && img.naturalWidth === 0) drop();
        else img.addEventListener('error', drop);
    });

    // Postmark picker: remembered and preselected on the postcard wall.
    var picker = document.getElementById('postmarkPicker');
    if (picker && P) {
        var saved = storageGet(POSTMARK_KEY);
        Object.keys(P.BADGES).forEach(function (key, i) {
            var label = document.createElement('label');
            label.className = 'badge-option';
            var input = document.createElement('input');
            input.type = 'radio'; input.name = 'postmark'; input.value = key;
            input.setAttribute('aria-label', P.BADGES[key].label);
            input.checked = saved ? saved === key : i === 0;
            input.addEventListener('change', function () { storageSet(POSTMARK_KEY, key); });
            var face = document.createElement('span');
            face.appendChild(P.icon(key));
            label.title = P.BADGES[key].label;
            label.append(input, face);
            picker.appendChild(label);
        });
    }

    // Latest postcards.
    var wall = document.getElementById('homePostcards');
    var status = document.getElementById('homePostcardsStatus');
    async function loadPostcards() {
        if (!wall || !P) return;
        if (!base) { status.textContent = 'the postcard wall opens soon.'; return; }
        try {
            var response = await fetch(base + '/api/notes', { signal: AbortSignal.timeout(10000), cache: 'no-store' });
            if (!response.ok) throw new Error('unavailable');
            var result = await response.json();
            // The homepage keeps to short postcards; long ones still appear on the full wall.
            var notes = (Array.isArray(result.notes) ? result.notes : []).filter(function (note) {
                var length = (note.content || []).reduce(function (sum, part) { return sum + (part && typeof part.text === 'string' ? Array.from(part.text).length : 0); }, 0);
                return length <= HOME_MAX_LENGTH && HOME_HIDDEN.indexOf(note.id) === -1;
            }).slice(0, 6);
            wall.replaceChildren();
            notes.forEach(function (note, i) {
                note.doodleUrl = P.safeDoodle(base, note.doodleUrl);
                wall.appendChild(P.render(note, { index: i }));
            });
            status.hidden = notes.length > 0;
            status.textContent = 'no postcards yet. be the first one.';
        } catch (error) {
            wall.replaceChildren();
            status.hidden = false;
            status.textContent = "the postcards are stuck in the mail right now. try again in a bit.";
        } finally {
            wall.setAttribute('aria-busy', 'false');
        }
    }
    loadPostcards();

    // Copy email.
    document.querySelectorAll('[data-copy]').forEach(function (button) {
        button.addEventListener('click', async function (event) {
            event.preventDefault();
            var note = document.getElementById(button.getAttribute('aria-describedby'));
            try {
                await navigator.clipboard.writeText(button.dataset.copy);
                if (note) note.textContent = 'copied!';
            } catch (error) {
                window.location.href = 'mailto:' + button.dataset.copy;
                return;
            }
            setTimeout(function () { if (note) note.textContent = ''; }, 2000);
        });
    });
})();
