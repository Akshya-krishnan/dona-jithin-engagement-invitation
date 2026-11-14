/**
 * MAIN.JS
 * Dona & Jithin engagement invitation: the painting intro, the verse page and the song.
 */

import { BackgroundMusic } from './audio-player.js';
import { IntroExperience } from './intro-experience.js';
import { ScratchCard } from './scratch-card.js';
import { HeartHunt } from './heart-hunt.js';
import { Finale } from './finale.js';

// Phones resize the viewport as the browser bar slides in and out, which reflows and
// stutters every page. Keep the layout at the height of the initial viewport, only
// updating on a real orientation change.
(() => {
  const root = document.documentElement;
  let lastW = 0;
  const set = () => { root.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px'); lastW = window.innerWidth; };
  set();
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) > 80) set(); });
  window.addEventListener('orientationchange', () => setTimeout(set, 250));
})();

document.addEventListener('DOMContentLoaded', () => {
  if (window.__jdBooted) return;        // guard against the script running twice (e.g. dev hot reload)
  window.__jdBooted = true;
  const music = new BackgroundMusic();   // starts as soon as the link opens (or on the first touch)
  new IntroExperience(music);
  const coupleSlide = document.querySelector('#wedding-slides .wd-slide-couple');
  new ScratchCard();
  new HeartHunt({ scrollContainer: coupleSlide });
  new Finale({ scrollContainer: coupleSlide });
  pauseWhenOffscreen(['.wd-scratch', '.wd-hunt', '.fin-venues', '.fin-greet', '.fin-thanks']);
  console.log('Dona & Jithin invitation loaded');
});

/**
 * Pauses the animations of each section while it is scrolled out of view
 * (adds .is-offscreen), so the phone only animates what the guest can see.
 */
function pauseWhenOffscreen(selectors) {
  const els = selectors.flatMap((s) => Array.from(document.querySelectorAll(s)));
  if (!('IntersectionObserver' in window) || !els.length) return;
  els.forEach((el) => el.classList.add('is-offscreen'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('is-offscreen', !e.isIntersecting));
  }, { rootMargin: '120px 0px' });
  els.forEach((el) => io.observe(el));
}
