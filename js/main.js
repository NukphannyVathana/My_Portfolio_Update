/* =========================================================
   Nukphanny Vathana — Portfolio motion system
   GSAP + ScrollTrigger + Lenis, with graceful fallbacks.
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const motion = hasGsap && !reduceMotion;

  const loader = $('#loader');
  const curtain = $('#curtain');
  let lenis = null;

  $('#year').textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     Text splitting (words keep chars together so lines wrap
     on word boundaries; screen readers get the plain text)
     --------------------------------------------------------- */
  function split(el) {
    if (el.dataset.splitDone) return $$('.char', el);
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.textContent = '';

    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.append(sr);

    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    text.split(' ').forEach((word, i, arr) => {
      const w = document.createElement('span');
      w.className = 'word';
      for (const ch of word) {
        const c = document.createElement('span');
        c.className = 'char';
        c.textContent = ch;
        w.append(c);
      }
      visual.append(w);
      if (i < arr.length - 1) visual.append(' ');
    });
    el.append(visual);
    el.dataset.splitDone = '1';
    return $$('.char', el);
  }

  function splitWordsOnly(el) {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    el.innerHTML = text
      .split(' ')
      .map((w) => `<span class="word" aria-hidden="true">${w}</span>`)
      .join(' ');
    return $$('.word', el);
  }

  $$('[data-split], [data-split-reveal]').forEach(split);

  /* ---------------------------------------------------------
     Fit display type to its container width (Syne is wide,
     so the hero name and footer name are sized to fill exactly)
     --------------------------------------------------------- */
  function fitText(box, targets, maxPx) {
    if (!box) return;
    box.style.fontSize = '';
    const cs = getComputedStyle(box);
    const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const widest = Math.max(...targets.map((t) => t.getBoundingClientRect().width));
    if (!widest) return;
    box.style.fontSize = `${Math.min((parseFloat(cs.fontSize) * avail * 0.985) / widest, maxPx)}px`;
  }
  function fitDisplayType() {
    fitText($('.hero__title'), $$('.hero__line'), 230);
    const footerName = $('.footer__name');
    fitText(footerName, [$('[aria-hidden="true"]', footerName)], 260);
  }
  fitDisplayType();
  document.fonts?.ready.then(fitDisplayType);
  window.addEventListener('resize', fitDisplayType);

  /* ---------------------------------------------------------
     Mobile menu
     --------------------------------------------------------- */
  const menuToggle = $('#menu-toggle');
  const menu = $('#menu');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open && motion) {
      gsap.fromTo($$('nav a, .menu__foot a', menu),
        { yPercent: 80, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.9, stagger: 0.06, ease: 'expo.out', delay: 0.15 });
    }
  }
  menuToggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false);
  });

  /* ---------------------------------------------------------
     Anchor links (smooth via Lenis when available)
     --------------------------------------------------------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#' ? null : $(id);
    if (!target) return;
    e.preventDefault();
    if (document.body.classList.contains('menu-open')) setMenu(false);
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    if (id === '#main' || id === '#hero') return;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ---------------------------------------------------------
     Contact form → opens the visitor's email app
     --------------------------------------------------------- */
  const form = $('#contact-form');
  const status = $('#form-status');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements;
    const name = f.namedItem('name').value.trim();
    const email = f.namedItem('email').value.trim();
    const type = f.namedItem('type').value;
    const msg = f.namedItem('message').value.trim();

    let ok = true;
    [['name', name], ['email', email], ['message', msg]].forEach(([field, value]) => {
      const valid = field === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : value.length > 0;
      f.namedItem(field).closest('.field').classList.toggle('is-invalid', !valid);
      if (!valid) ok = false;
    });
    if (!ok) {
      status.textContent = 'Please complete every field with a valid email address.';
      status.className = 'form__status mono is-error';
      return;
    }
    const subject = `${type} — ${name}`;
    const body = `${msg}\n\n— ${name}\n${email}`;
    window.location.href = `mailto:nukphannyvathana@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Opening your email app… thank you for reaching out.';
    status.className = 'form__status mono is-ok';
  });

  /* ---------------------------------------------------------
     Hero particle network (canvas)
     --------------------------------------------------------- */
  function heroCanvas() {
    const canvas = $('#hero-canvas');
    const hero = $('#hero');
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, pts = [], visible = true, raf = 0;
    const mouse = { x: -9999, y: -9999 };
    const LINK = 130;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(120, Math.floor((w * h) / 13000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.5,
      }));
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 160 * 160) {
          const d = Math.sqrt(d2) || 1;
          const f = (160 - d) / 160;
          p.vx += (dx / d) * f * 0.35;
          p.vy += (dy / d) * f * 0.35;
        }
        p.vx *= 0.96; p.vy *= 0.96;
        p.vx += (Math.random() - 0.5) * 0.02;
        p.vy += (Math.random() - 0.5) * 0.02;
        p.x += p.vx + 0.06; p.y += p.vy;
        if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const o = 1 - Math.sqrt(d2) / LINK;
            ctx.strokeStyle = `rgba(238,237,232,${o * 0.14})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const mx = a.x - mouse.x, my = a.y - mouse.y;
        const md = Math.sqrt(mx * mx + my * my);
        if (md < 220) {
          ctx.strokeStyle = `rgba(200,255,46,${(1 - md / 220) * 0.45})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        ctx.fillStyle = md < 220 ? 'rgba(200,255,46,.95)' : 'rgba(238,237,232,.55)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
    }

    function start() { if (!raf) raf = requestAnimationFrame(frame); }

    resize();
    if (reduceMotion) { frame(); cancelAnimationFrame(raf); raf = 0; return; }
    start();

    window.addEventListener('resize', resize);
    hero.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      hero.style.setProperty('--gx', `${(mouse.x / r.width) * 100}%`);
      hero.style.setProperty('--gy', `${(mouse.y / r.height) * 100}%`);
    });
    hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    }).observe(hero);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) start(); });
  }
  heroCanvas();

  /* ---------------------------------------------------------
     Rotating role text with a scramble effect
     --------------------------------------------------------- */
  function roleScramble() {
    const el = $('#role-text');
    const roles = [
      'Web Developer & IT Support',
      'MIS Undergraduate · SETEC',
      'Full-Stack Web Builder',
      'Graphic & Brand Designer',
      'Cybersecurity Foundations',
    ];
    const glyphs = '!<>-_\\/[]{}—=+*^?#01ABCDEFXYZ';
    let index = 0;

    function scrambleTo(next) {
      const from = el.textContent;
      const len = Math.max(from.length, next.length);
      const queue = Array.from({ length: len }, (_, i) => {
        const start = Math.floor(Math.random() * 18);
        return { from: from[i] || '', to: next[i] || '', start, end: start + Math.floor(Math.random() * 18) + 6 };
      });
      let f = 0;
      (function tick() {
        let out = '', done = 0;
        for (const q of queue) {
          if (f >= q.end) { done++; out += q.to; }
          else if (f >= q.start) out += `<span style="opacity:.55">${glyphs[Math.floor(Math.random() * glyphs.length)]}</span>`;
          else out += q.from;
        }
        el.innerHTML = out;
        if (done < queue.length) { f++; requestAnimationFrame(tick); }
        else el.textContent = next;
      })();
    }

    setInterval(() => {
      if (document.hidden) return;
      index = (index + 1) % roles.length;
      scrambleTo(roles[index]);
    }, 3200);
  }
  if (!reduceMotion) roleScramble();

  /* ---------------------------------------------------------
     No GSAP (CDN blocked) or reduced motion → static site
     --------------------------------------------------------- */
  if (!motion) {
    loader.remove();
    curtain.remove();
    return;
  }

  /* =========================================================
     MOTION
     ========================================================= */
  gsap.registerPlugin(ScrollTrigger);
  loader.style.animation = 'none';
  curtain.style.animation = 'none';

  /* --- smooth scroll --- */
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* --- intro / loader --- */
  const loaderChars = $$('.char', $('.loader__name'));
  const loaderMeta = $$('.loader__meta, .loader__top');
  const heroChars = $$('.hero__line .char');
  const heroFades = $$('[data-hero="fade"], [data-hero="meta"] li');
  const count = $('#loader-count');
  const bar = $('#loader-bar');
  let introTl = null;

  function playIntro() {
    if (introTl) introTl.kill();
    lenis?.stop();
    window.scrollTo(0, 0);
    const counter = { v: 0 };

    introTl = gsap.timeline({
      defaults: { ease: 'expo.out' },
      onComplete: () => lenis?.start(),
    });
    introTl
      .set([loader, curtain], { yPercent: 0, autoAlpha: 1 })
      .set(['.loader__count', '.loader__bar'], { autoAlpha: 1 })
      .set(heroChars, { yPercent: 115, rotate: 7 })
      .set(heroFades, { autoAlpha: 0, y: 30 })
      .fromTo(loaderChars, { yPercent: 115 }, { yPercent: 0, duration: 1.1, stagger: 0.03 }, 0.15)
      .fromTo(loaderMeta, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12 }, 0.35)
      .to(counter, {
        v: 100, duration: 2.2, ease: 'power3.inOut',
        onUpdate: () => {
          count.textContent = Math.round(counter.v);
          bar.style.transform = `scaleX(${counter.v / 100})`;
        },
      }, 0)
      .addLabel('exit')
      .to(loaderChars, { yPercent: -115, duration: 0.6, stagger: 0.012, ease: 'expo.in' }, 'exit')
      .to([...loaderMeta, '.loader__count', '.loader__bar'], { autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 'exit')
      .to(loader, { yPercent: -100, duration: 1.05, ease: 'expo.inOut' }, 'exit+=0.45')
      .to(curtain, { yPercent: -100, duration: 1.05, ease: 'expo.inOut' }, 'exit+=0.6')
      .to(heroChars, { yPercent: 0, rotate: 0, duration: 1.4, stagger: 0.035 }, 'exit+=1.05')
      .to(heroFades, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.07 }, 'exit+=1.3')
      .set([loader, curtain], { autoAlpha: 0 });
  }

  const skipIntro = () => {
    if (introTl && introTl.time() < introTl.labels.exit) introTl.seek('exit');
  };
  $('#loader-skip').addEventListener('click', skipIntro);
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && introTl?.isActive()) skipIntro();
  });
  $('#replay-intro').addEventListener('click', playIntro);
  playIntro();

  /* --- custom cursor --- */
  if (finePointer) {
    document.documentElement.classList.add('has-cursor');
    const cursor = $('#cursor');
    const dot = $('#cursor-dot');
    const label = $('#cursor-label');
    const cx = gsap.quickTo(cursor, 'x', { duration: 0.55, ease: 'power3' });
    const cy = gsap.quickTo(cursor, 'y', { duration: 0.55, ease: 'power3' });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power3' });
    gsap.set([cursor, dot], { x: innerWidth / 2, y: innerHeight / 2 });

    window.addEventListener('pointermove', (e) => { cx(e.clientX); cy(e.clientY); dx(e.clientX); dy(e.clientY); });
    document.addEventListener('pointerover', (e) => {
      const labelled = e.target.closest('[data-cursor]');
      const hover = e.target.closest('a, button, input, textarea, select, .skill');
      cursor.classList.toggle('is-label', !!labelled);
      cursor.classList.toggle('is-hover', !labelled && !!hover);
      label.textContent = labelled ? labelled.dataset.cursor : '';
    });
    document.addEventListener('pointerleave', () => gsap.to([cursor, dot], { autoAlpha: 0, duration: 0.3 }));
    document.addEventListener('pointerenter', () => gsap.to([cursor, dot], { autoAlpha: 1, duration: 0.3 }));

    /* magnetic buttons */
    $$('.magnetic').forEach((el) => {
      const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * 0.3);
        my((e.clientY - r.top - r.height / 2) * 0.4);
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.35)' });
      });
    });

    /* 3D tilt + spotlight on skill cards */
    $$('.skill').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', `${px * 100}%`);
        card.style.setProperty('--my', `${py * 100}%`);
        gsap.to(card, { rotateY: (px - 0.5) * 10, rotateX: (0.5 - py) * 10, duration: 0.6, ease: 'power3' });
      });
      card.addEventListener('pointerleave', () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1, 0.4)' }));
    });
  }

  /* --- scroll progress + nav state --- */
  gsap.to('#progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  const nav = $('#nav');
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-scrolled', y > 40);
      nav.classList.toggle('is-hidden', self.direction === 1 && y > 300 && !document.body.classList.contains('menu-open'));
    },
  });

  /* --- hero scroll-out parallax --- */
  const heroOut = gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
  heroOut
    .to('.hero__line:not(.hero__line--outline)', { xPercent: -12, ease: 'none' }, 0)
    .to('.hero__line--outline', { xPercent: 10, ease: 'none' }, 0)
    .to('.hero__inner', { yPercent: 18, autoAlpha: 0.15, ease: 'none' }, 0)
    .to('.hero__canvas', { yPercent: 25, ease: 'none' }, 0);

  /* --- velocity-reactive marquee --- */
  const marqueeTweens = $$('.marquee__row').map((row) => {
    const track = $('.marquee__track', row);
    const base = track.innerHTML;
    for (let i = 0; i < 4 && track.scrollWidth < window.innerWidth * 1.2; i++) track.innerHTML += base;
    row.append(track.cloneNode(true));
    const dir = Number(row.dataset.dir);
    return gsap.fromTo(row,
      { xPercent: dir < 0 ? 0 : -50 },
      { xPercent: dir < 0 ? -50 : 0, duration: 40, ease: 'none', repeat: -1 });
  });
  const mq = { boost: 0, dir: 1 };
  ScrollTrigger.create({
    trigger: '.marquee',
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      mq.dir = self.direction;
      mq.boost = Math.max(mq.boost, Math.min(Math.abs(self.getVelocity()) / 250, 8));
    },
  });
  gsap.ticker.add(() => {
    mq.boost *= 0.93;
    marqueeTweens.forEach((t) => t.timeScale(mq.dir * (1 + mq.boost)));
  });
  gsap.fromTo('.marquee', { rotate: -2.5 }, {
    rotate: 1.5, ease: 'none',
    scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  /* --- generic reveals --- */
  $$('[data-split-reveal]').forEach((el) => {
    gsap.from($$('.char', el), {
      yPercent: 115, rotate: 6, duration: 1.2, stagger: 0.022, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });

  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 50, autoAlpha: 0, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  $$('.chapter').forEach((el) => {
    gsap.from(el, {
      autoAlpha: 0, x: -30, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  /* --- 01 WORK: pinned horizontal scroll (desktop) / stacked reveals (mobile) --- */
  const work = $('#work');
  const track = $('#work-track');
  const projectPanels = $$('.work__panel:not(.work__panel--intro):not(.work__panel--outro)');
  const mm = gsap.matchMedia();

  mm.add('(min-width: 900px)', () => {
    work.classList.add('is-horizontal');
    const distance = () => track.scrollWidth - window.innerWidth;

    const hTween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: work,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => { $('#work-progress').style.transform = `scaleX(${self.progress})`; },
      },
    });

    projectPanels.forEach((panel, i) => {
      const wrap = $('.project__img-wrap', panel);
      const img = $('img', panel);
      const body = [...$('.project__body', panel).children];

      ScrollTrigger.create({
        trigger: panel, containerAnimation: hTween, start: 'left center', end: 'right center',
        onToggle: (self) => { if (self.isActive) $('#work-index').textContent = String(i + 1).padStart(2, '0'); },
      });

      gsap.fromTo(wrap,
        { clipPath: 'inset(12% 40% 12% 0% round 18px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 18px)', ease: 'none',
          scrollTrigger: { trigger: panel, containerAnimation: hTween, start: 'left 95%', end: 'left 15%', scrub: true } });

      gsap.fromTo(img, { xPercent: -7 }, {
        xPercent: 7, ease: 'none',
        scrollTrigger: { trigger: panel, containerAnimation: hTween, start: 'left right', end: 'right left', scrub: true },
      });

      gsap.from(body, {
        x: 140, autoAlpha: 0, stagger: 0.05, ease: 'power2.out',
        scrollTrigger: { trigger: panel, containerAnimation: hTween, start: 'left 85%', end: 'left 25%', scrub: true },
      });

      gsap.from($('.project__title', panel), {
        letterSpacing: '0.15em', ease: 'none',
        scrollTrigger: { trigger: panel, containerAnimation: hTween, start: 'left 85%', end: 'left 15%', scrub: true },
      });
    });

    gsap.from('.work__outro-big', {
      scale: 0.6, autoAlpha: 0, ease: 'none',
      scrollTrigger: { trigger: '.work__panel--outro', containerAnimation: hTween, start: 'left right', end: 'center center', scrub: true },
    });

    return () => work.classList.remove('is-horizontal');
  });

  mm.add('(max-width: 899px)', () => {
    projectPanels.forEach((panel) => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: panel, start: 'top 80%', once: true } });
      tl.fromTo($('.project__img-wrap', panel),
          { clipPath: 'inset(100% 0% 0% 0% round 18px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 18px)', duration: 1.3, ease: 'expo.inOut' })
        .from($('img', panel), { scale: 1.4, duration: 1.6, ease: 'expo.out' }, 0.2)
        .from([...$('.project__body', panel).children], { y: 40, autoAlpha: 0, stagger: 0.07, duration: 1, ease: 'expo.out' }, 0.4);
    });
    gsap.from('.work__outro-big', {
      scale: 0.7, autoAlpha: 0, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: '.work__panel--outro', start: 'top 85%', once: true },
    });
  });

  /* --- 02 SKILLS --- */
  gsap.set('.skill', { autoAlpha: 0, y: 90, rotateX: -18 });
  ScrollTrigger.batch('.skill', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, rotateX: 0, duration: 1.3, stagger: 0.12, ease: 'expo.out' }),
  });

  /* --- 03 ABOUT --- */
  const statementWords = splitWordsOnly($('[data-scrub-words]'));
  gsap.fromTo(statementWords, { opacity: 0.12 }, {
    opacity: 1, stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: '.about__statement', start: 'top 85%', end: 'bottom 50%', scrub: true },
  });

  gsap.fromTo('.about__img-wrap',
    { clipPath: 'inset(100% 0% 0% 0% round 18px)' },
    { clipPath: 'inset(0% 0% 0% 0% round 18px)', duration: 1.6, ease: 'expo.inOut',
      scrollTrigger: { trigger: '.about__portrait', start: 'top 80%', once: true } });
  gsap.fromTo('.about__img-wrap img', { scale: 1.45 }, {
    scale: 1.1, ease: 'none',
    scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.from('.about__badge', {
    scale: 0, rotate: -180, duration: 1.4, ease: 'back.out(1.6)',
    scrollTrigger: { trigger: '.about__portrait', start: 'top 70%', once: true },
  });

  $$('.timeline').forEach((tl) => {
    gsap.to($('.timeline__line span', tl), {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: tl, start: 'top 75%', end: 'bottom 60%', scrub: true },
    });
    $$('.timeline__item', tl).forEach((item) => {
      gsap.from(item, {
        x: -40, autoAlpha: 0, duration: 1.1, ease: 'expo.out',
        scrollTrigger: { trigger: item, start: 'top 85%', once: true },
      });
    });
  });

  /* --- 04 REFERENCES --- */
  gsap.from('.ref', {
    y: 70, autoAlpha: 0, duration: 1.2, stagger: 0.15, ease: 'expo.out',
    scrollTrigger: { trigger: '.people__grid', start: 'top 85%', once: true },
  });
  gsap.from('.ref__avatar', {
    rotate: -270, scale: 0.3, duration: 1.6, stagger: 0.15, ease: 'expo.out',
    scrollTrigger: { trigger: '.people__grid', start: 'top 85%', once: true },
  });

  /* --- 05 CONTACT --- */
  gsap.fromTo('#contact-ticker', { xPercent: 5 }, {
    xPercent: -40, ease: 'none',
    scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  /* --- FOOTER --- */
  gsap.from('.footer__name .char', {
    yPercent: 100, autoAlpha: 0, duration: 1.2, stagger: 0.035, ease: 'expo.out',
    scrollTrigger: { trigger: '.footer__name', start: 'top 95%', once: true },
  });

  /* --- active nav link --- */
  $$('[data-section]').forEach((section) => {
    const link = $(`[data-nav="${section.dataset.section}"]`);
    const spacer = section.parentElement.classList.contains('pin-spacer') ? section.parentElement : section;
    ScrollTrigger.create({
      trigger: spacer,
      start: 'top center',
      end: 'bottom center',
      onToggle: (self) => {
        if (self.isActive) $$('.nav__links a').forEach((a) => a.classList.toggle('is-active', a === link));
      },
    });
  });

  /* fonts change metrics → re-measure */
  document.fonts?.ready.then(() => {
    fitDisplayType();
    ScrollTrigger.refresh();
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
