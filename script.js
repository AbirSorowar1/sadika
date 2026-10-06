/* ===== Easy-to-change settings ===== */
const CONFIG = {
  profile: 'profile.jpg',            // change this path to swap the portrait
  cv: 'Sadika-Islam-CV.pdf'          // change this path to point at the CV PDF
};

(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const book = $('#book'), tilt = $('#tilt'), ui = $('#ui'), counter = $('#counter'), pagesRoot = $('#pages');
  const mobile = matchMedia('(max-width:860px),(max-aspect-ratio:11/10)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const ORDER = ['contents', 'about', 'education', 'training', 'skills', 'languages', 'personal', 'contact', 'thanks', 'closing'];
  let sheets = [], f = 0, maxF = 0, lock = false, soundOn = false, ac;

  /* ---- Setup: profile image + CV links ---- */
  pagesRoot.querySelectorAll('[data-cv]').forEach(a => a.href = CONFIG.cv);
  $('.ui [data-cv]').href = CONFIG.cv;
  pagesRoot.querySelectorAll('img[data-profile]').forEach(img => {
    img.src = CONFIG.profile;
    img.addEventListener('error', () => { // graceful fallback if the image is missing
      const d = document.createElement('div'); d.className = 'fb'; d.textContent = 'S'; img.replaceWith(d);
    });
  });

  /* ---- Build the book ---- */
  const clone = id => pagesRoot.querySelector(`[data-id="${id}"]`).cloneNode(true);
  function face(cls, id) {
    const d = document.createElement('div'); d.className = 'face ' + cls;
    id ? d.appendChild(clone(id)) : d.classList.add('endpaper');
    return d;
  }
  function build() {
    book.innerHTML = '<div class="board l"></div><div class="board r"></div>';
    let defs; // [front, back] per physical sheet
    if (mobile.matches) defs = [['cover', null], ...ORDER.map(i => [i, null])];
    else {
      defs = [['cover', 'contents']];
      for (let i = 1; i < ORDER.length - 1; i += 2) defs.push([ORDER[i], ORDER[i + 1]]);
      defs.push(['closing', null]);
    }
    sheets = defs.map(([a, b], i) => {
      const s = document.createElement('div'); s.className = 'sheet';
      s.append(face(i === 0 ? 'front cover-face' : 'front', a), face('back', b));
      book.appendChild(s); return s;
    });
    maxF = sheets.length - 1; f = 0; render();
  }

  /* ---- State rendering ---- */
  function render() {
    sheets.forEach((s, i) => {
      s.classList.toggle('flipped', i < f);
      s.style.zIndex = i < f ? i : sheets.length - i;
    });
    book.classList.toggle('closed', f === 0);
    book.setAttribute('aria-label', f === 0 ? "Sadika Islam's CV book. Click to open." : 'Open book. Click right side for next page, left side for previous.');
    counter.textContent = String(f).padStart(2, '0') + ' / ' + String(maxF).padStart(2, '0');
    ui.classList.toggle('hide', f === 0);
    $('[data-act=prev]').disabled = f === 0;
    $('[data-act=next]').disabled = f === maxF;
  }

  /* ---- Navigation ---- */
  function turn(dir) {
    if (lock) return;
    const target = dir > 0 ? f : f - 1, s = sheets[target];
    if (!s || (dir > 0 && f >= maxF) || (dir < 0 && f <= 0)) return;
    lock = true; f += dir; sfx();
    s.classList.add('turning'); render();
    setTimeout(() => { s.classList.remove('turning'); lock = false; }, reduced ? 20 : 650);
    setTimeout(() => s.classList.remove('turning'), 1100);
  }
  async function goTo(n) { // flip step by step (used by START AGAIN)
    while (f !== n) { turn(f < n ? 1 : -1); await new Promise(r => setTimeout(r, reduced ? 40 : 220)); }
  }

  /* ---- Page-turn sound (synthesised, only after user opts in) ---- */
  function sfx() {
    if (!soundOn) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const n = ac.sampleRate * .3, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
      const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf; flt.type = 'bandpass'; flt.frequency.value = 2200; g.gain.value = .22;
      src.connect(flt).connect(g).connect(ac.destination); src.start();
    } catch (e) { /* audio unavailable */ }
  }

  /* ---- Events ---- */
  book.addEventListener('click', e => {
    if (e.target.closest('a,button')) return;
    if (f === 0) return turn(1);
    const r = book.getBoundingClientRect();
    turn(e.clientX > r.left + r.width / 2 ? 1 : -1);
  });
  book.addEventListener('keydown', e => { if (f === 0 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); turn(1); } });
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') turn(1);
    if (e.key === 'ArrowLeft') turn(-1);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'next') turn(1);
    if (a === 'prev') turn(-1);
    if (a === 'restart') goTo(0);
    if (a === 'sound') {
      soundOn = !soundOn; b.textContent = soundOn ? '🔊' : '🔇';
      b.setAttribute('aria-pressed', soundOn); b.setAttribute('aria-label', soundOn ? 'Turn page sound off' : 'Turn page sound on');
    }
  });
  let tx = 0, ty = 0; // swipe support (ignores vertical scrolling)
  book.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  book.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
  });
  // Layout switched (rotate / resize): rebuild but keep the reader on the same page
  mobile.addEventListener('change', () => {
    const old = f; book.classList.add('instant'); build();
    if (old) f = mobile.matches ? Math.min(2 * old - 1, maxF) : Math.ceil(old / 2);
    render(); requestAnimationFrame(() => requestAnimationFrame(() => book.classList.remove('instant')));
  });

  /* ---- Subtle mouse tilt ---- */
  if (!reduced) {
    addEventListener('mousemove', e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      tilt.style.transform = `rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`;
    });
  }

  /* ---- Dust particles ---- */
  if (!reduced) {
    const dust = $('#dust');
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('i');
      p.style.cssText = `left:${Math.random() * 100}%;animation-duration:${14 + Math.random() * 18}s;animation-delay:${-Math.random() * 20}s`;
      dust.appendChild(p);
    }
  }

  /* ---- Init ---- */
  build();
  setTimeout(() => $('#loader').classList.add('done'), reduced ? 300 : 3600);
})();