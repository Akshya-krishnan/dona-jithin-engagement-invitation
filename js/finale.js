/**
 * FINALE.JS
 * The last section of the couple slide:
 *  - the finale: venue maps, a wishes wall that shows every posted greeting, thank you
 */

/**
 * Shared wishes wall: every guest sees every wish. The endpoint is the Vercel
 * function in /api/wishes.js (GET the list, POST one wish). If it can't be reached
 * (e.g. local 'npm run dev', or storage not connected yet) wishes stay on this device.
 */
const WISHES_ENDPOINT = '/api/wishes';
const WISHES_KEY = 'dj-wishes';
const REFRESH_EVERY = 30 * 1000;   // pick up other guests' new wishes

export class Finale {
  constructor({ scrollContainer = null } = {}) {
    this.scrollContainer = scrollContainer;
    this.finalSection = document.getElementById('wedding-final');
    this.form = document.getElementById('greet-form');
    this.nameInput = document.getElementById('greet-name');
    this.msgInput = document.getElementById('greet-message');
    this.sendBtn = document.getElementById('greet-send');
    this.status = document.getElementById('greet-status');
    this.chips = Array.from(document.querySelectorAll('.greet-chip'));

    this.setupReveal();
    this.setupGreetings();
  }

  /* ------------------------------------------------------------ reveal */
  setupReveal() {
    if (!this.finalSection) return;
    const targets = Array.from(this.finalSection.querySelectorAll('.fin-reveal'));
    if (!('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('in-view'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { root: this.scrollContainer, threshold: 0.2 });
    targets.forEach((t) => io.observe(t));
  }

  /* --------------------------------------------------------- greetings */
  setupGreetings() {
    if (!this.form) return;
    this.wall = document.getElementById('greet-wall');
    this.wallList = document.getElementById('greet-wall-list');
    this.wallEmpty = document.getElementById('greet-wall-empty');
    this.wallCount = document.getElementById('greet-wall-count');
    this.wishes = [];

    const stop = (e) => e.stopPropagation();
    this.form.addEventListener('click', stop);
    this.form.addEventListener('pointerdown', stop);
    if (this.wall) this.wall.addEventListener('click', stop);

    this.chips.forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.msgInput) {
          this.msgInput.value = chip.dataset.text || chip.textContent.trim();
          this.msgInput.focus();
        }
      });
    });

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.post();
    });

    this.loadWishes();
    if (WISHES_ENDPOINT) {
      setInterval(() => { if (!document.hidden) this.loadWishes(true); }, REFRESH_EVERY);
    }
  }

  setStatus(text, ok = true) {
    if (!this.status) return;
    this.status.textContent = text;
    this.status.classList.toggle('ok', ok);
    this.status.classList.toggle('err', !ok);
  }

  /* Storage: the shared store when configured, otherwise this device only */
  readLocal() {
    try { return JSON.parse(localStorage.getItem(WISHES_KEY) || '[]'); } catch (e) { return []; }
  }

  writeLocal(list) {
    try { localStorage.setItem(WISHES_KEY, JSON.stringify(list.slice(0, 300))); } catch (e) {}
  }

  async loadWishes(quiet = false) {
    if (!quiet) {
      this.wishes = this.readLocal();
      this.renderWall();
    }
    if (!WISHES_ENDPOINT) return;
    try {
      const res = await fetch(WISHES_ENDPOINT, { method: 'GET', cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const remote = await res.json();
      if (Array.isArray(remote)) {
        const before = this.wishes.length;
        this.wishes = remote
          .filter((w) => w && typeof w.message === 'string' && w.message.trim())
          .map((w) => ({ name: String(w.name || 'A well-wisher').slice(0, 60), message: String(w.message).slice(0, 500), at: Number(w.at) || Date.now() }))
          .sort((x, y) => y.at - x.at);
        this.shared = true;
        this.writeLocal(this.wishes);
        if (!quiet || this.wishes.length !== before) this.renderWall();
      }
    } catch (e) {
      // keep whatever this device remembers
    }
  }

  async post() {
    const name = (this.nameInput && this.nameInput.value.trim()) || 'A well-wisher';
    const message = (this.msgInput && this.msgInput.value.trim()) || '';
    if (!message) {
      this.setStatus('Write a few words first ♥', false);
      if (this.msgInput) this.msgInput.focus();
      return;
    }
    const wish = { name: name.slice(0, 60), message: message.slice(0, 500), at: Date.now() };

    // show it straight away, then save it to the shared wall
    this.wishes.unshift(wish);
    this.writeLocal(this.wishes);
    this.renderWall(wish);
    if (this.msgInput) this.msgInput.value = '';
    if (this.sendBtn) { this.sendBtn.disabled = true; setTimeout(() => { this.sendBtn.disabled = false; }, 1500); }
    this.setStatus('Thank you! Your wishes are on the wall ♥');
    this.burstHearts();

    if (!WISHES_ENDPOINT) return;
    try {
      const res = await fetch(WISHES_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wish.name, message: wish.message }),
      });
      if (res.ok) {
        const saved = await res.json().catch(() => null);
        if (saved && saved.at) wish.at = saved.at;
        this.writeLocal(this.wishes);
        return;
      }
      if (res.status === 400 || res.status === 429) {
        // the wall refused it: take it back off and say why
        const data = await res.json().catch(() => ({}));
        this.wishes = this.wishes.filter((w) => w !== wish);
        this.writeLocal(this.wishes);
        this.renderWall();
        if (this.msgInput) this.msgInput.value = message;
        this.setStatus(data.error || 'Could not post that. Please try again.', false);
        return;
      }
      throw new Error(res.status);
    } catch (e) {
      if (this.shared) this.setStatus('Saved on this phone. Please try posting again in a moment.', false);
    }
  }

  renderWall(fresh = null) {
    if (!this.wallList) return;
    this.wallList.innerHTML = '';
    this.wishes.slice(0, 100).forEach((w, i) => {
      const li = document.createElement('li');
      li.className = 'greet-card' + (fresh && w === fresh ? ' is-new' : '');
      li.style.setProperty('--tilt', `${((i % 3) - 1) * 1.2}deg`);
      const msg = document.createElement('p');
      msg.className = 'greet-card-msg';
      msg.textContent = w.message;
      const who = document.createElement('p');
      who.className = 'greet-card-who';
      who.textContent = `— ${w.name}`;
      const when = document.createElement('span');
      when.className = 'greet-card-when';
      when.textContent = this.timeAgo(w.at);
      who.appendChild(when);
      li.appendChild(msg);
      li.appendChild(who);
      this.wallList.appendChild(li);
    });
    if (this.wallEmpty) this.wallEmpty.hidden = this.wishes.length > 0;
    if (this.wallCount) this.wallCount.textContent = String(this.wishes.length);
  }

  timeAgo(at) {
    const diff = Math.max(0, Date.now() - at);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
    return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  burstHearts() {
    const host = document.getElementById('greet-burst');
    if (!host) return;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'greet-heart';
      s.textContent = '♥';
      s.style.left = `${10 + Math.random() * 80}%`;
      s.style.animationDelay = `${Math.random() * 0.4}s`;
      s.style.fontSize = `${14 + Math.random() * 16}px`;
      host.appendChild(s);
      setTimeout(() => s.remove(), 2600);
    }
  }
}
