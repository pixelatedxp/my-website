document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    const coords = { x: 0, y: 0 };
    let cursorTrail = document.querySelector('.cursor-trail');
    if (!cursorTrail) {
        cursorTrail = document.createElement('div');
        cursorTrail.className = 'cursor-trail';
        document.body.appendChild(cursorTrail);
    }
    while(cursorTrail.children.length < 60) {
        const c = document.createElement('div');
        c.className = 'circle';
        cursorTrail.appendChild(c);
    }
    const circles = document.querySelectorAll(".circle");
    circles.forEach(function (circle, index) {
        circle.x = 0;
        circle.y = 0;
    });
    window.addEventListener("mousemove", function(e) {
        coords.x = e.clientX;
        coords.y = e.clientY;
    });
    function animateCircles() {
        let x = coords.x;
        let y = coords.y;
        circles.forEach(function (circle, index) {
            circle.style.left = x + "px";
            circle.style.top = y + "px";
            circle.style.transform = `translate3d(-50%, -50%, 1000px) scale(${(circles.length - index) / circles.length})`;
            circle.x = x;
            circle.y = y;
            const nextCircle = circles[index + 1] || circles[0];
            x += (nextCircle.x - x) * 0.02;
            y += (nextCircle.y - y) * 0.02;
        });
        requestAnimationFrame(animateCircles);
    }
    animateCircles();
    const interactables = document.querySelectorAll('a, button, .tiltable');
    interactables.forEach(el => {
        el.addEventListener('mouseenter', () => {
            circles.forEach(c => c.style.backgroundColor = 'var(--text-secondary)');
        });
        el.addEventListener('mouseleave', () => {
            circles.forEach(c => c.style.backgroundColor = 'var(--text-primary)');
        });
    });
    const tiltables = document.querySelectorAll('.tiltable');
    tiltables.forEach(tiltable => {
        tiltable.addEventListener('mousemove', (e) => {
            const rect = tiltable.getBoundingClientRect();
            const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
            const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
            const maxRotateX = 8;
            const maxRotateY = 8;
            const rotateX = y * maxRotateX * -1;
            const rotateY = x * maxRotateY;
            tiltable.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            tiltable.style.transition = 'transform 0.1s ease-out';
        });
        tiltable.addEventListener('mouseleave', () => {
            tiltable.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            tiltable.style.transition = 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        });
    });
    const glowCards = document.querySelectorAll('.glow-card');
    glowCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
    const fadeElements = document.querySelectorAll('.fade-up');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    fadeElements.forEach(el => observer.observe(el));
    setTimeout(() => {
        document.querySelectorAll('.fade-up-initial').forEach((el, index) => {
            setTimeout(() => {
                el.classList.add('visible');
            }, index * 150);
        });
    }, 100);
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    const glitchElements = document.querySelectorAll('.glitch-text');
    setTimeout(() => {
        glitchElements.forEach(el => {
            let iteration = 0;
            const originalText = el.dataset.text;
            let interval = null;
            clearInterval(interval);
            interval = setInterval(() => {
                el.innerText = originalText
                    .split("")
                    .map((item, index) => {
                        if(index < iteration) {
                            return originalText[index];
                        }
                        return letters[Math.floor(Math.random() * letters.length)]
                    })
                    .join("");
                if(iteration >= originalText.length){
                    clearInterval(interval);
                }
                iteration += 1 / 3;
            }, 30);
        });
    }, 300);
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const checkTheme = localStorage.getItem('theme');
    const sunPath = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />';
    const moonPath = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />';
    if (checkTheme === 'light') {
        document.body.classList.replace('dark-mode', 'light-mode');
        if (themeIcon) themeIcon.innerHTML = moonPath;
    } else {
        if (themeIcon) themeIcon.innerHTML = sunPath;
    }
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (document.body.classList.contains('dark-mode')) {
                document.body.classList.replace('dark-mode', 'light-mode');
                if (themeIcon) themeIcon.innerHTML = moonPath;
                localStorage.setItem('theme', 'light');
            } else {
                document.body.classList.replace('light-mode', 'dark-mode');
                if (themeIcon) themeIcon.innerHTML = sunPath;
                localStorage.setItem('theme', 'dark');
            }
        });
    }
    const canvas = document.getElementById('snowfall');
    if (canvas) {
        let snowEnabled = localStorage.getItem('snowEnabled') !== 'false';
        const ctx = canvas.getContext('2d');
        let particles = [];
        let animFrame;
        let snowIntensity = 1;
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        class Snowflake {
            constructor() {
                this.reset();
            }
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 3 + 1;
                this.speedY = Math.random() * 0.8 + 0.2;
                this.speedX = Math.random() * 0.3 - 0.15;
                this.opacity = Math.random() * 0.5 + 0.2;
                this.wobble = Math.random() * 2;
                this.wobbleSpeed = Math.random() * 0.02 + 0.005;
            }
            update() {
                this.y += this.speedY;
                this.x += this.speedX + Math.sin(this.wobble) * 0.3;
                this.wobble += this.wobbleSpeed;
                if (this.y > canvas.height) {
                    this.reset();
                    this.y = -this.size;
                }
                if (this.x > canvas.width + 5) this.x = -5;
                if (this.x < -5) this.x = canvas.width + 5;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                const snowColor = document.body.classList.contains('light-mode') ? '0, 0, 0' : '255, 255, 255';
                ctx.fillStyle = `rgba(${snowColor}, ${this.opacity})`;
                ctx.fill();
            }
        }
        function initSnow() {
            particles = [];
            const count = Math.min(Math.floor(window.innerWidth / 8), 150) * snowIntensity;
            for (let i = 0; i < count; i++) {
                particles.push(new Snowflake());
            }
        }
        function animateSnow() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            if (snowEnabled) {
                animFrame = requestAnimationFrame(animateSnow);
            }
        }
        function startSnow() {
            if (snowEnabled) return;
            snowEnabled = true;
            canvas.style.display = 'block';
            initSnow();
            animateSnow();
            updateSnowIcon();
        }
        function stopSnow() {
            snowEnabled = false;
            canvas.style.display = 'none';
            if (animFrame) {
                cancelAnimationFrame(animFrame);
                animFrame = null;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            updateSnowIcon();
        }
        function updateSnowIcon() {
            const icon = document.getElementById('snowIcon');
            if (icon) {
                if (snowEnabled) {
                    icon.innerHTML = '<path d="M12 2v4m0 12v4M4 12H2m20 0h-2M5.64 5.64l2.83 2.83m7.07 7.07l2.83 2.83M5.64 18.36l2.83-2.83m7.07-7.07l2.83-2.83M12 8a4 4 0 100 8 4 4 0 000-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
                } else {
                    icon.innerHTML = '<path d="M12 2v4m0 12v4M4 12H2m20 0h-2M5.64 5.64l2.83 2.83M5.64 18.36l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
                }
            }
        }
        if (snowEnabled) {
            initSnow();
            animateSnow();
            updateSnowIcon();
        } else {
            canvas.style.display = 'none';
            updateSnowIcon();
        }
        const snowToggle = document.getElementById('snowToggle');
        if (snowToggle) {
            snowToggle.addEventListener('click', () => {
                if (snowEnabled) {
                    stopSnow();
                    localStorage.setItem('snowEnabled', 'false');
                } else {
                    startSnow();
                    localStorage.setItem('snowEnabled', 'true');
                }
            });
        }
        window.addEventListener('storage', (e) => {
            if (e.key === 'snowEnabled') {
                if (e.newValue === 'false') {
                    stopSnow();
                } else {
                    startSnow();
                }
            }
        });
        window.addEventListener('easteregg:snowstorm', () => {
            if (!snowEnabled) {
                startSnow();
                localStorage.setItem('snowEnabled', 'true');
            }
            snowIntensity = 4;
            initSnow();
            canvas.classList.add('snowstorm');
            window.setTimeout(() => {
                snowIntensity = 1;
                initSnow();
                canvas.classList.remove('snowstorm');
            }, 15000);
        });
    }
});
function copyEmail(element) {
    navigator.clipboard.writeText('pixel@pixelis.dev').then(() => {
        const statusEl = element.querySelector('.copy-status');
        if (statusEl) {
            statusEl.style.opacity = '1';
            setTimeout(() => {
                statusEl.style.opacity = '0';
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}
function bindImageZoom() {
    const mainImgContainers = document.querySelectorAll('.gallery-main');
    mainImgContainers.forEach(container => {
        const img = container.querySelector('img');
        if (!img) return;
        let zoomResult = container.querySelector('.img-zoom-result');
        if (!zoomResult) {
            zoomResult = document.createElement('div');
            zoomResult.className = 'img-zoom-result';
            container.appendChild(zoomResult);
        }
        container.addEventListener('mousemove', (e) => {
            zoomResult.style.backgroundImage = `url('${img.src}')`;
            zoomResult.style.backgroundSize = `${img.width * 2.5}px ${img.height * 2.5}px`;
            const rect = container.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            let xPercent = (x / rect.width) * 100;
            let yPercent = (y / rect.height) * 100;
            zoomResult.style.backgroundPosition = `${xPercent}% ${yPercent}%`;
            zoomResult.style.opacity = '1';
        });
        container.addEventListener('mouseleave', () => {
            zoomResult.style.opacity = '0';
        });
    });
}
document.addEventListener('DOMContentLoaded', bindImageZoom);
bindImageZoom();

(function loadEasterEggs() {
    var current = document.currentScript;
    if (!current || !current.src || document.querySelector('script[data-pixelis-eggs]')) return;
    var eggs = document.createElement('script');
    eggs.src = new URL('easter-eggs.js', current.src).href;
    eggs.dataset.pixelisEggs = 'true';
    document.head.appendChild(eggs);
})();

