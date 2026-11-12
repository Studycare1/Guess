/* ═══════════════════════════════════════════
   BOOK VIEWER — Advanced Features
   ═══════════════════════════════════════════ */

const REPO = 'studycare1/Guess';
const BRANCH = 'main';
const API = `https://api.github.com/repos/${REPO}`;
const CACHE_TTL = 5 * 60 * 1000;
const $ = id => document.getElementById(id);

const params = new URLSearchParams(location.search);
const subjectId = params.get('subject') || 'biology';

let pages = [];
let current = 1;
let zoom = 1;
let rotation = 0;
let subjectMeta = null;
let slideshowTimer = null;
let isSlideshow = false;
let bookmarks = [];

/* ───── THEME ───── */
function applyTheme(t) {
  let actual = t;
  if (t === 'auto') {
    actual = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.dataset.theme = actual;
}
function initTheme() {
  applyTheme(localStorage.getItem('theme') || 'dark');
}

/* ───── TOAST ───── */
function toast(msg) {
  let t = $('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ───── BOOKMARKS ───── */
function loadBookmarks() {
  try { bookmarks = JSON.parse(localStorage.getItem(`bm_${subjectId}`) || '[]'); }
  catch { bookmarks = []; }
}
function saveBookmarks() {
  localStorage.setItem(`bm_${subjectId}`, JSON.stringify(bookmarks));
}
function toggleBookmark() {
  const i = bookmarks.indexOf(current);
  if (i >= 0) {
    bookmarks.splice(i, 1);
    toast('🔖 Bookmark हटाया');
  } else {
    bookmarks.push(current);
    toast('🔖 Page bookmark किया');
  }
  saveBookmarks();
  updateBookmarkBtn();
}
function updateBookmarkBtn() {
  const btn = $('bookmarkBtn');
  if (!btn) return;
  const has = bookmarks.includes(current);
  btn.textContent = has ? '🔖' : '🔖';
  btn.classList.toggle('active', has);
  btn.title = has ? 'Remove bookmark' : 'Bookmark this page';
}

/* ───── LOAD SUBJECT META ───── */
async function loadMeta() {
  try {
    const data = await fetch('data/subjects.json').then(r => r.json());
    subjectMeta = data.subjects.find(s => s.id === subjectId) || data.subjects[0];
    $('title').textContent = `${subjectMeta.icon} ${subjectMeta.name_hi}`;
    document.title = `${subjectMeta.name_hi} – Guess Paper`;
    document.documentElement.style.setProperty('--accent', subjectMeta.color);
    document.documentElement.style.setProperty('--accent-glow', subjectMeta.color + '80');
  } catch {
    $('title').textContent = subjectId;
  }
}

/* ───── LOAD PAGES ───── */
async function loadPages() {
  const key = `pages_${subjectId}`;
  const t = localStorage.getItem(key + '_t');
  const cached = localStorage.getItem(key);

  if (cached && t && Date.now() - +t < CACHE_TTL) {
    pages = JSON.parse(cached);
  } else {
    try {
      const res = await fetch(`${API}/contents/images/${subjectId}?ref=${BRANCH}`);
      if (!res.ok) throw new Error('No folder');
      const data = await res.json();
      pages = data
        .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map((f, i) => ({ page: i + 1, name: f.name, image: f.download_url, path: f.path }));
      localStorage.setItem(key, JSON.stringify(pages));
      localStorage.setItem(key + '_t', Date.now());
    } catch (e) {
      showError();
      return false;
    }
  }

  if (!pages.length) { showError(); return false; }
  $('pageInput').max = pages.length;
  renderThumbs();
  return true;
}

/* ───── SHOW PAGE ───── */
function show(n, skipPreload) {
  if (!pages.length) return;
  current = Math.max(1, Math.min(n, pages.length));
  const p = pages[current - 1];
  const img = $('pageImg');
  img.style.opacity = 0;
  img.onload = () => { img.style.opacity = 1; };
  img.src = p.image;
  applyTransform();

  $('pageNum').textContent = `Page ${current} / ${pages.length}`;
  $('pageInfo').textContent = `${current} / ${pages.length}`;
  $('pageInput').value = current;
  $('prev').disabled = current === 1;
  $('next').disabled = current === pages.length;

  localStorage.setItem(`last_${subjectId}`, current);
  $('progressFill').style.width = (current / pages.length * 100) + '%';

  document.querySelectorAll('.thumb').forEach((t, i) => {
    t.classList.toggle('active', i === current - 1);
  });
  const active = document.querySelector('.thumb.active');
  if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

  updateBookmarkBtn();
  updateUrl();
  if (!skipPreload) preloadAdjacent();
}

/* ───── PRELOAD ───── */
function preloadAdjacent() {
  const pre = (i) => {
    if (i < 0 || i >= pages.length) return;
    const img = new Image();
    img.src = pages[i].image;
  };
  pre(current - 2);
  pre(current);
  pre(current + 1);
  pre(current + 2);
}

/* ───── TRANSFORM ───── */
function applyTransform() {
  $('pageImg').style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
  $('zoomLevel').textContent = Math.round(zoom * 100) + '%';
}

/* ───── URL SYNC ───── */
function updateUrl() {
  try {
    const url = new URL(location.href);
    url.searchParams.set('page', current);
    history.replaceState(null, '', url);
  } catch {}
}

/* ───── THUMBNAILS ───── */
function renderThumbs() {
  const strip = $('thumbs');
  if (!strip) return;
  strip.innerHTML = pages.map((p, i) => `
    <div class="thumb${i === current - 1 ? ' active' : ''}" data-i="${i}" title="${p.name}">
      <img src="${p.image}" loading="lazy" alt="Page ${p.page}">
      <span>${p.page}</span>
    </div>`).join('');
  strip.querySelectorAll('.thumb').forEach(t => {
    t.onclick = () => show(+t.dataset.i + 1);
  });
}

/* ───── ERROR ───── */
function showError() {
  const b = document.querySelector('.book');
  if (!b) return;
  b.innerHTML = `<div class="empty">
    <div style="font-size:52px;margin-bottom:14px">📂</div>
    इस विषय में अभी कोई images नहीं हैं।<br><br>
    <code>images/${subjectId}/</code> folder में images upload करें।
  </div>`;
  $('pageInput')?.setAttribute('disabled', '');
  ['prev', 'next', 'goBtn', 'zoomIn', 'zoomOut', 'zoomReset', 'rotateBtn',
   'fullscreenBtn', 'bookmarkBtn', 'slideshowBtn', 'downloadBtn', 'shareBtn']
    .forEach(id => $(id)?.setAttribute('disabled', ''));
}

/* ───── SLIDESHOW ───── */
function toggleSlideshow() {
  if (isSlideshow) {
    clearInterval(slideshowTimer);
    isSlideshow = false;
    $('slideshowBtn').classList.remove('active');
    $('slideshowBtn').textContent = '▶️';
    toast('Slideshow बंद');
  } else {
    isSlideshow = true;
    $('slideshowBtn').classList.add('active');
    $('slideshowBtn').textContent = '⏸️';
    toast('▶️ Slideshow चालू (3s)');
    slideshowTimer = setInterval(() => {
      if (current < pages.length) show(current + 1);
      else show(1);
    }, 3000);
  }
}

/* ───── FULLSCREEN ───── */
function toggleFullscreen() {
  const book = $('book');
  if (!document.fullscreenElement) {
    book.requestFullscreen?.().catch(() => toast('Fullscreen not supported'));
  } else {
    document.exitFullscreen?.();
  }
}

/* ───── DOWNLOAD ───── */
async function downloadPage() {
  const p = pages[current - 1];
  if (!p) return;
  try {
    const a = document.createElement('a');
    a.href = p.image;
    a.download = `${subjectId}_page-${current}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('⬇️ Download शुरू');
  } catch {
    toast('Download fail');
  }
}

/* ───── SHARE ───── */
async function sharePage() {
  const url = `${location.origin}${location.pathname}?subject=${subjectId}&page=${current}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `Page ${current} – ${subjectId}`, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast('🔗 Link copy हो गया');
    }
  } catch {}
}

/* ───── HELP MODAL ───── */
function openHelp() { $('helpOverlay')?.classList.add('show'); }
function closeHelp() { $('helpOverlay')?.classList.remove('show'); }

/* ───── BIND CONTROLS ───── */
function bindControls() {
  $('prev').onclick = () => show(current - 1);
  $('next').onclick = () => show(current + 1);

  $('goBtn').onclick = () => {
    const n = parseInt($('pageInput').value);
    if (n) show(n);
  };
  $('pageInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('goBtn').click();
  });

  $('zoomIn').onclick = () => { zoom = Math.min(zoom + 0.2, 3); applyTransform(); };
  $('zoomOut').onclick = () => { zoom = Math.max(zoom - 0.2, 0.5); applyTransform(); };
  $('zoomReset').onclick = () => { zoom = 1; rotation = 0; applyTransform(); };
  $('rotateBtn').onclick = () => { rotation = (rotation + 90) % 360; applyTransform(); };
  $('fullscreenBtn').onclick = toggleFullscreen;
  $('bookmarkBtn').onclick = toggleBookmark;
  $('slideshowBtn').onclick = toggleSlideshow;
  $('downloadBtn').onclick = downloadPage;
  $('shareBtn').onclick = sharePage;
  $('helpBtn').onclick = openHelp;
  $('helpClose').onclick = closeHelp;
  $('helpOverlay').onclick = e => {
    if (e.target.id === 'helpOverlay') closeHelp();
  };

  // Double-tap / double-click to zoom
  const img = $('pageImg');
  let lastTap = 0;
  img.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      zoom = zoom === 1 ? 1.8 : 1;
      applyTransform();
    }
    lastTap = now;
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case 'ArrowLeft': show(current - 1); break;
      case 'ArrowRight': show(current + 1); break;
      case 'Home': show(1); break;
      case 'End': show(pages.length); break;
      case '+': case '=': zoom = Math.min(zoom + 0.2, 3); applyTransform(); break;
      case '-': zoom = Math.max(zoom - 0.2, 0.5); applyTransform(); break;
      case '0': zoom = 1; rotation = 0; applyTransform(); break;
      case 'r': case 'R': rotation = (rotation + 90) % 360; applyTransform(); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'b': case 'B': toggleBookmark(); break;
      case 's': case 'S': toggleSlideshow(); break;
      case 'd': case 'D': downloadPage(); break;
      case '?': openHelp(); break;
      case 'Escape': closeHelp(); break;
    }
  });

  // Touch swipe
  let sx = 0, sy = 0, lastTouch = 0;
  const book = $('book');
  book.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    lastTouch = Date.now();
  }, { passive: true });
  book.addEventListener('touchend', e => {
    const dx = sx - e.changedTouches[0].clientX;
    const dy = sy - e.changedTouches[0].clientY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      show(dx > 0 ? current + 1 : current - 1);
    }
  }, { passive: true });

  // Fullscreen change
  document.addEventListener('fullscreenchange', () => {
    const btn = $('fullscreenBtn');
    if (btn) btn.textContent = document.fullscreenElement ? '⛶' : '⛶';
  });
}

/* ───── INIT ───── */
async function init() {
  initTheme();
  loadBookmarks();
  await loadMeta();
  const ok = await loadPages();
  bindControls();
  if (!ok) return;

  // Restore page from URL or last
  const urlPage = parseInt(params.get('page'));
  const lastPage = parseInt(localStorage.getItem(`last_${subjectId}`) || '1');
  const startPage = urlPage || lastPage || 1;
  show(Math.min(startPage, pages.length));
}

init();
