/**
 * SCRATCH-CARD.JS
 * A gold-foil scratch card on the couple slide. Guests rub the foil with a finger
 * (or the mouse) to uncover the couple's photo and the engagement date. Once most
 * of the foil is gone the rest melts away and little hearts float up.
 */

const CLEAR_AT = 0.5;       // share of the foil that must be scratched before it clears itself
const BRUSH = 22;           // scratch radius, in CSS pixels
// engagement: Thursday 7 January 2027, 5:30 PM India time (12:00 UTC)
const ENGAGEMENT_AT = Date.UTC(2027, 0, 7, 12, 0, 0);

export class ScratchCard {
  constructor() {
    this.card = document.getElementById('scratch-card');
    this.canvas = document.getElementById('scratch-foil');
    this.hearts = document.getElementById('scratch-hearts');
    this.hint = document.getElementById('scratch-hint');
    this.revealBtn = document.getElementById('scratch-reveal-btn');
    this.startCountdown();
    if (!this.card || !this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.done = false;
    this.drawing = false;
    this.last = null;
    this.strokes = 0;

    this.paint();
    this.bind();

    // repaint once the fonts have loaded so the label uses them
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (!this.done && this.strokes === 0) this.paint(); });
    }

    // repaint the foil if the card changes size before it has been scratched
    if ('ResizeObserver' in window) {
      let w = this.card.clientWidth;
      new ResizeObserver(() => {
        if (this.done || this.strokes > 0 || this.card.clientWidth === w) return;
        w = this.card.clientWidth;
        this.paint();
      }).observe(this.card);
    }
  }

  /** Live countdown to the engagement under the card. */
  startCountdown() {
    const el = (id) => document.getElementById(id);
    const days = el('cd-days'), hours = el('cd-hours'), mins = el('cd-mins'), secs = el('cd-secs');
    const title = el('cd-title'), boxes = el('cd-boxes');
    if (!days) return;
    const pad = (n) => String(n).padStart(2, '0');
    const tick = () => {
      const left = ENGAGEMENT_AT - Date.now();
      if (left <= 0) {
        if (title) title.textContent = 'We are engaged! Thank you for celebrating with us ♥';
        if (boxes) boxes.hidden = true;
        clearInterval(this.cdTimer);
        return;
      }
      const s = Math.floor(left / 1000);
      days.textContent = pad(Math.floor(s / 86400));
      hours.textContent = pad(Math.floor((s % 86400) / 3600));
      mins.textContent = pad(Math.floor((s % 3600) / 60));
      secs.textContent = pad(s % 60);
    };
    tick();
    this.cdTimer = setInterval(tick, 1000);
  }

  /** Paints the gold foil, with a soft sheen, sparkles and the "scratch here" label. */
  paint() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.card.clientWidth || 300;
    const h = this.card.clientHeight || 380;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#b8892f');
    g.addColorStop(0.25, '#f3d58a');
    g.addColorStop(0.5, '#c99a3e');
    g.addColorStop(0.75, '#f6dc96');
    g.addColorStop(1, '#a8781f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // fine foil grain
    for (let i = 0; i < (w * h) / 60; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(90,60,10,0.08)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    // sparkles
    ctx.fillStyle = 'rgba(255, 250, 230, 0.85)';
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 1.6 + 0.4;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // inner border
    ctx.strokeStyle = 'rgba(255, 248, 225, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(92, 62, 12, 0.9)';
    ctx.font = `600 ${Math.round(w * 0.06)}px 'Cormorant Garamond', Georgia, serif`;
    ctx.fillText('S C R A T C H   H E R E', w / 2, h / 2 - w * 0.07);
    ctx.font = `${Math.round(w * 0.16)}px 'Pinyon Script', 'Alex Brush', cursive`;
    ctx.fillText('♥', w / 2, h / 2 + w * 0.07);
  }

  bind() {
    const c = this.canvas;
    const stop = (e) => e.stopPropagation();
    // keep taps on the card from moving the slides
    ['click', 'pointerdown'].forEach((ev) => this.card.addEventListener(ev, stop));

    c.addEventListener('pointerdown', (e) => {
      if (this.done) return;
      this.drawing = true;
      this.last = this.point(e);
      if (c.setPointerCapture) c.setPointerCapture(e.pointerId);
      this.scratch(this.last, this.last);
      if (this.hint) this.hint.classList.add('fade');
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.drawing || this.done) return;
      const p = this.point(e);
      this.scratch(this.last, p);
      this.last = p;
    });
    const end = () => {
      if (!this.drawing) return;
      this.drawing = false;
      this.last = null;
      this.check();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', end);

    if (this.revealBtn) {
      this.revealBtn.addEventListener('click', (e) => { e.stopPropagation(); this.reveal(); });
    }
  }

  point(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  scratch(a, b) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = BRUSH * 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y);
    ctx.stroke();
    this.strokes++;
    if (this.strokes % 12 === 0) this.check();
  }

  /** Measures how much foil is gone (sampling every 8th pixel). */
  check() {
    if (this.done) return;
    const { width, height } = this.canvas;
    let data;
    try { data = this.ctx.getImageData(0, 0, width, height).data; } catch (e) { return; }
    let clear = 0, total = 0;
    for (let i = 3; i < data.length; i += 32) { total++; if (data[i] < 40) clear++; }
    if (total && clear / total >= CLEAR_AT) this.reveal();
  }

  reveal() {
    if (this.done) return;
    this.done = true;
    this.card.classList.add('revealed');
    if (this.hint) this.hint.classList.add('fade');
    if (this.revealBtn) this.revealBtn.hidden = true;
    this.floatHearts();
  }

  floatHearts() {
    if (!this.hearts) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#e8475f', '#f08a9b', '#d4a24a', '#f6c1cb'];
    for (let i = 0; i < 18; i++) {
      const h = document.createElement('span');
      h.textContent = '♥';
      h.style.left = (5 + Math.random() * 90) + '%';
      h.style.color = colors[i % colors.length];
      h.style.fontSize = (14 + Math.random() * 16) + 'px';
      h.style.animationDelay = (Math.random() * 0.9) + 's';
      h.style.animationDuration = (2.4 + Math.random() * 1.6) + 's';
      this.hearts.appendChild(h);
    }
    setTimeout(() => { this.hearts.innerHTML = ''; }, 5200);
  }
}
