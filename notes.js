(function () {
    'use strict';
    const config = window.PIXEL_NOTES_CONFIG || {};
    const base = (config.apiBase || '').replace(/\/$/, '');
    const $ = id => document.getElementById(id);
    const editor = $('noteEditor'), form = $('noteForm'), canvas = $('doodleCanvas');
    const ctx = canvas.getContext('2d');
    const paper = { yellow: '#fff0b3', pink: '#f9d6e2', blue: '#d4eaf5', green: '#daebcd' };
    const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
    const count = text => segmenter ? [...segmenter.segment(text)].length : [...text].length;
    const draftKey = 'pixelisNoteDraftV1';
    let strokes = [], currentStroke = null, token = '', widgetId, busy = false, cursor = null;
    let submissionId = crypto.randomUUID(), lastFingerprint = '', draftTimer;

    function readContent() {
        const parts = [];
        function add(text, style) {
            if (!text) return;
            const part = { text, bold: !!style.bold, italic: !!style.italic, underline: !!style.underline };
            const last = parts.at(-1);
            if (last && ['bold', 'italic', 'underline'].every(k => last[k] === part[k])) last.text += text;
            else parts.push(part);
        }
        function walk(node, style) {
            if (node.nodeType === Node.TEXT_NODE) { add(node.textContent, style); return; }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.tagName === 'BR') { add('\n', style); return; }
            const next = {
                bold: style.bold || ['B', 'STRONG'].includes(node.tagName) || /^(bold|[7-9]00)$/.test(node.style.fontWeight),
                italic: style.italic || ['I', 'EM'].includes(node.tagName) || node.style.fontStyle === 'italic',
                underline: style.underline || node.tagName === 'U' || node.style.textDecoration.includes('underline')
            };
            if (['DIV', 'P'].includes(node.tagName) && parts.length && !parts.at(-1).text.endsWith('\n')) add('\n', next);
            node.childNodes.forEach(child => walk(child, next));
        }
        editor.childNodes.forEach(node => walk(node, {}));
        return parts;
    }

    function renderContent(target, content) {
        target.replaceChildren();
        for (const part of content || []) {
            if (!part || typeof part.text !== 'string') continue;
            let node = document.createTextNode(part.text);
            for (const [flag, tag] of [['underline', 'u'], ['italic', 'em'], ['bold', 'strong']]) {
                if (part[flag]) { const wrap = document.createElement(tag); wrap.appendChild(node); node = wrap; }
            }
            target.appendChild(node);
        }
    }

    function colour() { return form.elements.colour.value || 'yellow'; }
    function doodleImage() {
        if (!strokes.length) return null;
        const output = document.createElement('canvas'); output.width = 480; output.height = 240;
        const surface = output.getContext('2d'); surface.fillStyle = paper[colour()]; surface.fillRect(0, 0, 480, 240); surface.drawImage(canvas, 0, 0);
        return output.toDataURL('image/png');
    }

    function makeCard(note, preview = false) {
        const card = document.createElement('article'); card.className = 'sticky-card'; card.style.setProperty('--paper', paper[note.colour] || paper.yellow);
        const time = document.createElement('time');
        if (preview) time.textContent = 'date & time added when you submit';
        else {
            time.dateTime = note.createdAt;
            time.textContent = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(note.createdAt));
        }
        const copy = document.createElement('div'); copy.className = 'note-copy'; renderContent(copy, note.content);
        card.append(time, copy);
        if (note.doodleUrl) {
            const image = document.createElement('img'); image.src = note.doodleUrl; image.alt = `Doodle from ${note.name}`; image.width = 480; image.height = 240;
            image.loading = 'lazy';
            image.addEventListener('load', layoutWall);
            image.addEventListener('error', () => { image.hidden = true; layoutWall(); });
            card.appendChild(image);
        }
        const signature = document.createElement('p'); signature.className = 'note-signature'; signature.textContent = '— ' + note.name;
        card.appendChild(signature); return card;
    }

    function saveDraft() {
        try { localStorage.setItem(draftKey, JSON.stringify({ name: $('noteName').value, anonymous: $('anonymous').checked, content: readContent(), colour: colour(), strokes, submissionId, lastFingerprint })); } catch (_) {}
    }
    function scheduleDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 200); }
    function update() {
        const content = readContent(); const length = count(content.map(p => p.text).join(''));
        $('characterCount').textContent = `${length} / 250`;
        $('characterCount').classList.toggle('over-limit', length > 250);
        editor.setAttribute('aria-invalid', String(length > 250));
        const anonymous = $('anonymous').checked;
        $('noteName').disabled = anonymous || busy; $('noteName').required = !anonymous;
        canvas.style.backgroundColor = paper[colour()];
        $('notePreview').replaceChildren(makeCard({ name: anonymous ? 'Anonymous' : $('noteName').value.trim() || 'your name', content: content.length ? content : [{ text: 'your note goes here.' }], colour: colour(), doodleUrl: doodleImage() }, true));
        scheduleDraft();
    }

    let savedRange;
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || !editor.contains(selection.anchorNode)) return;
        savedRange = selection.getRangeAt(0).cloneRange();
        document.querySelectorAll('[data-format]').forEach(button => button.setAttribute('aria-pressed', String(document.queryCommandState(button.dataset.format))));
    });
    document.querySelectorAll('[data-format]').forEach(button => {
        button.addEventListener('mousedown', event => event.preventDefault());
        button.addEventListener('click', () => {
            editor.focus();
            if (savedRange && editor.contains(savedRange.commonAncestorContainer)) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(savedRange); }
            document.execCommand(button.dataset.format, false); update();
        });
    });
    editor.addEventListener('paste', event => {
        event.preventDefault(); const text = event.clipboardData.getData('text/plain').slice(0, 2000);
        document.execCommand('insertText', false, text); update();
    });
    editor.addEventListener('drop', event => event.preventDefault());
    editor.addEventListener('input', update);
    editor.addEventListener('blur', () => { if (!editor.textContent.trim()) { editor.replaceChildren(); update(); } });
    form.addEventListener('change', update);
    $('noteName').addEventListener('input', update);

    function point(event) { const r = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(480, (event.clientX - r.left) / r.width * 480)), y: Math.max(0, Math.min(240, (event.clientY - r.top) / r.height * 240)) }; }
    function drawStroke(stroke) {
        ctx.strokeStyle = stroke.colour; ctx.fillStyle = stroke.colour; ctx.lineWidth = stroke.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (stroke.points.length === 1) { const p = stroke.points[0]; ctx.beginPath(); ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2); ctx.fill(); return; }
        ctx.beginPath(); ctx.moveTo(stroke.points[0].x, stroke.points[0].y); stroke.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
    }
    function redraw() { ctx.clearRect(0, 0, 480, 240); strokes.forEach(drawStroke); }
    canvas.addEventListener('pointerdown', event => {
        if (busy || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        if (strokes.length >= 100) { setStatus('That is a lot of doodling! Undo or clear a stroke to keep drawing.', true); return; }
        canvas.setPointerCapture(event.pointerId);
        currentStroke = { colour: $('penColour').value, size: Number($('penSize').value), points: [point(event)] };
        strokes.push(currentStroke); drawStroke(currentStroke);
    });
    canvas.addEventListener('pointermove', event => {
        if (!currentStroke || currentStroke.points.length >= 600) return;
        const p = point(event), last = currentStroke.points.at(-1);
        if (Math.hypot(p.x - last.x, p.y - last.y) < 1.2) return;
        currentStroke.points.push(p); drawStroke({ ...currentStroke, points: [last, p] });
    });
    function endStroke() {
        if (!currentStroke) return;
        currentStroke = null;
        // Commit the same complete paths used when restoring a draft. Incremental
        // pointer segments overlap differently and would change the retry image.
        redraw(); update();
    }
    canvas.addEventListener('pointerup', endStroke); canvas.addEventListener('pointercancel', endStroke); canvas.addEventListener('lostpointercapture', endStroke);
    $('undoDoodle').addEventListener('click', () => { strokes.pop(); redraw(); update(); });
    $('clearDoodle').addEventListener('click', () => { strokes = []; redraw(); update(); });

    function setStatus(message, error = false) { $('formStatus').textContent = message; $('formStatus').classList.toggle('error', error); }
    function setBusy(value) {
        busy = value; form.setAttribute('aria-busy', String(value));
        form.querySelectorAll('input,button,select').forEach(el => el.disabled = value);
        $('noteName').disabled = value || $('anonymous').checked;
        editor.contentEditable = String(!value); $('submitLabel').textContent = value ? 'Sending your note…' : 'Send for approval';
        form.querySelector('.submit-spinner').hidden = !value;
    }

    function setupTurnstile() {
        if (!base || !config.turnstileSiteKey) { setStatus('The note wall is being connected. You can write a draft; submissions will open soon.'); $('submitNote').disabled = true; return; }
        window.pixelNotesTurnstileReady = () => {
            widgetId = window.turnstile.render('#turnstileWidget', {
                sitekey: config.turnstileSiteKey, action: 'leave-note', theme: 'auto', size: 'flexible',
                callback: value => { token = value; if (!busy) setStatus(''); },
                'expired-callback': () => { token = ''; },
                'error-callback': () => { token = ''; setStatus('The spam check could not load. Check your connection or blocker settings, then retry.', true); }
            });
        };
        const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=pixelNotesTurnstileReady&render=explicit'; script.async = true; script.defer = true;
        script.onerror = () => setStatus('The spam check could not load. Please reload when your connection is back.', true);
        document.head.appendChild(script);
    }

    form.addEventListener('submit', async event => {
        event.preventDefault(); if (busy) return;
        const content = readContent(), text = content.map(p => p.text).join('');
        if (!text.trim() || count(text) > 250) { setStatus('Write a note between 1 and 250 characters.', true); editor.focus(); return; }
        const anonymous = $('anonymous').checked, name = anonymous ? 'Anonymous' : $('noteName').value.trim();
        if (!name || count(name) > 32) { setStatus('Use a name between 1 and 32 characters, or choose Anonymous.', true); return; }
        if (!$('rulesAccepted').checked) { setStatus('Please confirm your note and doodle follow the rules.', true); return; }
        if (!base || !token) { setStatus('Please complete the spam check before submitting.', true); return; }
        const body = { name, anonymous, content, colour: colour(), doodle: doodleImage(), rulesAccepted: true };
        const fingerprint = JSON.stringify(body);
        if (lastFingerprint && fingerprint !== lastFingerprint) submissionId = crypto.randomUUID();
        lastFingerprint = fingerprint; saveDraft();
        setBusy(true); setStatus('');
        try {
            const response = await fetch(base + '/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id: submissionId, turnstileToken: token }), signal: AbortSignal.timeout(20000) });
            const result = await response.json();
            if (!response.ok || !result.accepted) throw new Error(result.error || 'Your note could not be saved. Please try again.');
            clearTimeout(draftTimer); try { localStorage.removeItem(draftKey); } catch (_) {}
            $('composerContents').hidden = true; $('submissionSuccess').hidden = false; $('submissionSuccess').focus();
        } catch (error) {
            setBusy(false);
            setStatus(error.name === 'TimeoutError' || error instanceof TypeError ? 'The connection was interrupted. Your draft is saved—retrying will not send it twice.' : error.message, true);
            token = ''; if (window.turnstile && widgetId !== undefined) window.turnstile.reset(widgetId);
        }
    });

    let loading = false;
    function layoutWall() {
        const wall = $('notesWall');
        if (!wall.children.length) return;
        const style = getComputedStyle(wall), rowHeight = Number.parseFloat(style.gridAutoRows), rowGap = Number.parseFloat(style.rowGap);
        if (!rowHeight || !Number.isFinite(rowGap)) return;
        for (const card of wall.children) {
            // Give each card enough tiny grid rows to fit its own height. This makes
            // the next card fill the open space below a shorter neighbour.
            const rows = Math.ceil((card.getBoundingClientRect().height + rowGap) / (rowHeight + rowGap));
            card.style.gridRowEnd = `span ${Math.max(1, rows)}`;
        }
    }
    async function loadWall(more = false) {
        if (loading) return;
        if (!base) { $('wallStatus').textContent = 'The wall opens soon. Your note could be the first one here.'; $('notesWall').setAttribute('aria-busy', 'false'); return; }
        loading = true; $('wallRetry').hidden = true; $('loadMore').disabled = true; $('notesWall').setAttribute('aria-busy', 'true');
        try {
            const response = await fetch(base + '/api/notes' + (more && cursor ? '?before=' + encodeURIComponent(cursor) : ''), { signal: AbortSignal.timeout(12000), cache: 'no-store' });
            if (!response.ok) throw new Error('Could not load notes.');
            const result = await response.json();
            if (!Array.isArray(result.notes)) throw new Error('Invalid response.');
            if (!more) $('notesWall').replaceChildren();
            for (const note of result.notes) {
                if (note.doodleUrl) {
                    // Only the API's approved-image endpoint may supply note images.
                    if (!/^\/api\/notes\/[0-9a-f-]{36}\/doodle$/.test(note.doodleUrl)) note.doodleUrl = null;
                    else note.doodleUrl = base + note.doodleUrl;
                }
                $('notesWall').appendChild(makeCard(note));
            }
            cursor = result.nextCursor; $('loadMore').hidden = !cursor;
            $('wallStatus').hidden = $('notesWall').children.length > 0;
            $('wallStatus').textContent = 'No notes on the wall yet. Leave the first little piece of history.';
            requestAnimationFrame(layoutWall);
        } catch (_) {
            $('wallStatus').hidden = false; $('wallStatus').textContent = 'The wall could not load right now. Your draft is still here.'; $('wallRetry').hidden = false;
        } finally { loading = false; $('loadMore').disabled = false; $('notesWall').setAttribute('aria-busy', 'false'); }
    }
    $('loadMore').addEventListener('click', () => loadWall(true)); $('wallRetry').addEventListener('click', () => loadWall(false));
    window.addEventListener('resize', layoutWall);

    try {
        const draft = JSON.parse(localStorage.getItem(draftKey));
        if (draft) {
            $('noteName').value = typeof draft.name === 'string' ? draft.name.slice(0, 64) : '';
            $('anonymous').checked = draft.anonymous === true;
            if (Array.isArray(draft.content)) renderContent(editor, draft.content.slice(0, 80));
            if (paper[draft.colour]) form.elements.colour.value = draft.colour;
            if (Array.isArray(draft.strokes)) strokes = draft.strokes.slice(0, 100).filter(s => ['#252126', '#147b83', '#bc365e', '#375daa'].includes(s.colour) && [2, 4, 6].includes(s.size) && Array.isArray(s.points) && s.points.length > 0 && s.points.length <= 600 && s.points.every(p => Number.isFinite(p.x) && p.x >= 0 && p.x <= 480 && Number.isFinite(p.y) && p.y >= 0 && p.y <= 240));
            if (/^[0-9a-f-]{36}$/i.test(draft.submissionId || '')) submissionId = draft.submissionId;
            lastFingerprint = typeof draft.lastFingerprint === 'string' ? draft.lastFingerprint : '';
            if (strokes.length) $('doodleSection').open = true;
            redraw();
        }
    } catch (_) {}
    update(); setupTurnstile(); loadWall();
})();
