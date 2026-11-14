/**
 * HEART-HUNT.JS
 * "A Little Love Hunt": five small pink hearts are hidden on the floral artwork.
 * Guests tap (or Tab + Enter) to collect them; a counter tracks progress, a wrong
 * tap gets a gentle nudge, and finding all five brings confetti, floating hearts
 * and a thank-you card with a link to the engagement details.
 *
 * Self-contained: give it the section's element ids (defaults match index.html).
 */

const TOTAL = 5;
const NUDGES = ['Keep looking ♥', 'So close…', 'Try near the flowers ♥', 'Look a little closer ♥'];

export class HeartHunt {
  constructor({ scrollContainer = null, detailsSelector = '#wedding-final' } = {}) {
    this.section = document.getElementById('heart-hunt');
    if (!this.section) return;
    this.scrollContainer = scrollContainer;
    this.detailsSelector = detailsSelector;

    this.board = document.getElementById('hunt-board');
    this.hearts = Array.from(this.section.querySelectorAll('.hh-heart'));
    this.intro = document.getElementById('hunt-intro');
    this.done = document.getElementById('hunt-done');
    this.progress = document.getElementById('hunt-progress');
    this.count = document.getElementById('hunt-count');
    this.nudge = document.getElementById('hunt-nudge');
    this.ripples = document.getElementById('hunt-ripples');
    this.confetti = document.getElementById('hunt-confetti');
    this.startBtn = document.getElementById('hunt-start');
    this.detailsBtn = document.getElementById('hunt-details');
    this.againBtn = document.getElementById('hunt-again');

    this.found = new Set();
    this.playing = false;
    this.reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    this.bind();
  }

  bind() {
    // taps inside the game never move the invitation slides
    ['click', 'pointerdown'].forEach((ev) => this.section.addEventListener(ev, (e) => e.stopPropagation()));

    this.startBtn?.addEventListener('click', () => this.start());
    this.againBtn?.addEventListener('click', () => this.reset(true));
    this.detailsBtn?.addEventListener('click', () => this.showDetails());

    this.hearts.forEach((heart) => {
      heart.addEventListener('click', (e) => {
        e.stopPropagation();
        this.collect(heart);
      });
    });

    // a tap on the artwork that misses every heart gets a gentle nudge
    this.board?.addEventListener('click', (e) => {
      if (!this.playing || e.target.closest('.hh-heart, .hh-intro, .hh-done')) return;
      this.miss(e);
    });

    this.section.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.done && !this.done.hidden) this.reset(true);
    });
  }

  start() {
    this.reset(false);
    this.playing = true;
    this.section.classList.add('is-playing');
    if (this.intro) this.intro.hidden = true;
    if (this.progress) this.progress.hidden = false;
    this.hearts.forEach((h) => { h.disabled = false; h.tabIndex = 0; });
    this.say('Tap the hidden hearts ♥');
    this.chime([660], 0.05);
  }

  /** Puts everything back as it was; with `play` it starts a fresh round straight away. */
  reset(play) {
    this.found.clear();
    this.playing = false;
    this.section.classList.remove('is-playing', 'is-complete');
    this.hearts.forEach((h) => {
      h.classList.remove('found');
      h.disabled = true;
      h.tabIndex = -1;
      h.setAttribute('aria-pressed', 'false');
    });
    if (this.count) this.count.textContent = '0';
    if (this.progress) this.progress.hidden = true;
    if (this.done) this.done.hidden = true;
    if (this.intro) this.intro.hidden = false;
    if (this.confetti) this.confetti.innerHTML = '';
    this.say('');
    if (play) this.start();
  }

  collect(heart) {
    if (!this.playing) return;
    const i = Number(heart.dataset.index);
    if (this.found.has(i)) return;            // each heart counts once
    this.found.add(i);
    heart.classList.add('found');
    heart.disabled = true;
    heart.setAttribute('aria-pressed', 'true');
    heart.setAttribute('aria-label', `Heart ${i + 1} found`);

    const n = this.found.size;
    if (this.count) this.count.textContent = String(n);
    this.progress?.classList.remove('bump');
    void this.progress?.offsetWidth;
    this.progress?.classList.add('bump');
    this.chime([784, 988, 1175].slice(0, 1 + (n % 3)), 0.07);

    if (n === TOTAL) {
      this.say('');
      setTimeout(() => this.complete(), 650);
    } else {
      this.say(n === TOTAL - 1 ? 'Just one more! ♥' : `Lovely! ${TOTAL - n} more to find ♥`);
      // move keyboard focus to the next heart still hidden
      const next = this.hearts.find((h) => !h.classList.contains('found'));
      if (document.activeElement === heart && next) next.focus({ preventScroll: true });
    }
  }

  miss(e) {
    const r = this.board.getBoundingClientRect();
    if (this.ripples && !this.reduceMotion) {
      const dot = document.createElement('span');
      dot.className = 'hh-ripple';
      dot.style.left = `${e.clientX - r.left}px`;
      dot.style.top = `${e.clientY - r.top}px`;
      this.ripples.appendChild(dot);
      setTimeout(() => dot.remove(), 700);
    }
    this.say(NUDGES[Math.floor(Math.random() * NUDGES.length)]);
  }

  complete() {
    this.playing = false;
    this.section.classList.add('is-complete');
    if (this.progress) this.progress.hidden = true;
    this.chime([784, 988, 1175, 1568], 0.08, 0.12);
    this.celebrate();
    if (this.done) {
      this.done.hidden = false;
      this.detailsBtn?.focus({ preventScroll: true });
    }
  }

  celebrate() {
    if (!this.confetti || this.reduceMotion) return;
    this.confetti.innerHTML = '';
    const colors = ['#f2a7b8', '#e8768f', '#ffd6df', '#d9a86c', '#fff3f5', '#c97f8f'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i');
      const heart = i % 4 === 0;
      p.className = heart ? 'hh-float-heart' : 'hh-confetto';
      if (heart) p.textContent = '♥';
      p.style.left = `${Math.random() * 100}%`;
      p.style.setProperty('--c', colors[i % colors.length]);
      p.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
      p.style.setProperty('--r', `${(Math.random() - 0.5) * 720}deg`);
      p.style.animationDelay = `${Math.random() * 0.8}s`;
      p.style.animationDuration = `${2.6 + Math.random() * 1.8}s`;
      this.confetti.appendChild(p);
    }
    setTimeout(() => { if (this.confetti) this.confetti.innerHTML = ''; }, 5200);
  }

  showDetails() {
    const target = document.querySelector(this.detailsSelector);
    if (!target) return;
    target.scrollIntoView({ behavior: this.reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  say(text) {
    if (!this.nudge) return;
    this.nudge.textContent = text;
    this.nudge.classList.toggle('on', !!text);
  }

  /** A soft music-box chime, made in the browser (no sound files). */
  chime(freqs, volume = 0.06, gap = 0.09) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = this.ac || new AC();
      if (this.ac.state === 'suspended') this.ac.resume();
      const now = this.ac.currentTime;
      freqs.forEach((f, k) => {
        const t = now + k * gap;
        const osc = this.ac.createOscillator();
        const gain = this.ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        osc.connect(gain).connect(this.ac.destination);
        osc.start(t);
        osc.stop(t + 0.65);
      });
    } catch (e) { /* sound is a nicety; never break the game */ }
  }
}
