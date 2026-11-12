/* ═══════════════════════════════════════════
   HOME PAGE — Advanced Features
   ═══════════════════════════════════════════ */

const REPO = 'studycare1/Guess';
const BRANCH = 'main';
const API = `https://api.github.com/repos/${REPO}`;
const CACHE_TTL = 5 * 60 * 1000;

const $ = id => document.getElementById(id);
const debounce = (fn, ms = 220) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

let subjects = [];
let counts = {};
let sortMode = 'default';
let showEmpty = true;

/* ───── THEME MANAGER ───── */
const THEMES = ['dark', 'light', 'auto'];

function applyTheme(t) {
  let actual = t;
  if (t === 'auto') {
    actual = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.dataset.theme = actual;
  const btn = $('themeToggle');
  if (btn) {
    btn.textContent = t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '🌓';
    btn.title = `Theme: ${t} (click to change)`;
  }
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if ((localStorage.getItem('theme') || 'dark') === 'auto') applyTheme('auto');
  });
}

function cycleTheme() {
  const cur = localStorage.getItem('theme') || 'dark';
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  localStorage.setItem('theme', next);
  applyTheme(next);
  toast(next === 'dark' ? '🌙 Dark' : next === 'light' ? '☀️ Light' : '🌓 Auto');
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
  t._timer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ───── RECENTLY VIEWED ───── */
function getRecent() {
  try { return JSON.parse(localStorage.getItem('recent_subjects') || '[]'); }
  catch { return []; }
}

function renderRecent() {
  const wrap = $('recentWrap');
  if (!wrap) return;
  const recent = getRecent();
  if (!recent.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  const list = $('recentList');
  list.innerHTML = recent.slice(0, 6).map(id => {
    const s = subjects.find(x => x.id === id);
    if (!s) return '';
    return `<a href="subject.html?subject=${id}" class="recent-item">
      <span>${s.icon}</span><span>${s.name_hi}</span>
    </a>`;
  }).join('');
}

/* ───── STATS ───── */
function updateStats() {
  const totalSub = subjects.length;
  const totalPages = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalCount = Object.keys(counts).length;
  if ($('statSubjects')) $('statSubjects').textContent = totalSub;
  if ($('statPages')) $('statPages').textContent = totalPages;
  if ($('statLoaded')) $('statLoaded').textContent = `${totalCount}/${totalSub}`;
}

/* ───── RENDER SUBJECTS ───── */
function renderSubjects(filter = '') {
  const grid = $('subjects');
  if (!grid) return;
  const q = filter.trim().toLowerCase();

  let list = subjects.filter(s => !q ||
    s.name.toLowerCase().includes(q) ||
    (s.name_hi || '').includes(q) ||
    s.id.includes(q) ||
    (s.group || '').toLowerCase().includes(q)
  );

  if (!showEmpty) {
    list = list.filter(s => (counts[s.id] || 0) > 0);
  }

  // Sort
  if (sortMode === 'name') {
    list.sort((a, b) => a.name_hi.localeCompare(b.name_hi));
  } else if (sortMode === 'pages-high') {
    list.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  } else if (sortMode === 'pages-low') {
    list.sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0));
  }

  if (!list.length) {
    grid.innerHTML = `<div class="empty glass" style="grid-column:1/-1;padding:50px">
      ${q ? `कोई विषय नहीं मिला "<b>${filter}</b>"` : 'कोई विषय उपलब्ध नहीं'}
    </div>`;
    return;
  }

  grid.innerHTML = list.map((s, i) => {
    const n = counts[s.id];
    const cLabel = n == null ? 'लोड…' : n ? `${n} pages` : 'खाली';
    const emptyClass = n === 0 ? 'empty-count' : '';
    return `<a href="subject.html?subject=${s.id}" class="card" style="--c:${s.color};animation-delay:${i * 40}ms">
      ${s.group ? `<span class="badge-group">${s.group}</span>` : ''}
      <span class="icon">${s.icon}</span>
      <div class="name">${s.name_hi}</div>
      <div class="sub">${s.name}</div>
      <div class="count ${emptyClass}" data-count="${s.id}">${cLabel}</div>
    </a>`;
  }).join('');

  // Mouse tracking for glow
  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* ───── LOAD PAGE COUNTS ───── */
async function loadCounts(force = false) {
  const key = 'tree_cache';
  const timeKey = key + '_t';
  const cached = localStorage.getItem(key);
  const t = localStorage.getItem(timeKey);
  let tree = null;

  if (!force && cached && t && Date.now() - +t < CACHE_TTL) {
    tree = JSON.parse(cached);
  } else {
    try {
      const res = await fetch(`${API}/git/trees/${BRANCH}?recursive=1`);
      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();
      tree = data.tree.map(x => x.path);
      localStorage.setItem(key, JSON.stringify(tree));
      localStorage.setItem(timeKey, Date.now());
    } catch (e) {
      toast('Page counts load नहीं हो पाए');
      return;
    }
  }
  if (!tree) return;

  subjects.forEach(s => {
    counts[s.id] = tree.filter(p =>
      p.startsWith(`images/${s.id}/`) && /\.(jpg|jpeg|png|webp|gif)$/i.test(p)
    ).length;
  });

  // Update UI
  document.querySelectorAll('[data-count]').forEach(el => {
    const n = counts[el.dataset.count] || 0;
    el.textContent = n ? `${n} pages` : 'खाली';
    el.classList.toggle('empty-count', !n);
  });
  updateStats();
}

/* ───── BIND UI ───── */
function bindUI() {
  $('search')?.addEventListener('input', debounce(e => renderSubjects(e.target.value)));
  $('themeToggle')?.addEventListener('click', cycleTheme);
  $('sortSelect')?.addEventListener('change', e => {
    sortMode = e.target.value;
    renderSubjects($('search')?.value || '');
  });
  $('showEmptyBtn')?.addEventListener('click', () => {
    showEmpty = !showEmpty;
    $('showEmptyBtn').textContent = showEmpty ? 'सभी दिखाएँ' : 'केवल भरे हुए';
    $('showEmptyBtn').classList.toggle('active', !showEmpty);
    renderSubjects($('search')?.value || '');
  });
  $('refreshBtn')?.addEventListener('click', async () => {
    toast('Counts refresh हो रहे हैं…');
    await loadCounts(true);
    renderSubjects($('search')?.value || '');
    toast('✅ Refresh complete');
  });
  $('helpBtn')?.addEventListener('click', () => openHelp());
  $('helpClose')?.addEventListener('click', () => closeHelp());
  $('helpOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'helpOverlay') closeHelp();
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== $('search')) {
      e.preventDefault();
      $('search')?.focus();
    }
    if (e.key === 'Escape') closeHelp();
  });
}

function openHelp() {
  $('helpOverlay')?.classList.add('show');
}
function closeHelp() {
  $('helpOverlay')?.classList.remove('show');
}

/* ───── INIT ───── */
async function init() {
  initTheme();

  try {
    const r = await fetch('data/subjects.json');
    subjects = (await r.json()).subjects;
  } catch (e) {
    subjects = [];
    toast('Subjects load नहीं हुए');
  }

  renderSubjects();
  renderRecent();
  updateStats();
  bindUI();
  await loadCounts();
  renderSubjects($('search')?.value || '');
}

init();
