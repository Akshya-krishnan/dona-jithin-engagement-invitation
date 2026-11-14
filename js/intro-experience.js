/**
 * INTRO-EXPERIENCE.JS
 * Drives the invitation pages.
 *
 * 1. On load the watercolor painting of the couple walking to the church is
 *    "washed" onto the paper while the names are lettered into the blank sky.
 * 2. A tap dissolves the painting into the verse page: corner leaves grow in, the
 *    cross and Matthew 19:6 fade up, the bottom foliage rises and keeps swaying.
 *    The vinyl record on that page plays / pauses the song.
 * 3. "Continue" starts the song (if not already playing) and reveals the engagement
 *    ceremony invitation: the artwork sharpens into view and the text is lettered in.
 * 4. "Do you know who we are?" opens the slides: the groom, then the bride,
 *    then the last slide: scratch card, venue and wishes ("Next", a tap, a scroll
 *    or a swipe up advances).
 */

export class IntroExperience {
  constructor(audioPlayer = null) {
    this.audioPlayer = audioPlayer;

    // DOM Elements
    this.pageStack = document.getElementById('page-stack');
    this.introStage = document.getElementById('watercolor-intro-stage');
    this.introImg = document.getElementById('wc-art-img');
    this.tapPrompt = document.getElementById('wc-tap-prompt');
    this.verseStage = document.getElementById('verse-intro-stage');
    this.verseBtn = document.getElementById('verse-continue-btn');
    this.gramophone = document.getElementById('verse-gramophone');
    this.nextStage = document.getElementById('engagement-stage');
    this.engNextBtn = document.getElementById('engagement-continue-btn');
    this.weddingStage = document.getElementById('wedding-stage');
    this.weddingSlides = Array.from(document.querySelectorAll('#wedding-slides .wd-slide'));
    this.weddingDots = Array.from(document.querySelectorAll('#wedding-dots span'));
    this.weddingNextBtn = document.getElementById('wedding-next-btn');
    this.weddingIndex = 0;
    this.slideLeaveTimer = null;
    this.coupleSlide = document.querySelector('#wedding-slides .wd-slide-couple');

    // State
    this.introEnded = false;   // painting dismissed
    this.verseEnded = false;   // verse page dismissed
    this.introStartTimer = null;

    this.bindEvents();
    this.setupCoupleSlide();
    this.playIntro();
  }

  /** Marks the last slide (and stage) as scrolled once the guest scrolls down it. */
  setupCoupleSlide() {
    if (!this.coupleSlide) return;
    this.coupleSlide.addEventListener('scroll', () => {
      const scrolled = this.coupleSlide.scrollTop > 40;
      this.coupleSlide.classList.toggle('scrolled', scrolled);
      if (this.weddingStage) this.weddingStage.classList.toggle('scrolled', scrolled);
    }, { passive: true });
  }

  bindEvents() {
    // Tap anywhere on the painting (or the prompt) reveals the verse page
    if (this.introStage) {
      this.introStage.addEventListener('click', () => this.showVersePage());
    }
    if (this.tapPrompt) {
      this.tapPrompt.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showVersePage();
      });
    }

    // Vinyl record on the verse page: play / pause the song without leaving the page
    if (this.gramophone) {
      this.gramophone.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.audioPlayer) this.audioPlayer.toggle();
      });
    }

    // "Do you know who we are?" on the engagement page
    if (this.engNextBtn) {
      this.engNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showWeddingPage();
      });
    }

    // Wedding slides: "Next" (or a tap anywhere on the slide) moves to the next slide
    if (this.weddingNextBtn) {
      this.weddingNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.nextWeddingSlide();
      });
    }
    if (this.weddingStage) {
      this.weddingStage.addEventListener('click', () => this.nextWeddingSlide());

      // Scrolling down, swiping up or pressing the down arrow moves on to the next slide,
      // no tap needed (never past the last slide). If a slide is taller than the screen,
      // it first scrolls to its own bottom as normal.
      const onLastSlide = () => this.weddingIndex >= this.weddingSlides.length - 1;
      const canAdvance = () => {
        if (!this.weddingShown || onLastSlide()) return false;
        const slide = this.weddingSlides[this.weddingIndex];
        return !slide || slide.scrollTop + slide.clientHeight >= slide.scrollHeight - 4;
      };
      let lockUntil = 0;
      const advance = () => {
        const now = Date.now();
        if (now < lockUntil || !canAdvance()) return;
        lockUntil = now + 1000;               // one slide per gesture
        this.nextWeddingSlide();
      };

      // mouse wheels and trackpads send many small steps: add them up
      let wheelSum = 0, wheelTimer = null;
      this.weddingStage.addEventListener('wheel', (e) => {
        if (!canAdvance()) { wheelSum = 0; return; }
        const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        wheelSum = step > 0 ? wheelSum + step : 0;
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => { wheelSum = 0; }, 250);
        if (wheelSum > 60) { wheelSum = 0; advance(); }
      }, { passive: true });

      // swipe up: react while the finger is still moving (touchend can be cancelled by the browser)
      let touchY = null;
      this.weddingStage.addEventListener('touchstart', (e) => {
        touchY = canAdvance() ? e.touches[0].clientY : null;
      }, { passive: true });
      this.weddingStage.addEventListener('touchmove', (e) => {
        if (touchY === null) return;
        if (touchY - e.touches[0].clientY > 45) { touchY = null; advance(); }
      }, { passive: true });
      const endTouch = () => { touchY = null; };
      this.weddingStage.addEventListener('touchend', endTouch, { passive: true });
      this.weddingStage.addEventListener('touchcancel', endTouch, { passive: true });

      window.addEventListener('keydown', (e) => {
        if (!['ArrowDown', 'PageDown'].includes(e.key)) return;
        if (e.target.closest && e.target.closest('input, textarea')) return;
        if (canAdvance()) { e.preventDefault(); advance(); }
      });
    }

    // "Continue" (or a tap anywhere else on the verse page) moves to the next page
    if (this.verseStage) {
      this.verseStage.addEventListener('click', () => this.showNextPage());
    }
    if (this.verseBtn) {
      this.verseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showNextPage();
      });
    }
  }

  /** "Do you know who we are?" on the engagement page opens the slides. */
  showWeddingPage() {
    if (this.weddingShown) return;
    this.weddingShown = true;
    this.hideStage(this.nextStage, false);
    if (this.weddingStage) {
      this.weddingStage.classList.remove('at-end');
      this.showStage(this.weddingStage);
      this.setWeddingSlide(0, true);
    }
    window.dispatchEvent(new CustomEvent('weddingPageShown'));
  }

  /** Groom → bride → couple. */
  nextWeddingSlide() {
    if (!this.weddingShown) return;
    if (this.weddingIndex >= this.weddingSlides.length - 1) return;
    this.setWeddingSlide(this.weddingIndex + 1);
  }

  /** The big butterfly stays put; a few tiny ones flutter across the card when the page opens. */
  scheduleButterfly(active) {
    const stage = document.getElementById('butterfly-stage');
    if (this.bfTimer) { clearTimeout(this.bfTimer); this.bfTimer = null; }
    if (!stage) return;
    const tinies = Array.from(stage.querySelectorAll('.bf-tiny'));
    if (!active) {
      tinies.forEach((t) => t.classList.remove('fly'));
      return;
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const release = () => {
      tinies.forEach((t) => {
        t.classList.remove('fly');
        void t.offsetWidth;
        t.classList.add('fly');
      });
      // a fresh little flight now and then
      this.bfTimer = setTimeout(release, 26000);
    };
    this.bfTimer = setTimeout(release, 900);
  }

  /** The sealed envelope: the ribbon bow unties, the flap lifts and the card slides out. */
  armEnvelope() {
    const scene = document.getElementById('env-scene');
    const bow = document.getElementById('env-bow');
    if (!scene || !bow || this.envelopeArmed) return;
    if (this.envOpenTimer) clearTimeout(this.envOpenTimer);
    this.envelopeArmed = true;
    if (this.coupleSlide) this.coupleSlide.classList.add('env-sealed');

    const open = (e) => {
      if (e) e.stopPropagation();
      if (scene.classList.contains('untying') || scene.classList.contains('opened')) return;
      scene.classList.add('untying', 'flap-open');                  // both flaps start swinging open
      setTimeout(() => scene.classList.add('card-out'), 400);
      setTimeout(() => {
        scene.classList.add('opened');                              // envelope gone, names letter in
        this.releaseInvButterflies();
        if (this.coupleSlide) this.coupleSlide.classList.remove('env-sealed');
      }, 950);
      if (this.audioPlayer && !this.audioPlayer.isPlaying) this.audioPlayer.play();
    };
    bow.addEventListener('click', open);
    this.envOpenTimer = setTimeout(() => open(), 450);
    bow.addEventListener('pointerdown', (e) => e.stopPropagation());
    scene.addEventListener('click', (e) => { if (!scene.classList.contains('opened')) open(e); });
  }

  /** Small butterflies flutter across the opened invitation card, now and then. */
  releaseInvButterflies() {
    const host = document.getElementById('inv-bfs');
    if (!host) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const flies = Array.from(host.querySelectorAll('.inv-bf'));
    // two butterflies fly in once as the details appear, then the card stays with a soft flower shower
    const flowers = document.getElementById('inv-flowers');
    if (this.invBfTimer) clearTimeout(this.invBfTimer);
    this.invBfTimer = setTimeout(() => {
      flies.forEach((f) => { f.classList.remove('fly'); void f.offsetWidth; f.classList.add('fly'); });
      setTimeout(() => { if (flowers) flowers.classList.add('on'); }, 2500);
    }, 400);
  }

  setWeddingSlide(index, instant = false) {
    if (!this.weddingSlides.length) return;
    if (this.slideLeaveTimer) clearTimeout(this.slideLeaveTimer);
    const previous = this.weddingSlides[this.weddingIndex];
    this.weddingIndex = index;

    this.weddingSlides.forEach((slide, i) => {
      slide.classList.remove('leaving');
      if (i === index) {
        slide.classList.remove('active');
        void slide.offsetWidth; // restart the slide's entrance animations
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });

    if (!instant && previous && previous !== this.weddingSlides[index]) {
      previous.classList.add('leaving');
      this.slideLeaveTimer = setTimeout(() => previous.classList.remove('leaving'), 800);
    }

    this.weddingDots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    if (this.weddingNextBtn) {
      const last = this.weddingSlides.length - 1;
      const toMemories = index === last - 1;
      // the slide before the last one shows a bouncing scroll arrow instead of a text button
      this.weddingNextBtn.classList.toggle('wd-scroll-arrow', toMemories);
      this.weddingNextBtn.setAttribute('aria-label', toMemories ? 'Scroll down' : 'Next');
      this.weddingNextBtn.innerHTML = toMemories
        ? '<span class="wd-arrow-label">scroll down</span>'
        : 'Next ✦';
    }
    this.scheduleButterfly(index === this.weddingSlides.length - 1);
    if (index === this.weddingSlides.length - 1) this.armEnvelope();
    if (this.weddingStage) {
      this.weddingStage.classList.toggle('at-end', index === this.weddingSlides.length - 1);
    }
    window.dispatchEvent(new CustomEvent('weddingSlideShown', { detail: { index } }));
  }

  /**
   * Paints the watercolor artwork onto the screen.
   * The CSS animation starts only once the image has decoded so the reveal
   * never begins on an empty canvas (with a short fallback for slow networks).
   */
  playIntro() {
    this.introEnded = false;
    this.verseEnded = false;
    this.weddingShown = false;
    if (this.introStartTimer) clearTimeout(this.introStartTimer);
    this.hideStage(this.verseStage, true);
    this.hideStage(this.nextStage, true);
    this.hideStage(this.weddingStage, true);
    this.weddingSlides.forEach((s) => s.classList.remove('active', 'leaving'));
    if (this.weddingStage) this.weddingStage.classList.remove('at-end');
    this.weddingIndex = 0;

    if (!this.introStage) {
      this.showVersePage();
      return;
    }

    // Rewind the painting so the CSS animations restart from the first brush stroke
    this.introStage.classList.remove('intro-hidden', 'playing');
    void this.introStage.offsetWidth; // force reflow so the animations restart

    let started = false;
    const start = () => {
      if (started || this.introEnded) return;
      started = true;
      if (this.introStartTimer) clearTimeout(this.introStartTimer);
      this.introStage.classList.add('playing');
    };

    if (this.introImg && !this.introImg.complete) {
      this.introImg.addEventListener('load', start, { once: true });
      this.introImg.addEventListener('error', start, { once: true });
      this.introStartTimer = setTimeout(start, 1800);
    } else {
      start();
    }
  }

  /** The painting dissolves and the verse page animates in. */
  showVersePage() {
    if (this.introEnded) return;
    this.introEnded = true;
    if (this.introStartTimer) clearTimeout(this.introStartTimer);

    if (this.introStage) {
      this.introStage.classList.add('intro-hidden');
    }

    // The first tap is the guest's first gesture: start the song right here
    if (this.audioPlayer && !this.audioPlayer.isPlaying) {
      this.audioPlayer.play();
    }

    if (!this.verseStage) {
      this.showNextPage();
      return;
    }

    this.showStage(this.verseStage);
    window.dispatchEvent(new CustomEvent('versePageShown'));
  }

  /** "Continue": start the song and reveal the next page. */
  showNextPage() {
    if (this.verseEnded) return;
    this.verseEnded = true;
    this.introEnded = true;

    if (this.audioPlayer && !this.audioPlayer.isPlaying) {
      this.audioPlayer.play();
    }

    if (this.introStage) {
      this.introStage.classList.add('intro-hidden');
    }
    this.hideStage(this.verseStage, false);

    if (this.nextStage) {
      this.showStage(this.nextStage);
    }
    window.dispatchEvent(new CustomEvent('nextPageShown'));
  }

  showStage(stage) {
    if (!stage) return;
    if (stage.classList.contains('playing') && !stage.classList.contains('stage-hidden')) return; // already showing: never restart it
    stage.classList.remove('stage-hidden', 'playing');
    void stage.offsetWidth; // restart the CSS animations from the beginning
    stage.classList.add('playing');
  }

  hideStage(stage, instant = false) {
    if (!stage) return;
    stage.classList.add('stage-hidden');
    if (instant) {
      stage.classList.remove('playing');
    }
  }

  replayIntro() {
    if (this.audioPlayer && this.audioPlayer.isPlaying) {
      this.audioPlayer.pause();
    }
    this.playIntro();
  }
}
