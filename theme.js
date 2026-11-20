/* Day / night toggle. The saved choice is applied by a tiny inline script in <head>. */
(function () {
    'use strict';
    var root = document.documentElement;
    var meta = document.querySelector('meta[name="theme-color"]');
    function apply(theme) {
        if (theme === 'dark') root.dataset.theme = 'dark';
        else delete root.dataset.theme;
        if (meta) meta.content = theme === 'dark' ? '#12142a' : '#f3f6fa';
        document.querySelectorAll('.theme-toggle').forEach(function (button) {
            button.setAttribute('aria-pressed', String(theme === 'dark'));
            button.setAttribute('aria-label', theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode');
            button.title = theme === 'dark' ? 'day mode' : 'night mode';
        });
    }
    apply(root.dataset.theme === 'dark' ? 'dark' : 'light');
    document.querySelectorAll('.theme-toggle').forEach(function (button) {
        button.addEventListener('click', function () {
            var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            apply(next);
            try { localStorage.setItem('pixelisTheme', next); } catch (e) {}
        });
    });
})();
