/*
 * Mochi — the homepage cat.
 * A little calico (so: a girl) drawn as a procedural SVG rig. She wanders, sits,
 * grooms, naps, chases a flying heart, follows your mouse, purrs and arches when
 * you pet her, gets annoyed when you poke her, and can be picked up and tossed.
 * Visitors can rename her by clicking her name tag.
 */
(function () {
    'use strict';
    if (window.__mochiCat) return;
    window.__mochiCat = true;

    // ---------- tiny helpers ----------
    var DEG = Math.PI / 180;
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function approach(cur, tgt, rate, dt) { return cur + (tgt - cur) * (1 - Math.exp(-rate * dt)); }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
    function rot(p, deg) { var c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; }
    function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
    function f1(n) { return Math.round(n * 10) / 10; }
    function storageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function storageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var NAME_KEY = 'mochiCatName';
    var SESSION_KEY = 'pixelyCatSpot';
    var DEFAULT_NAME = 'Pixie';
    var storedName = storageGet(NAME_KEY);
    if (storedName === 'Pixely' || storedName === 'Mochi') storedName = null; // earlier defaults, not a name someone picked
    var catName = (storedName || DEFAULT_NAME).slice(0, 18);

    // Palette: calico — cream base with orange and cocoa patches.
    var OUT = '#3b3340', BASE = '#fffaf2', SHADE = '#eee3d6', ORANGE = '#f3a35c', COCOA = '#5a4a50',
        PINK = '#ff9db4', INNER = '#ffc4d3';

    // ---------- styles ----------
    var css = document.createElement('style');
    css.textContent =
        '.mochi-layer{position:fixed;inset:0;pointer-events:none;z-index:9050;overflow:hidden}' +
        '.mochi-cat{position:absolute;left:0;top:0;pointer-events:none;will-change:transform}' +
        '.mochi-cat svg{display:block;overflow:visible}' +
        '.mochi-hit{pointer-events:all;touch-action:none}' +
        '.mochi-shadow{position:absolute;left:0;top:0;height:8px;border-radius:50%;background:rgba(0,0,0,.28);filter:blur(2px);pointer-events:none;will-change:transform,opacity}' +
        'body:not(.dark-mode) .mochi-shadow{background:rgba(0,0,0,.16)}' +
        '.mochi-heart{position:absolute;left:0;top:0;color:#ff6f9f;font-size:16px;line-height:1;pointer-events:none;text-shadow:0 1px 4px rgba(255,92,154,.35);animation:mochiHeart 1.25s ease-out forwards}' +
        '@keyframes mochiHeart{0%{opacity:0;transform:translate(var(--x0),var(--y0)) scale(.4)}15%{opacity:1}100%{opacity:0;transform:translate(var(--x1),var(--y1)) scale(1.15) rotate(var(--r))}}' +
        '.mochi-z{position:absolute;left:0;top:0;font:700 13px var(--font-mono,monospace);color:var(--text-secondary,#98989d);pointer-events:none;animation:mochiZ 2.4s ease-out forwards}' +
        '@keyframes mochiZ{0%{opacity:0;transform:translate(var(--x0),var(--y0)) scale(.6)}20%{opacity:.9}100%{opacity:0;transform:translate(var(--x1),var(--y1)) scale(1.3)}}' +
        '.mochi-bubble{position:absolute;left:0;top:0;padding:3px 8px;border-radius:10px;background:var(--card-bg,#202024);border:1px solid var(--card-border,rgba(255,255,255,.1));color:var(--text-primary,#f5f5f7);font:12px var(--font-mono,monospace);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .2s;box-shadow:0 4px 14px rgba(0,0,0,.2)}' +
        '.mochi-bubble.show{opacity:1}' +
        '.mochi-name{position:absolute;left:0;top:0;display:flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;background:var(--card-bg,#202024);border:1px solid var(--card-border,rgba(255,255,255,.1));color:var(--text-primary,#f5f5f7);font:11px var(--font-mono,monospace);white-space:nowrap;opacity:0;transition:opacity .25s;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.18)}' +
        '.mochi-name.show{opacity:1;pointer-events:auto}' +
        '.mochi-name .mochi-heartsym{color:#ff6f9f}.mochi-name .mochi-edit{opacity:.55;font-size:10px}.mochi-name:hover .mochi-edit{opacity:1;color:var(--accent-teal,#3ca7cb)}' +
        '.mochi-name .mochi-help{display:inline-grid;place-items:center;width:15px;height:15px;margin-left:2px;border-radius:50%;border:1px solid currentColor;font-size:9px;line-height:1;opacity:.7}' +
        '.mochi-name .mochi-help:hover{opacity:1;color:var(--accent-teal,#3ca7cb)}' +
        '.mochi-name .mochi-help.nudge{opacity:1;color:#ff6f9f;animation:mochiNudge 1.1s ease-in-out infinite}' +
        '@keyframes mochiNudge{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}' +
        '.mochi-tips{position:absolute;left:0;top:0;width:min(290px,calc(100vw - 24px));padding:12px 14px 12px;border-radius:14px;background:var(--card-bg,#202024);border:1px solid var(--card-border,rgba(255,255,255,.1));color:var(--text-primary,#f5f5f7);box-shadow:0 12px 34px rgba(0,0,0,.32);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font:12px/1.45 var(--font-mono,monospace);pointer-events:auto;opacity:0;transform-origin:50% 100%;transition:opacity .2s}' +
        '.mochi-tips.show{opacity:1}' +
        '.mochi-tips h3{margin:0 0 8px;font:700 12px var(--font-mono,monospace);color:var(--text-secondary,#98989d);text-transform:lowercase}' +
        '.mochi-tips ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}' +
        '.mochi-tips li{display:grid;grid-template-columns:20px 1fr;gap:6px;align-items:start}' +
        '.mochi-tips li b{color:var(--text-primary,#f5f5f7);font-weight:700}.mochi-tips li span.d{color:var(--text-secondary,#98989d)}' +
        '.mochi-tips .ic{font-size:13px;line-height:1.3;text-align:center}' +
        '.mochi-tips .row{display:flex;gap:6px;margin-top:10px}' +
        '.mochi-tips button{flex:1;padding:6px 8px;border-radius:9px;border:1px solid var(--card-border,rgba(255,255,255,.12));background:var(--inner-card-bg,rgba(255,255,255,.04));color:inherit;font:inherit}' +
        '.mochi-tips button:hover{border-color:var(--accent-teal,#3ca7cb);color:var(--accent-teal,#3ca7cb)}' +
        '.mochi-tips .x{position:absolute;right:8px;top:6px;flex:none;width:22px;height:22px;padding:0;border:0;background:none;font-size:14px;opacity:.6}' +
        '.mochi-tips ul.mochi-stats{gap:5px}.mochi-tips ul.mochi-stats li{grid-template-columns:1fr auto;gap:12px;padding-bottom:5px;border-bottom:1px dashed var(--card-border,rgba(255,255,255,.08))}' +
        '.mochi-tips ul.mochi-stats li:last-child{border-bottom:0;padding-bottom:0}.mochi-tips ul.mochi-stats b{font-variant-numeric:tabular-nums;text-align:right}' +
        '.mochi-name input{width:110px;border:0;outline:0;background:transparent;color:inherit;font:inherit;-webkit-user-select:text;user-select:text}' +
        '.mochi-toy{position:absolute;left:0;top:0;width:26px;height:22px;pointer-events:none;will-change:transform}' +
        '.mochi-toy .h{position:absolute;left:5px;top:2px;color:#ff5c9a;font-size:18px;line-height:1;text-shadow:0 0 8px rgba(255,92,154,.55)}' +
        '.mochi-toy .w{position:absolute;top:4px;width:9px;height:7px;border-radius:60% 60% 50% 50%;background:rgba(255,255,255,.9);border:1px solid rgba(0,0,0,.12)}' +
        '.mochi-toy .w.l{left:-1px;transform-origin:100% 80%;animation:mochiWingL .16s ease-in-out infinite alternate}' +
        '.mochi-toy .w.r{right:-1px;transform-origin:0 80%;animation:mochiWingR .16s ease-in-out infinite alternate}' +
        '@keyframes mochiWingL{from{transform:rotate(25deg)}to{transform:rotate(-35deg)}}@keyframes mochiWingR{from{transform:rotate(-25deg)}to{transform:rotate(35deg)}}' +
        '.mochi-pop{position:absolute;left:0;top:0;color:#ff5c9a;font-size:11px;pointer-events:none;animation:mochiPop .6s ease-out forwards}' +
        '@keyframes mochiPop{0%{opacity:1;transform:translate(var(--x0),var(--y0)) scale(1)}100%{opacity:0;transform:translate(var(--x1),var(--y1)) scale(.5)}}';
    document.head.appendChild(css);

    // ---------- DOM ----------
    var layer = document.createElement('div');
    layer.className = 'mochi-layer';
    layer.setAttribute('aria-hidden', 'true');
    var shadow = document.createElement('div');
    shadow.className = 'mochi-shadow';
    var holder = document.createElement('div');
    holder.className = 'mochi-cat';
    var VB = { x: -140, y: -170, w: 280, h: 270 };
    var SVGNS = 'http://www.w3.org/2000/svg';

    function eyeMarkup(id) {
        return '<g id="' + id + '">' +
            '<g class="e-open"><ellipse rx="2.7" ry="3.5" fill="#26212a"/><circle class="e-pupil-hi" cx=".9" cy="-1.3" r="1.05" fill="#fff"/><circle cx="-.9" cy="1.2" r=".45" fill="#fff" opacity=".8"/></g>' +
            '<path class="e-happy" d="M-3.1,1 Q0,-3.4 3.1,1" fill="none" stroke="#26212a" stroke-width="1.7" stroke-linecap="round"/>' +
            '<path class="e-closed" d="M-3.1,-.6 Q0,2.2 3.1,-.6" fill="none" stroke="#26212a" stroke-width="1.6" stroke-linecap="round"/>' +
            '<g class="e-angry"><ellipse cy=".8" rx="2.6" ry="1.6" fill="#26212a"/></g>' +
            '<g class="e-wide"><ellipse rx="3.3" ry="4.3" fill="#26212a"/><circle cx="1.1" cy="-1.6" r="1.4" fill="#fff"/><circle cx="-1.1" cy="1.6" r=".6" fill="#fff"/></g>' +
            '</g>';
    }

    holder.innerHTML =
        '<svg xmlns="' + SVGNS + '" viewBox="' + VB.x + ' ' + VB.y + ' ' + VB.w + ' ' + VB.h + '">' +
        '<defs>' +
            '<clipPath id="mochiBodyClip"><path id="mochiBodyClipPath"/><ellipse id="mochiHaunchClip" cx="2" cy="-7" rx="17" ry="14"/></clipPath>' +
            '<clipPath id="mochiHeadClip"><path d="M-16,1 C-16,-10 -8,-15.5 1,-15.5 C10,-15.5 17,-10 17,0 C17,8 10,12.5 1,12.5 C-8,12.5 -16,9 -16,1 Z"/></clipPath>' +
        '</defs>' +
        '<g id="mochiFlip"><g id="mochiRoot">' +
            '<g id="mochiFarLegs"></g>' +
            '<g id="mochiNearLegs"></g>' +
            '<g id="mochiTorso">' +
                '<path id="mochiTailOut" fill="none" stroke="' + OUT + '" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<path id="mochiTail" fill="none" stroke="' + BASE + '" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<path id="mochiTailTip" fill="none" stroke="' + ORANGE + '" stroke-linecap="round"/>' +
                '<path id="mochiBody" fill="' + BASE + '" stroke="' + OUT + '" stroke-width="2.2" stroke-linejoin="round"/>' +
                '<ellipse id="mochiHaunchFill" cx="2" cy="-7" rx="17" ry="14" fill="' + BASE + '"/>' +
                '<g clip-path="url(#mochiBodyClip)">' +
                    '<ellipse cx="9" cy="-19" rx="17" ry="10" fill="' + ORANGE + '" transform="rotate(-8 9 -19)"/>' +
                    '<ellipse cx="-4" cy="-12" rx="8" ry="7" fill="' + COCOA + '"/>' +
                    '<ellipse cx="33" cy="-22" rx="9" ry="6" fill="' + COCOA + '" transform="rotate(10 33 -22)"/>' +
                    '<ellipse cx="22" cy="5" rx="25" ry="6.5" fill="' + SHADE + '" opacity=".7"/>' +
                '</g>' +
                '<path id="mochiBodyLine" fill="none" stroke="' + OUT + '" stroke-width="2.2" stroke-linejoin="round"/>' +
                '<g id="mochiHaunch"><path d="M10.5,-19.1 A17,14 0 0 1 2,7 A17,14 0 0 1 -12.7,0" fill="none" stroke="' + OUT + '" stroke-width="2.1" stroke-linecap="round"/><path d="M13.5,-10.5 Q18.5,-3 14.5,3.5" fill="none" stroke="' + OUT + '" stroke-width="1.2" stroke-linecap="round" opacity=".3"/></g>' +
                '<g id="mochiHead">' +
                    '<g id="mochiEarL"><path d="M-13.5,-6 L-11.5,-25 L-2,-14 Z" fill="' + BASE + '" stroke="' + OUT + '" stroke-width="2" stroke-linejoin="round"/><path d="M-11.2,-9 L-10.4,-20.5 L-5,-13.5 Z" fill="' + INNER + '"/></g>' +
                    '<g id="mochiEarR"><path d="M4.5,-14.5 L14,-25 L16,-5.5 Z" fill="' + COCOA + '" stroke="' + OUT + '" stroke-width="2" stroke-linejoin="round"/><path d="M7.5,-13.5 L12.8,-20.5 L13.6,-9 Z" fill="' + INNER + '"/></g>' +
                    '<path d="M-16,1 C-16,-10 -8,-15.5 1,-15.5 C10,-15.5 17,-10 17,0 C17,8 10,12.5 1,12.5 C-8,12.5 -16,9 -16,1 Z" fill="' + BASE + '"/>' +
                    '<g clip-path="url(#mochiHeadClip)">' +
                        '<ellipse cx="-10" cy="-10" rx="10" ry="8.5" fill="' + ORANGE + '"/>' +
                        '<ellipse cx="12" cy="-12" rx="7.5" ry="6" fill="' + COCOA + '"/>' +
                    '</g>' +
                    '<path d="M-16,1 C-16,-10 -8,-15.5 1,-15.5 C10,-15.5 17,-10 17,0 C17,8 10,12.5 1,12.5 C-8,12.5 -16,9 -16,1 Z" fill="none" stroke="' + OUT + '" stroke-width="2.1"/>' +
                    '<path d="M-15.6,4 l-3,1.4 l3.2,.8 M16.6,3.6 l3,1.2 l-3.1,1" fill="none" stroke="' + OUT + '" stroke-width="1.4" stroke-linejoin="round"/>' +
                    '<ellipse id="mochiBlushL" cx="-9" cy="5" rx="3.2" ry="1.9" fill="' + PINK + '" opacity="0"/>' +
                    '<ellipse id="mochiBlushR" cx="13" cy="5" rx="3" ry="1.8" fill="' + PINK + '" opacity="0"/>' +
                    '<g transform="translate(-4,-1)">' + eyeMarkup('mochiEyeL') + '</g>' +
                    '<g transform="translate(8.5,-1)">' + eyeMarkup('mochiEyeR') + '</g>' +
                    '<path id="mochiBrows" d="M-7,-6.2 L-1.4,-4.6 M11.6,-6.2 L6,-4.6" stroke="#26212a" stroke-width="1.4" stroke-linecap="round" opacity="0"/>' +
                    '<path d="M1.6,3.3 L4.6,3.3 L3.1,5 Z" fill="' + PINK + '" stroke="' + PINK + '" stroke-width=".9" stroke-linejoin="round"/>' +
                    '<path id="mochiMouth" d="M.2,6.2 Q1.65,8.1 3.1,6.2 Q4.55,8.1 6,6.2" fill="none" stroke="#26212a" stroke-width="1.2" stroke-linecap="round"/>' +
                    '<g id="mochiMouthOpen" opacity="0"><ellipse cx="3.1" cy="7.6" rx="2.3" ry="2.6" fill="#7a2f45"/><ellipse cx="3.1" cy="8.9" rx="1.5" ry="1.1" fill="' + PINK + '"/></g>' +
                    '<ellipse id="mochiTongue" cx="3.1" cy="8.2" rx="1.4" ry="1.6" fill="' + PINK + '" opacity="0"/>' +
                    '<path d="M-8,5.2 L-20,3.4 M-8,7 L-19.5,8.4 M13.5,5.2 L25,3.4 M13.5,7 L24.5,8.4" stroke="' + OUT + '" stroke-width=".7" stroke-linecap="round" opacity=".55"/>' +
                '</g>' +
            '</g>' +
            '<g id="mochiFrontLegs"></g>' +
            '<ellipse class="mochi-hit" id="mochiHit" cx="6" cy="-34" rx="54" ry="32" fill="transparent"/>' +
        '</g></g>' +
        '</svg>';

    var nameTag = document.createElement('div');
    nameTag.className = 'mochi-name';
    var bubble = document.createElement('div');
    bubble.className = 'mochi-bubble';
    layer.appendChild(shadow);
    layer.appendChild(holder);
    layer.appendChild(nameTag);
    layer.appendChild(bubble);

    var svg = holder.querySelector('svg');
    function $(id) { return svg.getElementById ? svg.getElementById(id) : svg.querySelector('#' + id); }
    var el = {
        flip: $('mochiFlip'), root: $('mochiRoot'), torso: $('mochiTorso'), body: $('mochiBody'), bodyLine: $('mochiBodyLine'),
        bodyClip: $('mochiBodyClipPath'), haunch: $('mochiHaunch'), haunchFill: $('mochiHaunchFill'), haunchClip: $('mochiHaunchClip'), head: $('mochiHead'), earL: $('mochiEarL'), earR: $('mochiEarR'),
        tail: $('mochiTail'), tailOut: $('mochiTailOut'), tailTip: $('mochiTailTip'), far: $('mochiFarLegs'), near: $('mochiNearLegs'), front: $('mochiFrontLegs'),
        blushL: $('mochiBlushL'), blushR: $('mochiBlushR'), brows: $('mochiBrows'), mouth: $('mochiMouth'), mouthOpen: $('mochiMouthOpen'),
        tongue: $('mochiTongue'), hit: $('mochiHit'), eyes: [$('mochiEyeL'), $('mochiEyeR')]
    };

    // Legs: upper + lower segment (back legs bend at the hock) and a round paw with little toes.
    function svgEl(tag, attrs, parent) {
        var n = document.createElementNS(SVGNS, tag);
        for (var a in attrs) n.setAttribute(a, attrs[a]);
        if (parent) parent.appendChild(n);
        return n;
    }
    function makeLeg(parent, fill, back) {
        var g = svgEl('g', {}, parent);
        var common = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
        var wU = back ? 8.6 : 7.6, wL = back ? 7.2 : 7.2;
        var o1 = svgEl('path', Object.assign({ stroke: OUT, 'stroke-width': wU + 3.8 }, common), g);
        var o2 = svgEl('path', Object.assign({ stroke: OUT, 'stroke-width': wL + 3.8 }, common), g);
        var f1p = svgEl('path', Object.assign({ stroke: fill, 'stroke-width': wU }, common), g);
        var f2p = svgEl('path', Object.assign({ stroke: fill, 'stroke-width': wL }, common), g);
        var paw = svgEl('g', {}, g);
        svgEl('ellipse', { cx: 1.2, cy: 0, rx: 6, ry: 3.9, fill: fill, stroke: OUT, 'stroke-width': 1.9 }, paw);
        svgEl('path', { d: 'M2.1,-1.6 L2.1,.9 M4.4,-1.3 L4.4,.9', stroke: OUT, 'stroke-width': 1.05, 'stroke-linecap': 'round', opacity: 0.5, fill: 'none' }, paw);
        return { g: g, o1: o1, o2: o2, f1: f1p, f2: f2p, paw: paw, back: back, foot: null };
    }
    // order: backFar, frontFar (behind body), backNear, frontNear (in front)
    var legs = {
        bf: makeLeg(el.far, SHADE, true), ff: makeLeg(el.far, SHADE, false),
        bn: makeLeg(el.near, BASE, true), fn: makeLeg(el.near, BASE, false)
    };
    var eyeParts = el.eyes.map(function (g) {
        return { g: g, open: g.querySelector('.e-open'), happy: g.querySelector('.e-happy'), closed: g.querySelector('.e-closed'), angry: g.querySelector('.e-angry'), wide: g.querySelector('.e-wide') };
    });

    // ---------- world ----------
    var S = 1;
    var W = window.innerWidth, H = window.innerHeight;
    function measure() {
        W = window.innerWidth; H = window.innerHeight; floorCheckedAt = -99;
        S = W < 600 ? 0.74 : W < 1000 ? 0.88 : 1;
        svg.setAttribute('width', VB.w * S);
        svg.setAttribute('height', VB.h * S);
    }
    // On narrow screens the music player spans the bottom, so she walks along its top edge instead.
    var floorCache = 0, floorCheckedAt = -99;
    function floorY() {
        if (time - floorCheckedAt > 0.5 || !floorCache) {
            floorCheckedAt = time;
            floorCache = H - 6;
            var mp = document.getElementById('musicPlayer');
            if (mp && mp.classList.contains('visible')) {
                var r = mp.getBoundingClientRect();
                if (r.width > W * 0.6 && r.top > H * 0.5) floorCache = r.top - 3;
            }
        }
        return floorCache;
    }
    var MARGIN = 46;

    // ---------- perches: page elements she can land on and rest on ----------
    var PERCH_SEL = '.side-sticky-note, .egg-rare-note, .currently-card, .glow-card, .card.section, #musicPlayer, .navbar';
    var groundH = 0;              // height of whatever she's standing on, above the floor
    var perchBounds = [0, 0];
    var perchList = [], perchListAt = -99;
    var ignorePerch = { el: null, until: 0 };
    function perchOk(r) { return r.width >= 90 && r.height > 8 && r.top > 50 && r.top < floorY() - 40; }
    function perches() {
        if (time - perchListAt > 0.4) {
            perchListAt = time;
            perchList = Array.prototype.slice.call(document.querySelectorAll(PERCH_SEL)).filter(function (n) { return !layer.contains(n); });
        }
        return perchList;
    }
    function bounds() {
        return cat.plat ? perchBounds : [MARGIN, W - MARGIN];
    }
    function onGround() { return cat.y <= groundH + 0.5 && cat.vy <= 0; }
    function updateGround() {
        if (!cat.plat) { groundH = 0; return; }
        var r = cat.plat.getBoundingClientRect();
        if (!document.documentElement.contains(cat.plat) || r.width < 90) { leavePerch(false); return; }
        if (r.top >= floorY() - 40) { leavePerch(true); return; } // scrolled down under the floor line: she's on the floor now
        if (r.top < 4) { leavePerch(false); return; }            // its top scrolled off screen: she drops down
        groundH = floorY() - r.top;
        if (cat.vy <= 0 && cat.state !== 'held') cat.y = groundH; // ride along when the page scrolls
        var pad = 26 * S;
        perchBounds = [r.left + pad, Math.max(r.left + pad, r.right - pad)];
    }
    function leavePerch(toFloor) {
        cat.plat = null;
        groundH = 0;
        if (toFloor) { cat.y = 0; cat.vy = 0; }
    }
    function jump(vx, vy) {
        // any jump lets go of the perch; landing re-detects whatever is underneath
        cat.plat = null;
        cat.y = groundH + 0.6;
        groundH = 0;
        cat.vx = vx; cat.vy = vy;
    }
    function hopOff(dir) {
        var b = bounds();
        var edge = dir < 0 ? b[0] : b[1];
        var from = cat.plat;
        walkTo(edge, 58, function () {
            ignorePerch = { el: from, until: time + 0.9 };
            cat.dir = dir;
            jump(dir * 135, 250);
            setState('air', 0, { hop: true });
        });
    }

    // ---------- cat state ----------
    var cat = {
        x: -70, y: 0, vx: 0, vy: 0,
        dir: 1, flip: 1,
        state: 'walk', t: 0, dur: 0, data: {},
        target: 0, speed: 48,
        walkPhase: 0, walkAmt: 0,
        rootRot: 0, swing: 0, squash: 1,
        lookX: 0, lookY: 0, headRot: 0, headTgt: 0,
        blinkIn: 2, blinking: 0,
        earTwitch: 0, earTwitchIn: 3,
        awake: 0, lastPetHeart: 0,
        annoyCount: 0, lastAnnoy: -99,
        plat: null, platT: 0
    };
    // Smoothed pose parameters and their targets.
    var P = { sit: 0, lie: 0, arch: 0, crouch: 0, earFlat: 0, blush: 0, puff: 0, paw: 0, mouth: 0, tongue: 0, headDrop: 0,
        tailBase: 205, tailCurl: 26, tailAmp: 8, tailHook: 0 };
    var T = {};
    for (var k in P) T[k] = P[k];
    var tailSpeed = 3, eyeMode = 'open', purring = false;
    var time = 0;

    var mouse = { x: -1, y: -1, t: -99, inside: false };
    var pet = { level: 0, lastMove: -99, dist: 0, hovering: false, prevState: null };
    var drag = null; // pointer interaction in progress
    var toy = null;

    // ---------- state machine ----------
    function setState(name, dur, data) {
        if (name === 'sleep' && cat.state !== 'petted' && cat.state !== 'sleep' && typeof stats !== 'undefined') stats.naps++;
        if (cat.state === 'play' && name !== 'play') endToy(false);
        if (name !== 'paw') cat.pawScreen = null;
        cat.state = name;
        cat.t = 0;
        cat.dur = dur || 0;
        cat.data = data || {};
    }
    function walkTo(x, speed, then) {
        var b = bounds();
        cat.target = clamp(x, b[0], b[1]);
        cat.speed = speed || 48;
        setState('walk', 0, { then: then || null });
    }
    function chooseNext() {
        var mouseFresh = finePointer && mouse.inside && time - mouse.t < 3;
        var perched = !!cat.plat;
        var options = [
            ['walk', 26], ['sit', 16], ['groom', 12], ['sleep', 6 + Math.min(18, cat.awake / 6)],
            ['play', reducedMotion || perched ? 0 : 11], ['follow', mouseFresh ? 30 : 0], ['stretch', 4],
            ['hopdown', perched ? 6 + Math.min(30, cat.platT / 2) : 0],
            ['paw', 11]
        ];
        var total = 0, i;
        for (i = 0; i < options.length; i++) total += options[i][1];
        var r = Math.random() * total;
        for (i = 0; i < options.length; i++) { r -= options[i][1]; if (r <= 0) break; }
        var choice = options[Math.min(i, options.length - 1)][0];
        if (choice === 'walk') {
            var b = bounds();
            var dist = rand(120, Math.min(520, W * 0.6)) * (Math.random() < 0.5 ? -1 : 1);
            if (perched) dist = rand(40, Math.max(50, b[1] - b[0])) * (Math.random() < 0.5 ? -1 : 1);
            var tx = cat.x + dist;
            if (tx < b[0] || tx > b[1]) tx = cat.x - dist;
            tx = clamp(tx, b[0], b[1]);
            if (Math.abs(tx - cat.x) < 30) setState('sit', rand(3, 6));
            else walkTo(tx, !perched && Math.random() < 0.18 ? 105 : rand(40, 58));
        } else if (choice === 'paw') {
            if (!startPaw()) setState('sit', rand(3, 6));
        } else if (choice === 'hopdown') {
            var bb = bounds();
            hopOff(cat.x - bb[0] < bb[1] - cat.x ? -1 : 1);
        } else if (choice === 'sit') setState('sit', rand(4, 8));
        else if (choice === 'groom') setState('groom', rand(4.5, 7.5));
        else if (choice === 'sleep') setState('sleep', rand(16, 34));
        else if (choice === 'play') startPlay();
        else if (choice === 'follow') setState('follow', rand(12, 22));
        else setState('stretch', 1.9);
    }

    // ---------- speech, hearts, zzz ----------
    var bubbleTimer = 0;
    var sizes = { name: 90, bubble: 40 };
    function say(text, secs) {
        bubble.textContent = text;
        sizes.bubble = bubble.offsetWidth || sizes.bubble;
        bubble.classList.add('show');
        bubbleTimer = secs || 1.6;
    }
    function particle(cls, text, x, y, x1, y1, extra) {
        var p = document.createElement('span');
        p.className = cls;
        p.textContent = text;
        p.style.setProperty('--x0', x + 'px');
        p.style.setProperty('--y0', y + 'px');
        p.style.setProperty('--x1', x1 + 'px');
        p.style.setProperty('--y1', y1 + 'px');
        if (extra) for (var key in extra) p.style.setProperty(key, extra[key]);
        layer.appendChild(p);
        setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 2600);
        return p;
    }
    function heart(big) {
        stats.hearts++;
        var h = headScreen();
        var x = h.x + rand(-14, 10), y = h.y - 18 * S + rand(-6, 4);
        var p = particle('mochi-heart', '♥', x, y, x + rand(-30, 30), y - rand(45, 75), { '--r': rand(-25, 25) + 'deg' });
        p.style.fontSize = (big ? rand(17, 22) : rand(12, 17)) * S + 'px';
    }
    function zzz() {
        var h = headScreen();
        var x = h.x + 8 * S * cat.flip, y = h.y - 16 * S;
        particle('mochi-z', pick(['z', 'Z', 'z']), x, y, x + 26 * cat.flip + rand(-6, 6), y - 46);
    }

    // ---------- toy: a little flying heart ----------
    function startPlay() {
        if (toy) endToy(false);
        var node = document.createElement('div');
        node.className = 'mochi-toy';
        node.innerHTML = '<span class="w l"></span><span class="w r"></span><span class="h">♥</span>';
        layer.appendChild(node);
        var side = Math.random() < 0.5 ? -1 : 1;
        toy = { el: node, x: clamp(cat.x + side * rand(140, 260), 40, W - 40), h: rand(70, 140), vx: 0, vy: 0, wander: rand(0, 6), swats: 0, life: 0, caught: false };
        setState('play', rand(18, 26), { phase: 'chase', cool: 0 });
        say(pick(['!!', 'oh?', '♥?!', 'mrrp!', 'bwah!']), 1.2);
    }
    function endToy(caught) {
        if (!toy) return;
        if (caught) stats.caught++;
        var node = toy.el;
        var x = toy.x, y = floorY() - toy.h;
        if (caught) {
            for (var i = 0; i < 9; i++) {
                var a = i / 9 * Math.PI * 2;
                particle('mochi-pop', '♥', x, y, x + Math.cos(a) * 34, y + Math.sin(a) * 34);
            }
            if (node.parentNode) node.parentNode.removeChild(node);
        } else {
            node.style.transition = 'opacity .6s';
            node.style.opacity = '0';
            setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 700);
        }
        toy = null;
    }
    function updateToy(dt) {
        if (!toy) return;
        toy.life += dt;
        toy.wander += dt * 1.3;
        // Flutter: a wandering drift plus a little bob.
        var ax = Math.sin(toy.wander * 1.7) * 140 + Math.sin(toy.wander * 0.6) * 90;
        var ay = Math.cos(toy.wander * 2.3) * 90;
        // Gently keep away from the cat when she's close, so it's a chase.
        var away = toy.x - cat.x;
        if (Math.abs(away) < 90) ax += (away >= 0 ? 1 : -1) * 160;
        toy.vx = approach(toy.vx, toy.vx + ax * dt, 6, dt);
        toy.vy = approach(toy.vy, toy.vy + ay * dt, 6, dt);
        toy.vx = clamp(toy.vx * Math.pow(0.35, dt), -150, 150);
        toy.vy = clamp(toy.vy * Math.pow(0.35, dt), -110, 110);
        toy.x += toy.vx * dt;
        toy.h += toy.vy * dt;
        if (toy.x < 30) { toy.x = 30; toy.vx = Math.abs(toy.vx); }
        if (toy.x > W - 30) { toy.x = W - 30; toy.vx = -Math.abs(toy.vx); }
        toy.h = clamp(toy.h, 48, 165);
        toy.el.style.transform = 'translate(' + f1(toy.x - 13) + 'px,' + f1(floorY() - toy.h - 11 + Math.sin(time * 9) * 2) + 'px)';
    }

    // ---------- pawing at stuff ----------
    var PAW_SEL = '.glow-card, .card.section, .currently-card, .side-sticky-note, .egg-rare-note, #musicPlayer';
    function groundScreenY() { return floorY() - groundH; }
    function findPawTarget() {
        var gy = groundScreenY(), lo = gy - 58 * S, hi = gy - 12 * S;
        var b = bounds(), best = null;
        var nodes = document.querySelectorAll(PAW_SEL);
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (layer.contains(n) || n === cat.plat) continue;
            var r = n.getBoundingClientRect();
            if (r.width < 30 || r.height < 12) continue;
            var top = Math.max(r.top, lo), bot = Math.min(r.bottom, hi);
            if (top >= bot) continue; // nothing of it at paw height
            [[r.left, -1], [r.right, 1]].forEach(function (edge) {
                var ex = edge[0], outside = edge[1]; // she stands outside the element, on this side
                var stand = ex + outside * 30 * S;
                if (stand < b[0] || stand > b[1] || ex < 20 || ex > W - 20) return;
                var dist = Math.abs(stand - cat.x);
                if (dist > 460) return;
                if (!best || dist < best.dist) best = { el: n, x: ex, y: clamp((top + bot) / 2, gy - 46 * S, gy - 16 * S), stand: stand, face: -outside, dist: dist };
            });
        }
        return best;
    }
    function startPaw() {
        if (!onGround()) return false;
        if (cat.plat && Math.random() < 0.6) {
            // pat the thing she's sitting on
            setState('paw', rand(2, 3.2), { kind: 'perch', el: cat.plat, phase: 'bat' });
            return true;
        }
        var t = findPawTarget();
        if (!t) return false;
        setState('paw', rand(2.2, 3.6), { kind: 'edge', el: t.el, tx: t.x, ty: t.y, stand: t.stand, face: t.face, phase: 'approach' });
        return true;
    }
    function swatAtMouse() {
        setState('paw', rand(1, 1.8), { kind: 'mouse', phase: 'bat' });
    }
    function bump(n, dx, dy) {
        if (!n || typeof n.animate !== 'function') return;
        try {
            n.animate([
                { transform: 'translate(0,0)' },
                { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
                { transform: 'translate(' + (-dx * 0.4) + 'px,' + (-dy * 0.4) + 'px)' },
                { transform: 'translate(0,0)' }
            ], { duration: 260, easing: 'ease-out', composite: 'add' });
        } catch (e) {}
    }

    // ---------- interaction ----------
    function headScreen() { return toScreen(cat._headCat || { x: 30, y: -50 }); }
    function annoy() {
        stats.annoyed++;
        var now = time;
        cat.annoyCount = now - cat.lastAnnoy < 6 ? cat.annoyCount + 1 : 1;
        cat.lastAnnoy = now;
        var wasAsleep = cat.state === 'sleep' || cat.state === 'petted' && pet.prevState === 'sleep';
        var lines = wasAsleep ? ['!!', 'HUH', 'i was sleeping >:('] :
            cat.annoyCount >= 4 ? ['ok im leaving', 'BYE.', 'unbelievable'] :
            cat.annoyCount >= 2 ? ['HSS!', 'stop it', 'mrrrow!!', '>:('] : ['hmph!', 'hss!', 'rude.', 'mrow!', '>:c'];
        say(pick(lines), 1.6);
        var away = mouse.x >= 0 ? (cat.x >= mouse.x ? 1 : -1) : -cat.dir;
        cat.dir = -away; // face the poker while hissing
        if (onGround()) jump(away * (wasAsleep ? 90 : 130), wasAsleep ? 380 : 260);
        setState('annoyed', wasAsleep ? 1.3 : 1.15, { away: away, leave: cat.annoyCount >= 4 });
    }
    function startPet() {
        if (cat.state === 'held' || cat.state === 'air' || cat.state === 'annoyed' || cat.state === 'land') return;
        if (cat.state !== 'petted') {
            pet.prevState = cat.state === 'sleep' ? 'sleep' : (P.sit > 0.5 || cat.state === 'groom') ? 'sit' : 'stand';
            setState('petted', 0);
            say(pick(['prrr', 'purr', 'prrrrr ♥', 'mrrr', ':3', 'bwah']), 1.4);
        }
    }
    function petMove(dx, dy) {
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.5) return;
        pet.lastMove = time;
        pet.level = clamp(pet.level + d * 0.012, 0, 1);
        pet.dist += d;
        if (pet.level > 0.15) startPet();
        if (cat.state === 'petted' && pet.dist > 46) {
            pet.dist = 0;
            heart(pet.level > 0.8);
        }
    }

    function pointerToCat(e) { return { x: e.clientX, y: e.clientY }; }
    el.hit.addEventListener('pointerenter', function (e) { pet.hovering = true; mouse.x = e.clientX; mouse.y = e.clientY; });
    el.hit.addEventListener('pointerleave', function () { pet.hovering = false; });
    el.hit.addEventListener('pointermove', function (e) {
        if (drag) return; // handled by the captured listener below
        if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
            if (!e.buttons) petMove(e.movementX || 0, e.movementY || 0);
        }
    });
    el.hit.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        e.preventDefault();
        try { el.hit.setPointerCapture(e.pointerId); } catch (err) {}
        var p = pointerToCat(e);
        drag = { id: e.pointerId, type: e.pointerType, sx: p.x, sy: p.y, x: p.x, y: p.y, t0: time, moved: 0, held: false, rub: false, samples: [{ x: p.x, y: p.y, t: time }] };
        if (e.pointerType === 'touch') {
            drag.rubTimer = setTimeout(function () { if (drag && !drag.held) { drag.rub = true; startPet(); heart(); } }, 380);
        }
    });
    el.hit.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var p = pointerToCat(e);
        var dx = p.x - drag.x, dy = p.y - drag.y;
        drag.x = p.x; drag.y = p.y;
        mouse.x = p.x; mouse.y = p.y; mouse.t = time;
        drag.moved = Math.max(drag.moved, Math.hypot(p.x - drag.sx, p.y - drag.sy));
        drag.samples.push({ x: p.x, y: p.y, t: time });
        while (drag.samples.length > 2 && time - drag.samples[0].t > 0.12) drag.samples.shift();
        if (drag.rub) { petMove(dx, dy); return; }
        if (!drag.held && drag.moved > (drag.type === 'touch' ? 10 : 6)) startHold();
    });
    function finishPointer(e, cancelled) {
        if (!drag || e.pointerId !== drag.id) return;
        clearTimeout(drag.rubTimer);
        try { el.hit.releasePointerCapture(e.pointerId); } catch (err) {}
        var d = drag;
        drag = null;
        if (d.held) { release(d); return; }
        if (d.rub) { pet.lastMove = time - 0.2; return; }
        if (!cancelled && time - d.t0 < 0.45 && d.moved < 6) {
            if (d.type === 'touch' && !tipsSeen) { nameShowFor = 6; openTips(); }
            else annoy();
        }
    }
    el.hit.addEventListener('pointerup', function (e) { finishPointer(e, false); });
    el.hit.addEventListener('pointercancel', function (e) { finishPointer(e, true); });

    function startHold() {
        stats.pickups++;
        drag.held = true;
        cat.plat = null; groundH = 0;
        pet.level = 0;
        if (cat.state === 'play') endToy(false);
        setState('held', 0, { wideFor: 0.7 });
        say(pick(['mew?', 'mrrp?!', 'wheee', 'hey!', '?!', 'bwah?!']), 1.2);
    }
    function release(d) {
        var s = d.samples, a = s[0], b = s[s.length - 1];
        var span = Math.max(0.016, b.t - a.t);
        cat.vx = clamp((b.x - a.x) / span, -1500, 1500);
        cat.vy = clamp(-(b.y - a.y) / span, -1500, 1500);
        if (Math.abs(cat.vx) > 40) cat.dir = cat.vx > 0 ? 1 : -1;
        if (Math.hypot(cat.vx, cat.vy) > 650) stats.throws++;
        setState('air', 0, { fromHeight: cat.y });
    }

    document.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = time; mouse.inside = true;
    }, { passive: true });
    document.addEventListener('mouseleave', function () { mouse.inside = false; });

    // ---------- press S: your stats with her ----------
    document.addEventListener('keydown', function (e) {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        if ((e.key || '').toLowerCase() !== 's') return;
        var t = e.target;
        if (t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
        if (!layer.parentNode) return;
        openStats();
    });
    function snuggle() {
        if (cat.state === 'held' || cat.state === 'air' || cat.state === 'land' || !onGround()) return;
        if (cat.state === 'sleep' || cat.state === 'snuggle' || (cat.state === 'petted' && pet.prevState === 'sleep')) { say(pick(['zzz', '*already asleep*', 'mrrm...']), 1.2); return; }
        say(pick(['*snuggles*', 'mrrm...', 'nap time', '*yawn*']), 1.6);
        setState('snuggle', 2.6, {});
    }

    // ---------- naming ----------
    function renderName() {
        nameTag.innerHTML = '';
        var n = document.createElement('span');
        n.textContent = catName;
        var h = document.createElement('span');
        h.className = 'mochi-heartsym';
        h.textContent = '♥';
        var e = document.createElement('span');
        e.className = 'mochi-edit';
        e.textContent = '✎ rename';
        var q = document.createElement('span');
        q.className = 'mochi-help' + (tipsSeen ? '' : ' nudge');
        q.textContent = '?';
        q.title = 'how to play with ' + catName;
        nameTag.appendChild(n); nameTag.appendChild(h); nameTag.appendChild(e); nameTag.appendChild(q);
        sizes.name = nameTag.offsetWidth || sizes.name;
    }
    var nameEditing = false, nameShowFor = 0;
    nameTag.addEventListener('click', function (ev) {
        if (nameEditing) return;
        if (ev.target.closest && ev.target.closest('.mochi-help')) { openTips(); return; }
        startRename();
    });
    function startRename() {
        if (nameEditing) return;
        nameEditing = true;
        nameShowFor = 3;
        nameTag.innerHTML = '';
        var input = document.createElement('input');
        input.maxLength = 18;
        input.value = catName;
        input.setAttribute('aria-label', 'Name the cat');
        nameTag.appendChild(input);
        sizes.name = nameTag.offsetWidth || sizes.name;
        input.focus();
        input.select();
        var done = false;
        function finish(save) {
            if (done) return;
            done = true;
            nameEditing = false;
            var v = input.value.replace(/\s+/g, ' ').trim().slice(0, 18);
            if (save && v && v !== catName) {
                catName = v;
                storageSet(NAME_KEY, v);
                say(pick(['mrrp! ', 'ok im ', 'call me ']) + v + (Math.random() < 0.5 ? ' now' : ' ♥'), 2.2);
                for (var i = 0; i < 4; i++) setTimeout(heart, i * 120);
            }
            renderName();
            nameShowFor = 2.5;
        }
        input.addEventListener('keydown', function (ev) {
            ev.stopPropagation();
            if (ev.key === 'Enter') finish(true);
            else if (ev.key === 'Escape') finish(false);
        });
        input.addEventListener('blur', function () { finish(true); });
    }
    nameTag.addEventListener('pointerenter', function () { nameShowFor = Math.max(nameShowFor, 1.5); });

    // ---------- panels: tips (how to play) and stats (your time together) ----------
    var TIPS_KEY = 'pixelyTipsSeen';
    var tipsSeen = storageGet(TIPS_KEY) === '1';
    var tips = null, panelKind = null, statRows = null, statsDrawnAt = -99;

    // stats live in this browser only
    var STATS_KEY = 'pixieStats';
    var stats = { withMs: 0, petMs: 0, hearts: 0, annoyed: 0, pickups: 0, heldMs: 0, throws: 0, naps: 0, caught: 0, perches: 0, since: 0 };
    (function () {
        try {
            var s = JSON.parse(storageGet(STATS_KEY) || 'null');
            if (s && typeof s === 'object') for (var k in stats) if (typeof s[k] === 'number' && isFinite(s[k])) stats[k] = s[k];
        } catch (e) {}
        if (!stats.since) stats.since = Date.now();
    })();
    var statsSavedAt = 0;
    function saveStats(force) {
        if (!force && time - statsSavedAt < 5) return;
        statsSavedAt = time;
        storageSet(STATS_KEY, JSON.stringify(stats));
    }
    function fmtDur(ms) {
        var sec = Math.floor(ms / 1000);
        if (sec < 60) return sec + ' s';
        var min = Math.floor(sec / 60);
        if (min < 60) return min + ' min';
        var h = Math.floor(min / 60);
        return h + ' h ' + (min % 60) + ' min';
    }
    function statList() {
        var d = new Date(stats.since);
        var since = isNaN(d) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
        return [
            ['time with ' + catName, fmtDur(stats.withMs)],
            ['time petting her', fmtDur(stats.petMs)],
            ['hearts given', String(stats.hearts)],
            ['times annoyed', String(stats.annoyed)],
            ['times picked up', String(stats.pickups)],
            ['time carried', fmtDur(stats.heldMs)],
            ['times thrown', String(stats.throws)],
            ['naps taken', String(stats.naps)],
            ['hearts caught', String(stats.caught)],
            ['things she landed on', String(stats.perches)],
            ['friends since', since]
        ];
    }

    function tipItems() {
        var touch = !finePointer;
        return touch ? [
            ['♥', 'pet her', 'hold your finger on her for a moment, then rub gently. she purrs and makes hearts'],
            ['✋', 'pick her up', 'press and drag straight away. let go to drop her, or flick to toss her. she can land on cards & the sticky note'],
            ['!', 'tap her', 'a quick tap pokes her. she gets grumpy and stomps off'],
            ['z', 'nap time', 'hit "nap" below and she snuggles in and sleeps'],
            ['#', 'stats', 'hit "stats" below to see your time together'],
            ['✎', 'rename her', 'tap her name tag. she remembers it on this device']
        ] : [
            ['♥', 'pet her', 'move your mouse back and forth over her. she arches, purrs and makes hearts'],
            ['✋', 'pick her up', 'click and drag. let go to drop her, or fling her. she can land on cards & the sticky note'],
            ['!', 'click her', 'a click pokes her. she gets grumpy and stomps off'],
            ['S', 'press S', 'see your stats with her: time together, pets, pokes and more'],
            ['z', 'nap time', 'hit "nap" below and she snuggles in and sleeps'],
            ['➜', 'hang around', 'when she\'s bored she follows your mouse'],
            ['✎', 'rename her', 'click her name tag. she remembers it in this browser']
        ];
    }
    function newPanel(kind, label, title) {
        if (tips) { var was = panelKind; closeTips(); if (was === kind) return null; }
        tips = document.createElement('div');
        tips.className = 'mochi-tips';
        tips.setAttribute('role', 'dialog');
        tips.setAttribute('aria-label', label);
        panelKind = kind;
        var h = document.createElement('h3');
        h.textContent = title;
        tips.appendChild(h);
        return tips;
    }
    function finishPanel(buttons) {
        var row = document.createElement('div'); row.className = 'row';
        buttons.forEach(function (b) {
            var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = b[0];
            btn.addEventListener('click', b[1]);
            row.appendChild(btn);
        });
        tips.appendChild(row);
        var x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', 'Close');
        x.addEventListener('click', closeTips);
        tips.appendChild(x);
        layer.appendChild(tips);
        sizes.tipsW = tips.offsetWidth; sizes.tipsH = tips.offsetHeight;
        var mine = tips;
        requestAnimationFrame(function () { if (tips === mine) mine.classList.add('show'); });
        // she sits and listens while you read
        if (onGround() && cat.state !== 'sleep' && cat.state !== 'snuggle' && cat.state !== 'petted') { setState('sit', 9999); say(pick(['mrrp?', ':3', 'hi!', 'bwah']), 1.2); }
    }
    var napBtn = ['nap', function () { closeTips(); snuggle(); }];
    var renameBtn = ['rename', function () { closeTips(); nameShowFor = 4; startRename(); }];
    var statsBtn = ['stats', function () { openStats(); }];
    var tipsBtn = ['tips', function () { openTips(); }];

    function openTips() {
        if (!newPanel('tips', 'How to play with ' + catName, '[how to ' + catName.toLowerCase() + ']')) return;
        tipsSeen = true;
        storageSet(TIPS_KEY, '1');
        renderName();
        var ul = document.createElement('ul');
        tipItems().forEach(function (t) {
            var li = document.createElement('li');
            li.style.display = 'block'; // text only, no icon column
            var tx = document.createElement('span');
            var b = document.createElement('b'); b.textContent = t[1];
            var d = document.createElement('span'); d.className = 'd'; d.textContent = ' — ' + t[2];
            tx.appendChild(b); tx.appendChild(d);
            li.appendChild(tx);
            ul.appendChild(li);
        });
        tips.appendChild(ul);
        finishPanel([napBtn, statsBtn, renameBtn]);
    }
    function openStats() {
        if (!newPanel('stats', 'Your stats with ' + catName, '[you & ' + catName.toLowerCase() + ']')) return;
        var ul = document.createElement('ul');
        ul.className = 'mochi-stats';
        statRows = [];
        statList().forEach(function (row) {
            var li = document.createElement('li');
            var k = document.createElement('span'); k.className = 'd'; k.textContent = row[0];
            var v = document.createElement('b'); v.textContent = row[1];
            li.appendChild(k); li.appendChild(v);
            ul.appendChild(li);
            statRows.push(v);
        });
        tips.appendChild(ul);
        statsDrawnAt = time;
        finishPanel([napBtn, tipsBtn]);
    }
    function refreshStats() {
        if (panelKind !== 'stats' || !statRows || time - statsDrawnAt < 0.5) return;
        statsDrawnAt = time;
        statList().forEach(function (row, i) { if (statRows[i] && statRows[i].textContent !== row[1]) statRows[i].textContent = row[1]; });
    }
    function closeTips() {
        if (!tips) return;
        var t = tips;
        tips = null; panelKind = null; statRows = null;
        t.classList.remove('show');
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
        if (cat.state === 'sit' && cat.dur > 999) cat.dur = cat.t + 1.5;
    }
    document.addEventListener('pointerdown', function (e) {
        if (tips && !tips.contains(e.target) && !nameTag.contains(e.target)) closeTips();
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tips) closeTips(); });
    renderName();

    // ---------- per-state behaviour ----------
    function cursorInReach() {
        if (mouse.x < 0 || !onGround()) return false;
        var h = headScreen();
        var dx = Math.abs(mouse.x - h.x), dy = mouse.y - h.y;
        return dx < 70 * S && dy > -70 * S && dy < 30 * S;
    }
    function lookAtMouse(maxUp) {
        if (mouse.x < 0) return false;
        var h = headScreen();
        var dx = (mouse.x - h.x) * cat.flip, dy = mouse.y - h.y;
        var dist = Math.hypot(dx, dy) || 1;
        cat.lookX = clamp(dx / dist * 1.3, -1.3, 1.3);
        cat.lookY = clamp(dy / dist * 1.3, -1.3, 1.3);
        var ang = Math.atan2(dy, Math.abs(dx)) / DEG; // negative = above
        cat.headTgt = clamp(ang * 0.35, -(maxUp || 22), 16);
        return true;
    }
    function defaultsStanding() {
        T.sit = 0; T.lie = 0; T.arch = 0; T.crouch = 0; T.earFlat = 0; T.blush = 0; T.puff = 0; T.paw = 0; T.mouth = 0; T.tongue = 0; T.headDrop = 0;
        T.tailBase = 208; T.tailCurl = 26; T.tailAmp = 7; T.tailHook = 0; tailSpeed = 2.6;
        eyeMode = 'open'; purring = false;
    }
    function defaultsSitting() {
        defaultsStanding();
        T.sit = 1;
        T.tailBase = 186; T.tailCurl = -46; T.tailAmp = 5; tailSpeed = 1.6;
    }
    function moveToward(target, speed, dt) {
        if (cat.x > 0) { var b = bounds(); target = clamp(target, b[0], b[1]); }
        var dx = target - cat.x;
        if (Math.abs(dx) < 3) return true;
        cat.dir = dx > 0 ? 1 : -1;
        // ease in/out a little so starting/stopping isn't robotic
        var sp = speed * clamp(Math.abs(dx) / 40, 0.35, 1) * clamp(cat.walkAmt * 1.6 + 0.25, 0, 1);
        cat.x += cat.dir * Math.min(Math.abs(dx), sp * dt);
        cat.walkPhase += dt * sp * 0.175;
        return false;
    }

    function updateState(dt) {
        cat.t += dt;
        var st = cat.state, d = cat.data;
        var walking = false;

        if (st === 'walk') {
            defaultsStanding();
            if (cat.speed > 90) { T.tailBase = 200; T.tailCurl = 12; T.tailAmp = 4; T.earFlat = 0.15; }
            walking = true;
            if (moveToward(cat.target, cat.speed, dt)) {
                if (d.then) d.then(); else setState('sit', rand(1.5, 3.5));
            }
            cat.headTgt = Math.sin(time * 0.8) * 4;
            cat.lookX = 0.6; cat.lookY = 0;
        } else if (st === 'sit') {
            defaultsSitting();
            if (!d.next || time > d.next) {
                d.next = time + rand(1.2, 3);
                d.head = rand(-14, 10);
                d.lx = rand(-1, 1.2); d.ly = rand(-0.8, 0.6);
                if (Math.random() < 0.25) cat.dir = -cat.dir;
                if (Math.random() < 0.07 && bubbleTimer <= 0) say(pick(['bwah', 'bwah', 'mrrp', 'mew', ':3']), 1.4);
            }
            if (finePointer && mouse.inside && !pet.hovering && cursorInReach() && Math.random() < dt * 0.35) { swatAtMouse(); return; }
            if (!(finePointer && mouse.inside && time - mouse.t < 2 && lookAtMouse())) {
                cat.headTgt = d.head; cat.lookX = d.lx; cat.lookY = d.ly;
            }
            if (cat.t > cat.dur) chooseNext();
        } else if (st === 'follow') {
            var fresh = mouse.inside && time - mouse.t < 6;
            if (!fresh || (cat.t > cat.dur && !d.walking)) { setState('sit', rand(2, 4)); return; }
            if (cat.plat && onGround()) {
                var pb = bounds();
                if (mouse.x < pb[0] - 50 || mouse.x > pb[1] + 50) { hopOff(mouse.x < cat.x ? -1 : 1); return; }
            }
            var dx = mouse.x - cat.x;
            var far = Math.abs(dx) > 80;
            if (far || (d.walking && Math.abs(dx) > 34)) {
                defaultsStanding();
                d.walking = true;
                walking = true;
                moveToward(mouse.x - (dx > 0 ? 30 : -30), Math.abs(dx) > 420 ? 115 : 62, dt);
                lookAtMouse();
            } else {
                d.walking = false;
                defaultsSitting();
                cat.dir = dx >= 0 ? 1 : -1;
                lookAtMouse(26);
                T.tailAmp = 9; tailSpeed = 2.4;
                if (!pet.hovering && cursorInReach() && Math.random() < dt * 0.5) { swatAtMouse(); return; }
            }
        } else if (st === 'groom') {
            defaultsSitting();
            var g = cat.t;
            var lick = Math.max(0, Math.sin(g * 8));
            if (g < cat.dur * 0.55) {
                // lick the paw
                T.paw = 1; cat.headTgt = 12 + lick * 7; eyeMode = 'happy'; T.tongue = lick > 0.4 ? 1 : 0;
            } else {
                // wipe the face with the paw
                T.paw = 0.75 + Math.sin(g * 5) * 0.25; cat.headTgt = 6 + Math.sin(g * 5) * 8; eyeMode = 'closed'; T.tongue = 0;
            }
            cat.lookX = 0.4; cat.lookY = 0.6;
            if (cat.t > cat.dur) setState('sit', rand(1.5, 3));
        } else if (st === 'sleep') {
            defaultsSitting();
            var settle = clamp(cat.t / 1.2, 0, 1);
            T.sit = 1 - settle; T.lie = settle;
            T.tailBase = 172; T.tailCurl = -48; T.tailAmp = 1.5; tailSpeed = 0.6;
            T.headDrop = settle;
            cat.headTgt = 12 * settle;
            eyeMode = settle > 0.6 ? 'closed' : 'happy';
            if (cat.t > 2 && (!d.z || time > d.z)) { d.z = time + 1.7; zzz(); }
            if (cat.t > cat.dur) { cat.awake = 0; setState('stretch', 2.1, { wake: true }); }
        } else if (st === 'paw') {
            if (d.phase === 'approach') {
                defaultsStanding();
                walking = true;
                if (moveToward(d.stand, 60, dt) || cat.t > 6) { d.phase = 'bat'; cat.t = 0; }
            } else {
                if (d.kind === 'mouse') { defaultsSitting(); lookAtMouse(26); }
                else { defaultsStanding(); T.crouch = d.kind === 'perch' ? 0.45 : 0.2; }
                T.tailBase = 214; T.tailCurl = 16; T.tailAmp = 9; tailSpeed = 7; T.earFlat = 0;
                // aim
                if (d.kind === 'edge') { cat.dir = d.face; cat.pawScreen = { x: d.tx, y: d.ty }; }
                else if (d.kind === 'perch') { cat.pawScreen = { x: cat.x + cat.dir * 44 * S, y: groundScreenY() + 2 }; }
                else { if (mouse.x >= 0) { cat.dir = mouse.x >= cat.x ? 1 : -1; cat.pawScreen = { x: mouse.x, y: mouse.y }; } }
                if (d.kind !== 'mouse') { var hsp = headScreen(); cat.lookX = 1.2; cat.lookY = clamp((cat.pawScreen.y - hsp.y) / 30, -1, 1.3); cat.headTgt = d.kind === 'perch' ? 16 : 6; }
                eyeMode = 'open';
                // bap bap bap: quick taps
                var ph = cat.t * 10.5;
                T.paw = 0.3 + 0.7 * Math.max(0, Math.sin(ph));
                var cyc = Math.floor((ph - Math.PI / 2) / (Math.PI * 2));
                if (d.cyc === undefined) d.cyc = cyc;
                if (cyc !== d.cyc) {
                    d.cyc = cyc;
                    if (d.kind === 'edge') bump(d.el, d.face * 3, 0);
                    else if (d.kind === 'perch') bump(d.el, 0, 2);
                    d.taps = (d.taps || 0) + 1;
                    if (d.taps === 2 && Math.random() < 0.55) say(pick(['bap!', 'pat pat', '*bap*', 'bwah', 'boop']), 1.1);
                }
                if (cat.t > cat.dur) { cat.pawScreen = null; setState('sit', rand(1.5, 3)); }
            }
        } else if (st === 'snuggle') {
            var u = cat.t;
            if (u < 1.15) {
                // tread around in a little circle
                defaultsStanding();
                T.tailBase = 225; T.tailCurl = 18; T.tailAmp = 6;
                walking = true;
                cat.walkPhase += dt * 9;
                if (!d.turns) d.turns = 0;
                if (u > 0.3 + d.turns * 0.38 && d.turns < 2) { cat.dir = -cat.dir; d.turns++; }
                eyeMode = 'open';
            } else if (u < 2.6) {
                // knead the spot, purring
                defaultsSitting();
                T.sit = 0.35; T.crouch = 0.25;
                T.tailBase = 190; T.tailCurl = -30; T.tailAmp = 3;
                eyeMode = 'happy'; T.blush = 0.6; purring = true;
                d.kneading = true;
                cat.headTgt = 8;
            } else {
                d.kneading = false;
                setState('sleep', rand(28, 45));
            }
        } else if (st === 'stretch') {
            defaultsStanding();
            var s = cat.t / cat.dur;
            T.arch = s < 0.8 ? 1 : 0;
            T.crouch = s < 0.8 ? 0.15 : 0;
            T.tailBase = 240; T.tailCurl = 10; T.tailAmp = 3;
            eyeMode = 'closed';
            T.mouth = s > 0.15 && s < 0.6 ? 1 : 0; // yawn
            cat.headTgt = -10;
            if (cat.t > cat.dur) { if (d.wake) say(pick(['*yawn*', 'mrrm', 'hi :3', 'bwah...']), 1.3); setState('sit', rand(1.5, 3)); }
        } else if (st === 'play') {
            updatePlay(dt);
            walking = cat.data.phase === 'chase' && onGround();
        } else if (st === 'petted') {
            var since = time - pet.lastMove;
            var prev = pet.prevState;
            if (prev === 'sleep') {
                defaultsSitting(); T.sit = 0; T.lie = 1; T.headDrop = 0.6; cat.headTgt = 4;
                T.tailBase = 172; T.tailCurl = -40; T.tailAmp = 4; tailSpeed = 1.4;
            } else if (prev === 'sit') {
                defaultsSitting();
                cat.headTgt = -14 + Math.sin(time * 2.4) * 5; // lean head up into the hand
                T.tailBase = 230; T.tailCurl = 6; T.tailHook = 26; T.tailAmp = 5;
            } else {
                defaultsStanding();
                T.arch = 0.45 + pet.level * 0.35; T.crouch = 0;
                cat.headTgt = -8 + Math.sin(time * 2.4) * 4;
                T.tailBase = 248; T.tailCurl = 4; T.tailHook = 30; T.tailAmp = 4; tailSpeed = 2;
            }
            eyeMode = 'happy'; T.blush = 1; purring = true;
            if (since > 1.2) {
                purring = false;
                if (prev === 'sleep') setState('sleep', rand(10, 22));
                else { setState('sit', rand(2, 4)); if (Math.random() < 0.5) say(pick(['more?', 'mrrp', ':3', '♥', 'bwah']), 1.2); }
            }
        } else if (st === 'annoyed') {
            defaultsStanding();
            T.earFlat = 1; T.puff = 1; T.crouch = 0.55; T.arch = 0.25; eyeMode = 'angry';
            T.tailBase = 222; T.tailCurl = 14; T.tailAmp = 22; tailSpeed = 13;
            T.mouth = cat.t < 0.7 ? 1 : 0;
            if (cat.t > cat.dur && onGround()) {
                if (cat.plat && (d.leave || Math.random() < 0.5)) { hopOff(d.away); return; }
                var dist = d.leave ? W : rand(180, 360);
                walkTo(cat.x + d.away * dist, d.leave ? 125 : 95, function () { setState('sit', rand(2, 4)); cat.dir = -cat.dir; say(pick(['hmph.', '...', '>:|']), 1.2); });
            }
        } else if (st === 'held') {
            defaultsStanding();
            var wide = cat.t < (d.wideFor || 0);
            eyeMode = wide ? 'wide' : 'open';
            if (!wide && cat.t > 1.6) { eyeMode = pet.hovering ? 'happy' : 'open'; }
            T.earFlat = wide ? 0.35 : 0.1;
            T.tailBase = 90 - cat.rootRot; T.tailCurl = 6; T.tailAmp = 10; tailSpeed = 2.2;
            T.blush = cat.t > 1.2 ? 0.6 : 0;
            cat.headTgt = 8 + Math.sin(time * 1.5) * 3;
            cat.lookX = 0; cat.lookY = 0.8;
        } else if (st === 'air') {
            defaultsStanding();
            T.tailBase = 235; T.tailCurl = 8; T.tailAmp = 12; tailSpeed = 6; eyeMode = 'wide'; T.earFlat = 0.4;
            cat.headTgt = -6;
        } else if (st === 'land') {
            defaultsStanding();
            T.crouch = cat.t < 0.18 ? 0.8 : 0.1;
            eyeMode = d.hard ? 'closed' : 'open';
            if (cat.t > cat.dur) {
                if (d.hard) { say(pick(['oof', 'hmph!', 'rude', '>:(']), 1.4); setState('sit', 2); }
                else setState('sit', rand(1.5, 3));
            }
        }

        cat.walkAmt = approach(cat.walkAmt, walking ? 1 : 0, 10, dt);
    }

    function updatePlay(dt) {
        var d = cat.data;
        if (!toy) { setState('sit', 2); return; }
        defaultsStanding();
        T.tailBase = 214; T.tailCurl = 18; T.tailAmp = 10; tailSpeed = 5; T.earFlat = 0;
        var hs = headScreen();
        var tx = toy.x, ty = floorY() - toy.h;
        var dx = tx - cat.x;
        cat.lookX = clamp((tx - hs.x) * cat.flip / 40, -1.3, 1.3);
        cat.lookY = clamp((ty - hs.y) / 40, -1.3, 1.3);
        cat.headTgt = clamp(Math.atan2(ty - hs.y, Math.abs(tx - hs.x)) / DEG * 0.4, -24, 10);
        d.cool -= dt;
        if (onGround()) {
            var adx = Math.abs(dx);
            if (d.phase === 'crouch') {
                // committed: hold the wiggle-butt crouch, then pounce (no flip-flopping while the heart drifts)
                T.crouch = 0.8; T.tailAmp = 16; tailSpeed = 11;
                if (adx > 14) cat.dir = dx > 0 ? 1 : -1;
                d.wiggle += dt;
                if (adx > 170) { d.phase = 'chase'; d.wiggle = 0; }
                else if (d.wiggle > 0.55) {
                    d.wiggle = 0; d.phase = 'jump';
                    var lead = tx + toy.vx * 0.35 - cat.x; // aim where the heart is heading
                    var need = Math.max(60, toy.h - 30 * S);
                    cat.dir = lead >= 0 ? 1 : -1;
                    jump(clamp(lead * 2.2, -280, 280), Math.sqrt(2 * 1500 * need) * rand(0.95, 1.08));
                }
            } else if (adx > 64) {
                d.phase = 'chase';
                moveToward(tx - (dx > 0 ? 32 : -32), 118, dt);
            } else if (d.cool > 0) {
                d.phase = 'wait';
            } else {
                d.phase = 'crouch';
                d.wiggle = 0;
                cat.dir = dx >= 0 ? 1 : -1;
            }
        } else {
            // airborne: swat if close
            T.paw = 1; T.crouch = 0;
            if (Math.hypot(tx - hs.x, ty - hs.y) < 34 * S + 8 && d.cool <= 0) {
                toy.swats++;
                d.cool = 0.6;
                for (var i = 0; i < 4; i++) {
                    var a = rand(0, Math.PI * 2);
                    particle('mochi-pop', '✦', tx, ty, tx + Math.cos(a) * 22, ty + Math.sin(a) * 22);
                }
                if (toy.swats >= 3 && Math.random() < 0.65) {
                    endToy(true);
                    setState('air', 0, { caught: true });
                    return;
                }
                toy.vx = (tx >= cat.x ? 1 : -1) * rand(120, 170);
                toy.vy = rand(60, 110);
            }
        }
        if (cat.t > cat.dur) { endToy(false); say(pick(['aw', 'hmph', 'next time']), 1.2); setState('sit', 2); }
    }

    // ---------- physics ----------
    var GRAV = 1500;
    function updatePhysics(dt) {
        var st = cat.state;
        if (st === 'held') {
            if (drag) {
                // Hang from the scruff: place the cat so the scruff sits under the pointer.
                var swingTarget = 0;
                var s = drag.samples;
                if (s.length > 1) {
                    var a = s[0], b = s[s.length - 1];
                    var vx = (b.x - a.x) / Math.max(0.016, b.t - a.t);
                    swingTarget = clamp(-vx * 0.035, -38, 38);
                }
                cat.swing = approach(cat.swing, swingTarget, 6, dt);
                cat.rootRot = approach(cat.rootRot, -72 + cat.swing * 0.5, 9, dt);
                var G = rot({ x: 20, y: -46 - (-32) }, cat.rootRot); // scruff relative to pivot
                var pivotCat = { x: G.x, y: G.y - 32 };
                var tx = drag.x - cat.flip * S * pivotCat.x;
                var ty = floorY() - (drag.y - S * pivotCat.y);
                cat.x = approach(cat.x, tx, 28, dt);
                cat.y = approach(cat.y, ty, 28, dt);
            }
            return;
        }
        if (cat.y > groundH + 0.5 || cat.vy > 0) {
            if (st !== 'air' && st !== 'annoyed' && st !== 'play' && st !== 'land') setState('air', 0, {});
            var prevFeet = floorY() - cat.y;
            cat.vy -= GRAV * dt;
            cat.x += cat.vx * dt;
            cat.y += cat.vy * dt;
            // land on a perch if her paws just crossed its top edge
            if (cat.vy < 0 && !cat.plat && cat.state !== 'play') {
                var feet = floorY() - cat.y, list = perches();
                for (var i = 0; i < list.length; i++) {
                    var n = list[i];
                    if (n === ignorePerch.el && time < ignorePerch.until) continue;
                    var r = n.getBoundingClientRect();
                    if (!perchOk(r)) continue;
                    if (r.top >= prevFeet - 2 && r.top <= feet + 0.5 && cat.x > r.left + 18 * S && cat.x < r.right - 18 * S) {
                        cat.plat = n; cat.platT = 0;
                        stats.perches++;
                        updateGround();
                        cat.y = groundH;
                        break;
                    }
                }
            }
            if (cat.x < 34) { cat.x = 34; cat.vx = Math.abs(cat.vx) * 0.45; cat.dir = 1; }
            if (cat.x > W - 34) { cat.x = W - 34; cat.vx = -Math.abs(cat.vx) * 0.45; cat.dir = -1; }
            if (cat.y > H - 70) { cat.y = H - 70; cat.vy = Math.min(cat.vy, 0); }
            if (cat.state === 'air' || cat.state === 'play') cat.rootRot = approach(cat.rootRot, clamp(-cat.vy * 0.02, -16, 22), 7, dt);
            if (cat.y <= groundH && cat.vy < 0) {
                var impact = -cat.vy;
                cat.y = groundH; cat.vy = 0; cat.vx = 0;
                if (cat.plat && cat.state === 'air' && !cat.data.caught) say(pick(['mrrp', 'my spot now', 'comfy', 'nice view', 'bwah']), 1.4);
                cat.squash = impact > 450 ? 0.72 : 0.86;
                if (cat.state === 'air') {
                    var hard = impact > 1100;
                    if (cat.data.caught) { say(pick(['got it!', 'mine ♥', 'mrrp!!', 'victory', 'bwah!!']), 1.6); setState('land', 0.5, {}); }
                    else setState('land', hard ? 0.55 : 0.35, { hard: hard });
                }
            }
        } else {
            cat.y = groundH;
            cat.vx = 0;
            if (cat.plat) { cat.platT += dt; cat.x = clamp(cat.x, perchBounds[0], perchBounds[1]); }
        }
        if (st !== 'held') { cat.rootRot = approach(cat.rootRot, cat.y > groundH + 0.5 ? cat.rootRot : 0, 10, dt); cat.swing = approach(cat.swing, 0, 4, dt); }
        cat.squash = approach(cat.squash, 1, 9, dt);
        // keep on screen
        if (cat.state !== 'walk' || cat.x > 0) cat.x = clamp(cat.x, cat.state === 'walk' ? -80 : 30, W - 30);
    }

    // ---------- rig ----------
    var PIVOT = { x: 0, y: -32 };
    function toScreen(p) {
        var q = { x: p.x - PIVOT.x, y: p.y - PIVOT.y };
        q = rot(q, cat.rootRot);
        q.x += PIVOT.x; q.y += PIVOT.y;
        q.y = (q.y - 0) * cat.squash;
        q.x *= (2 - cat.squash);
        return { x: cat.x + cat.flip * S * q.x, y: floorY() - cat.y + S * q.y };
    }

    function bodyPath(a, puff) {
        var h = 25 + puff * 2.5;
        var b = a * 11; // belly lifts with the spine so she keeps her thickness
        return 'M-11,-6 C-13,-21 -5,' + f1(-h - 2 - a * 7) + ' 10,' + f1(-h - a * 12) +
            ' C24,' + f1(-h - 1 - a * 13) + ' 39,' + f1(-h - 2 - a * 6) + ' 51,' + f1(-h + 2 - a * 2) +
            ' C60,' + f1(-h + 9) + ' 59,0 47,4 C32,' + f1(10.5 - b) + ' 9,' + f1(10.5 - b) + ' 1,5 C-6,3 -11,0 -11,-6 Z';
    }
    function tailPath(base, curl, hook, amp, puff) {
        var t = time * tailSpeed;
        var a1 = base + Math.sin(t) * amp * 0.5;
        var a2 = a1 + curl + Math.sin(t - 0.8) * amp;
        var a3 = a2 + curl * 1.1 + hook + Math.sin(t - 1.6) * amp * 1.25;
        var L = [13, 12.5, 11];
        var p0 = { x: -7, y: -14 };
        var p1 = add(p0, { x: Math.cos(a1 * DEG) * L[0], y: Math.sin(a1 * DEG) * L[0] });
        var p2 = add(p1, { x: Math.cos(a2 * DEG) * L[1], y: Math.sin(a2 * DEG) * L[1] });
        var p3 = add(p2, { x: Math.cos(a3 * DEG) * L[2], y: Math.sin(a3 * DEG) * L[2] });
        var m12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        var tip0 = { x: lerp(p2.x, p3.x, 0.45), y: lerp(p2.y, p3.y, 0.45) };
        return {
            d: 'M' + f1(p0.x) + ',' + f1(p0.y) + ' Q' + f1(p1.x) + ',' + f1(p1.y) + ' ' + f1(m12.x) + ',' + f1(m12.y) + ' Q' + f1(p2.x) + ',' + f1(p2.y) + ' ' + f1(p3.x) + ',' + f1(p3.y),
            tip: 'M' + f1(tip0.x) + ',' + f1(tip0.y) + ' L' + f1(p3.x) + ',' + f1(p3.y),
            w: 7 + puff * 5
        };
    }
    function setLeg(leg, a, foot, bend) {
        // the paw rests on the ground at `foot`; the leg ends at the paw's centre
        var b = { x: foot.x, y: foot.y - 3.5 };
        var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len; // perpendicular; for a downward leg this points toward -x (backwards)
        var k;
        if (leg.back) k = { x: lerp(a.x, b.x, 0.5) + nx * 2.2 * bend, y: lerp(a.y, b.y, 0.5) + ny * 2.2 * bend }; // gentle hock
        else k = { x: lerp(a.x, b.x, 0.5) - nx * 0.8 * bend, y: lerp(a.y, b.y, 0.5) - ny * 0.8 * bend };
        var d1 = 'M' + f1(a.x) + ',' + f1(a.y) + ' L' + f1(k.x) + ',' + f1(k.y);
        var d2 = 'M' + f1(k.x) + ',' + f1(k.y) + ' L' + f1(b.x) + ',' + f1(b.y);
        leg.o1.setAttribute('d', d1); leg.f1.setAttribute('d', d1);
        leg.o2.setAttribute('d', d2); leg.f2.setAttribute('d', d2);
        // paw sits perpendicular to the lower leg, pointing forward
        var ang = Math.atan2(b.y - k.y, b.x - k.x) / DEG - 90;
        var lim = foot.y > -0.5 ? 12 : cat.state === 'held' ? 70 : 30; // planted paws stay flat on the ground
        leg.paw.setAttribute('transform', 'translate(' + f1(b.x) + ',' + f1(b.y) + ') rotate(' + f1(clamp(ang, -lim, lim)) + ')');
    }
    function smoothFoot(leg, target, dt, rate) {
        if (!leg.foot) leg.foot = { x: target.x, y: target.y };
        leg.foot.x = approach(leg.foot.x, target.x, rate, dt);
        leg.foot.y = approach(leg.foot.y, target.y, rate, dt);
        return leg.foot;
    }

    function render(dt) {
        // smooth params
        var rates = { sit: 7, lie: 4, arch: 6, crouch: 10, earFlat: 12, blush: 4, puff: 9, paw: cat.state === 'paw' ? 26 : 9, mouth: 10, tongue: 18, headDrop: 4, tailBase: 5, tailCurl: 5, tailAmp: 4, tailHook: 5 };
        for (var key in P) P[key] = approach(P[key], T[key], rates[key] || 6, dt);
        cat.headRot = approach(cat.headRot, cat.headTgt, 7, dt);
        cat.flip = approach(cat.flip, cat.dir, 14, dt);
        if (Math.abs(cat.flip) < 0.08) cat.flip = cat.flip < 0 ? -0.08 : 0.08;

        var walkBob = cat.walkAmt * Math.abs(Math.sin(cat.walkPhase)) * 1.6;
        var legH = lerp(19.5, 6, P.lie) + P.arch * 2.5 - P.crouch * 7;
        var hip = { x: -23 + P.crouch * 2, y: lerp(-legH, -8, P.sit) - walkBob };
        var breath = 1 + Math.sin(time * (P.lie > 0.5 ? 1.9 : 2.6)) * (P.lie > 0.5 ? 0.035 : 0.015);
        var torsoRot = -P.sit * 25 - P.crouch * 9 * (1 - P.sit); // eased: no snapping when she drops into a crouch
        var purrX = purring ? (Math.random() - 0.5) * 0.7 : 0;

        // torso
        el.torso.setAttribute('transform', 'translate(' + f1(hip.x + purrX) + ',' + f1(hip.y) + ') rotate(' + f1(torsoRot) + ') scale(1,' + breath.toFixed(3) + ')');
        var bp = bodyPath(P.arch, P.puff);
        el.body.setAttribute('d', bp);
        el.bodyLine.setAttribute('d', bp);
        el.bodyClip.setAttribute('d', bp);
        var thigh = clamp(P.sit * 1.25 - 0.15, 0.001, 1);
        var thighT = 'translate(2,-7) scale(' + thigh.toFixed(3) + ') translate(-2,7)';
        el.haunch.setAttribute('transform', thighT);
        el.haunch.setAttribute('opacity', thigh.toFixed(2));
        el.haunchFill.setAttribute('transform', thighT);
        el.haunchClip.setAttribute('transform', thighT);

        // tail
        var tp = tailPath(P.tailBase, P.tailCurl, P.tailHook, P.tailAmp, P.puff);
        el.tailOut.setAttribute('d', tp.d); el.tailOut.setAttribute('stroke-width', f1(tp.w + 4));
        el.tail.setAttribute('d', tp.d); el.tail.setAttribute('stroke-width', f1(tp.w));
        el.tailTip.setAttribute('d', tp.tip); el.tailTip.setAttribute('stroke-width', f1(tp.w));

        // head (counter-rotate so she stays upright-ish when sitting)
        var neck = { x: 52 + P.headDrop * 4, y: -33 + P.headDrop * 14 + P.lie * 2 };
        var headAngle = cat.headRot - torsoRot * 0.85 - cat.rootRot * 0.8; // keep the face upright when dangling/tumbling
        el.head.setAttribute('transform', 'translate(' + f1(neck.x) + ',' + f1(neck.y) + ') rotate(' + f1(headAngle) + ') scale(1.07)');
        var twitch = cat.earTwitch > 0 ? Math.sin(cat.earTwitch * 40) * 8 : 0;
        el.earL.setAttribute('transform', 'rotate(' + f1(-P.earFlat * 58 + twitch) + ' -8 -10)');
        el.earR.setAttribute('transform', 'rotate(' + f1(P.earFlat * 46) + ' 10 -10)');
        // head position in cat space (for bubbles, hearts, looking)
        var hc = add(hip, rot(neck, torsoRot));
        cat._headCat = hc;

        // face
        var blinkScale = cat.blinking > 0 ? 0.12 : 1;
        eyeParts.forEach(function (e) {
            e.open.style.display = eyeMode === 'open' ? '' : 'none';
            e.happy.style.display = eyeMode === 'happy' ? '' : 'none';
            e.closed.style.display = eyeMode === 'closed' ? '' : 'none';
            e.angry.style.display = eyeMode === 'angry' ? '' : 'none';
            e.wide.style.display = eyeMode === 'wide' ? '' : 'none';
            var lx = clamp(cat.lookX, -1.3, 1.3), ly = clamp(cat.lookY, -1.3, 1.3);
            e.open.setAttribute('transform', 'translate(' + f1(lx) + ',' + f1(ly * 0.8) + ') scale(1,' + blinkScale + ')');
            e.wide.setAttribute('transform', 'translate(' + f1(lx * 0.6) + ',' + f1(ly * 0.5) + ')');
        });
        el.brows.setAttribute('opacity', eyeMode === 'angry' ? '1' : '0');
        el.blushL.setAttribute('opacity', (P.blush * 0.75).toFixed(2));
        el.blushR.setAttribute('opacity', (P.blush * 0.75).toFixed(2));
        el.mouthOpen.setAttribute('opacity', P.mouth.toFixed(2));
        el.mouthOpen.setAttribute('transform', 'translate(3.1,6) scale(1,' + (0.4 + P.mouth * 0.6).toFixed(2) + ') translate(-3.1,-6)');
        el.mouth.setAttribute('opacity', (1 - P.mouth).toFixed(2));
        el.tongue.setAttribute('opacity', P.tongue.toFixed(2));

        // legs: joints in cat space
        function joint(local) { return add(hip, rot(local, torsoRot)); }
        var jbn = joint({ x: 7, y: -1 }), jbf = joint({ x: 4, y: -1 }), jfn = joint({ x: 42, y: -1 }), jff = joint({ x: 38, y: -1 });
        // when sitting, the back legs fold: the visible part is just a paw poking out in front of the thigh
        var tuck = clamp(P.sit * 1.3 - 0.3, 0, 1);
        jbn = { x: lerp(jbn.x, hip.x + 15, tuck), y: lerp(jbn.y, -4, tuck) };
        jbf = { x: lerp(jbf.x, hip.x + 11, tuck), y: lerp(jbf.y, -4, tuck) };
        var ph = cat.walkPhase, wa = cat.walkAmt, stride = 7.5, lift = 5.5;
        function walkFoot(j, off, slant) {
            var s = Math.sin(ph + off), c = Math.cos(ph + off);
            return { x: j.x + slant + s * stride * wa, y: -Math.max(0, c) * lift * wa };
        }
        var airborne = cat.y > groundH + 0.5 && cat.state !== 'held';
        var held = cat.state === 'held';
        var targets;
        if (held) {
            var down = function (j, sx) { var v = rot({ x: sx + Math.sin(time * 2.2 + sx) * 1.5, y: 23 }, -cat.rootRot); return add(j, v); };
            targets = { bn: down(jbn, 1), bf: down(jbf, -2), fn: down(jfn, 3), ff: down(jff, -1) };
        } else if (airborne) {
            var rising = cat.vy > 0;
            targets = {
                bn: add(jbn, { x: rising ? -10 : -2, y: rising ? 10 : 18 }), bf: add(jbf, { x: rising ? -13 : -5, y: rising ? 9 : 17 }),
                fn: add(jfn, { x: rising ? 12 : 4, y: rising ? 6 : 18 }), ff: add(jff, { x: rising ? 9 : 2, y: rising ? 8 : 17 })
            };
        } else {
            var stand = {
                bn: walkFoot(jbn, 0, 1), bf: walkFoot(jbf, Math.PI, -1),
                fn: walkFoot(jfn, Math.PI, 2), ff: walkFoot(jff, 0, 0)
            };
            var sitT = { bn: { x: hip.x + 21, y: 0 }, bf: { x: hip.x + 17, y: 0 }, fn: { x: jfn.x + 2, y: 0 }, ff: { x: jff.x - 2, y: 0 } };
            var lieT = { bn: { x: jbn.x + 9, y: Math.min(0, jbn.y + 3) }, bf: { x: jbf.x + 7, y: Math.min(0, jbf.y + 3) }, fn: { x: jfn.x + 9, y: Math.min(0, jfn.y + 3) }, ff: { x: jff.x + 7, y: Math.min(0, jff.y + 3) } };
            targets = {};
            ['bn', 'bf', 'fn', 'ff'].forEach(function (k2) {
                var a = stand[k2], b = sitT[k2], c = lieT[k2];
                var x = lerp(lerp(a.x, b.x, P.sit), c.x, P.lie);
                var y = lerp(lerp(a.y, b.y, P.sit), c.y, P.lie);
                targets[k2] = { x: x, y: y };
            });
        }
        if (cat.state === 'snuggle' && cat.data.kneading) {
            var kn = Math.sin(time * 9);
            targets.fn = { x: targets.fn.x + 2, y: targets.fn.y - Math.max(0, kn) * 5 };
            targets.ff = { x: targets.ff.x + 2, y: targets.ff.y - Math.max(0, -kn) * 5 };
        }
        // groom / swat paw
        if (P.paw > 0.02) {
            var mouthPt = add(hc, rot({ x: 4, y: 8 }, cat.headRot));
            var goal = { x: mouthPt.x - 1, y: mouthPt.y + 2 };
            if (cat.pawScreen && Math.abs(cat.flip) > 0.3) {
                // screen point -> cat space, then keep it within reach of the shoulder
                var gx = (cat.pawScreen.x - cat.x) / (cat.flip * S), gyc = (cat.pawScreen.y - (floorY() - cat.y)) / S + 3.5;
                var vx = gx - jfn.x, vy = gyc - jfn.y, vl = Math.hypot(vx, vy) || 1, reach = 30;
                if (vl > reach) { vx = vx / vl * reach; vy = vy / vl * reach; }
                goal = { x: jfn.x + vx, y: jfn.y + vy };
            }
            var p = targets.fn;
            targets.fn = { x: lerp(p.x, goal.x, P.paw), y: lerp(p.y, goal.y, P.paw) };
        }
        var rate = cat.walkAmt > 0.3 && !airborne ? 60 : cat.state === 'paw' ? 34 : 16;
        var bend = clamp(1 - P.lie - P.sit * 0.7, 0, 1);
        setLeg(legs.bf, jbf, smoothFoot(legs.bf, targets.bf, dt, rate), bend);
        setLeg(legs.ff, jff, smoothFoot(legs.ff, targets.ff, dt, rate), bend);
        setLeg(legs.bn, jbn, smoothFoot(legs.bn, targets.bn, dt, rate), bend);
        setLeg(legs.fn, jfn, smoothFoot(legs.fn, targets.fn, dt, rate), bend);
        // a raised paw (grooming, swatting, kneading) comes out in front of the chest
        var pawUp = P.paw > 0.25;
        var wantFn = pawUp || held ? el.front : el.near;
        var wantBn = held ? el.front : el.near;
        if (legs.bn.g.parentNode !== wantBn) { if (wantBn === el.front) el.front.insertBefore(legs.bn.g, el.front.firstChild); else el.near.insertBefore(legs.bn.g, el.near.firstChild); }
        if (legs.fn.g.parentNode !== wantFn) wantFn.appendChild(legs.fn.g);

        // root transforms
        el.root.setAttribute('transform', 'translate(0,' + f1(-32) + ') rotate(' + f1(cat.rootRot) + ') translate(0,32)');
        el.flip.setAttribute('transform', 'scale(' + (cat.flip * (2 - cat.squash)).toFixed(3) + ',' + cat.squash.toFixed(3) + ')');

        var left = cat.x - (-VB.x) * S, top = floorY() - cat.y - (-VB.y) * S;
        holder.style.transform = 'translate(' + f1(left) + 'px,' + f1(top) + 'px)';

        // shadow
        var sw = (P.lie > 0.5 ? 92 : 78) * S, hgt = Math.max(0, cat.y - groundH);
        var sScale = clamp(1 - hgt / 420, 0.35, 1);
        shadow.style.width = sw + 'px';
        shadow.style.transform = 'translate(' + f1(cat.x - sw / 2 + cat.flip * 4 * S) + 'px,' + f1(floorY() - groundH - 4) + 'px) scale(' + sScale.toFixed(2) + ',' + sScale.toFixed(2) + ')';
        shadow.style.opacity = (sScale * 0.9).toFixed(2);

        // name tag + bubble follow the head
        var hsn = toScreen(add(hc, { x: 0, y: -30 }));
        var showName = nameEditing || !!tips || nameShowFor > 0 || pet.hovering || cat.state === 'petted' || cat.state === 'held';
        nameTag.classList.toggle('show', showName);
        var nw = sizes.name, bw = sizes.bubble;
        nameTag.style.transform = 'translate(' + f1(clamp(hsn.x - nw / 2, 6, W - nw - 6)) + 'px,' + f1(Math.max(6, hsn.y - 26)) + 'px)';
        bubble.style.transform = 'translate(' + f1(clamp(hsn.x - bw / 2 + cat.flip * 26 * S, 6, W - bw - 6)) + 'px,' + f1(Math.max(6, hsn.y - (showName ? 54 : 30))) + 'px)';
        if (tips) {
            var tw = sizes.tipsW || 290, th = sizes.tipsH || 220;
            var ty = hsn.y - th - 36;
            if (ty < 8) ty = Math.min(H - th - 8, floorY() - cat.y + 12); // no room above: drop below her
            tips.style.transform = 'translate(' + f1(clamp(hsn.x - tw / 2, 12, W - tw - 12)) + 'px,' + f1(Math.max(8, ty)) + 'px)';
        }
    }

    // ---------- loop ----------
    var last = performance.now();
    function frame(now) {
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        time += dt;
        cat.awake += dt;

        // blinking & ear twitches
        cat.blinkIn -= dt;
        if (cat.blinking > 0) cat.blinking -= dt;
        else if (cat.blinkIn <= 0) { cat.blinking = 0.13; cat.blinkIn = rand(2.2, 5.5); }
        cat.earTwitchIn -= dt;
        if (cat.earTwitch > 0) cat.earTwitch -= dt;
        else if (cat.earTwitchIn <= 0) { cat.earTwitch = 0.16; cat.earTwitchIn = rand(3, 9); }

        // petting decays when the hand stops moving
        if (time - pet.lastMove > 0.25) pet.level = Math.max(0, pet.level - dt * 0.9);
        if (pet.hovering || nameEditing) nameShowFor = Math.max(nameShowFor, 1.6);
        nameShowFor = Math.max(0, nameShowFor - dt);
        if (bubbleTimer > 0) { bubbleTimer -= dt; if (bubbleTimer <= 0) bubble.classList.remove('show'); }

        stats.withMs += dt * 1000;
        if (cat.state === 'petted' && time - pet.lastMove < 0.6) stats.petMs += dt * 1000;
        if (cat.state === 'held') stats.heldMs += dt * 1000;
        saveStats(false);
        refreshStats();
        updateGround();
        updateState(dt);
        updatePhysics(dt);
        updateToy(dt);
        render(dt);
        requestAnimationFrame(frame);
    }

    function start() {
        document.body.appendChild(layer);
        measure();
        renderName();
        var saved = null;
        try { saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { saved = null; }
        if (saved && Date.now() - saved.t < 30 * 60 * 1000) {
            // carry on from the last page: same spot, and still asleep if she was napping
            cat.x = clamp((saved.xr || 0.3) * W, MARGIN, W - MARGIN);
            cat.dir = saved.dir === -1 ? -1 : 1;
            cat.flip = cat.dir;
            if (saved.sleeping) {
                setState('sleep', rand(10, 25));
                cat.t = 1.3;
                P.lie = T.lie = 1; P.sit = T.sit = 0; P.headDrop = T.headDrop = 1;
            } else {
                setState('sit', rand(2, 4));
                P.sit = T.sit = 1;
                nameShowFor = 2;
            }
        } else {
            cat.x = -60;
            cat.dir = 1;
            // she trots in from the left edge
            walkTo(W * rand(0.18, 0.35), 52, function () { setState('sit', 3); say(pick(['mrrp!', 'hi :3', 'meow', 'bwah']), 1.6); nameShowFor = tipsSeen ? 2.5 : 6; });
        }
        function remember() {
            saveStats(true);
            try {
                sessionStorage.setItem(SESSION_KEY, JSON.stringify({
                    xr: clamp(cat.x, 0, W) / W, dir: cat.dir, t: Date.now(),
                    sleeping: cat.state === 'sleep' || cat.state === 'snuggle' || (cat.state === 'petted' && pet.prevState === 'sleep')
                }));
            } catch (e) {}
        }
        window.addEventListener('pagehide', remember);
        document.addEventListener('visibilitychange', function () { if (document.hidden) remember(); });
        window.addEventListener('resize', function () { measure(); cat.x = clamp(cat.x, 30, W - 30); });
        requestAnimationFrame(function (n) { last = n; requestAnimationFrame(frame); });
    }

    // Debug/tinker hook for the console: mochi.do('sleep') etc.
    window.mochi = {
        do: function (name) {
            if (name === 'play') startPlay();
            else if (name === 'paw') { if (!startPaw()) return 'nothing in reach'; }
            else if (name === 'annoy') annoy();
            else setState(name, name === 'sleep' ? 25 : 6);
        },
        get name() { return catName; }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 900); });
    else setTimeout(start, 900);
})();
