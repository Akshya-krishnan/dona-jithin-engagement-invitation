/**
 * AUDIO-PLAYER.JS
 * Background music, looped, starting as soon as the link opens.
 * To change the song: put an audio file in public/assets/audio/ and set TRACK
 * to its path (e.g. '/assets/audio/song.mp3'). With TRACK empty the site is silent
 * and the mute button is not shown.
 *
 * Browsers only allow sound after the guest has touched the page, so the player
 * tries to start immediately and, if refused, starts on the very first touch,
 * tap, scroll or key press anywhere. A small speaker button in the corner of every
 * page lets the guest mute or unmute the song; once muted, nothing restarts it.
 */

const TRACK = '/assets/audio/engagement.mp3';
const VOLUME = 0.85;

export class BackgroundMusic {
  constructor() {
    this.isPlaying = false;
    this.muted = false;
    this.fadeTimer = null;
    if (!TRACK) { this.audioEl = null; this.button = null; return; }
    this.audioEl = this.createTrack();
    this.button = this.createButton();
    this.autoStart();
  }

  createTrack() {
    const existing = document.getElementById('background-music-track');
    if (existing) return existing;
    const audio = document.createElement('audio');
    audio.id = 'background-music-track';
    audio.src = TRACK;
    audio.loop = true;
    audio.preload = 'metadata';
    audio.setAttribute('playsinline', '');
    audio.volume = 0;
    audio.style.display = 'none';
    audio.addEventListener('error', () => {
      console.warn('Background music: could not load ' + TRACK);
    });
    (document.body || document.documentElement).appendChild(audio);
    return audio;
  }

  /** Floating speaker button, shown on every page. */
  createButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'music-toggle';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path class="mt-speaker" d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/>' +
        '<path class="mt-waves" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>' +
        '<path class="mt-cross" d="M16 9.5l5 5M21 9.5l-5 5"/>' +
      '</svg>';
    ['click', 'pointerdown', 'touchstart'].forEach((ev) =>
      btn.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'click' }));
    btn.addEventListener('click', () => this.setMuted(!this.muted));
    (document.body || document.documentElement).appendChild(btn);
    this.updateButton(btn);
    return btn;
  }

  updateButton(btn = this.button) {
    if (!btn) return;
    btn.classList.toggle('is-muted', this.muted);
    btn.setAttribute('aria-pressed', String(this.muted));
    btn.setAttribute('aria-label', this.muted ? 'Unmute the song' : 'Mute the song');
    btn.title = this.muted ? 'Unmute the song' : 'Mute the song';
  }

  setMuted(muted) {
    this.muted = muted;
    this.updateButton();
    if (muted) this.pause();
    else this.play();
  }

  fadeTo(target, seconds) {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    const el = this.audioEl;
    const start = el.volume;
    const steps = Math.max(1, Math.round(seconds * 30));
    let i = 0;
    this.fadeTimer = setInterval(() => {
      i++;
      const t = Math.min(1, i / steps);
      const eased = t * t * (3 - 2 * t);
      el.volume = Math.max(0, Math.min(1, start + (target - start) * eased));
      if (t >= 1) { clearInterval(this.fadeTimer); this.fadeTimer = null; }
    }, (seconds * 1000) / steps);
  }

  play() {
    if (this.isPlaying || this.muted || !this.audioEl) return Promise.resolve();
    const p = this.audioEl.play();
    const promise = p && typeof p.then === 'function' ? p : Promise.resolve();
    return promise
      .then(() => { this.isPlaying = true; this.fadeTo(VOLUME, 2); })
      .catch(() => { this.isPlaying = false; });
  }

  pause() {
    if (!this.isPlaying || !this.audioEl) return;
    this.isPlaying = false;
    this.fadeTo(0, 0.5);
    setTimeout(() => { if (!this.isPlaying) this.audioEl.pause(); }, 550);
  }

  toggle() { this.setMuted(this.isPlaying); }

  autoStart() {
    const attempt = () => (this.isPlaying || this.muted ? Promise.resolve() : this.play());
    if (document.readyState === 'complete') attempt(); else window.addEventListener('load', attempt, { once: true });

    const events = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'];
    const onGesture = () => {
      attempt().then(() => {
        if (this.isPlaying || this.muted) events.forEach((ev) => window.removeEventListener(ev, onGesture, true));
      });
    };
    events.forEach((ev) => window.addEventListener(ev, onGesture, { capture: true, passive: true }));

    // keep playing after the guest switches apps and comes back
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isPlaying && this.audioEl.paused) this.audioEl.play().catch(() => {});
    });
  }
}
