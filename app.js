const CHAR_LIMIT = 10000;

const STOP_WORDS = new Set([
  'de','la','el','en','y','a','los','las','un','una','es','se','no','con',
  'por','su','para','al','del','lo','como','más','pero','sus','le','ya','o',
  'fue','ha','si','también','que','este','esta','estos','estas','eso','esto',
  'me','mi','te','tu','nos','les','the','and','or','of','to','in','is','it',
  'that','was','for','on','are','as','with','his','they','be','at','one',
  'have','this','from','by','not','but','had','he','she','we','an','a',
]);

// ─── DOM refs ────────────────────────────────────────────
const textarea     = document.getElementById('text-input');
const wordCountEl  = document.getElementById('word-count');
const charCountEl  = document.getElementById('char-count');
const charNoSpaces = document.getElementById('char-no-spaces');
const sentenceEl   = document.getElementById('sentence-count');
const paraEl       = document.getElementById('paragraph-count');
const readTimeEl   = document.getElementById('read-time');
const speakTimeEl  = document.getElementById('speak-time');
const uniqueEl     = document.getElementById('unique-words');
const densityList  = document.getElementById('density-list');
const charLimitTxt = document.getElementById('char-limit-text');
const progressFill = document.getElementById('progress-fill');
const ignoreSpaces = document.getElementById('ignore-spaces');
const searchInput  = document.getElementById('search-input');
const searchResult = document.getElementById('search-result');
const highlightBox = document.getElementById('highlighted-text');
const toast        = document.getElementById('toast');

// ─── Toast ───────────────────────────────────────────────
let toastTimer = null;

function showToast(msg) {
  clearTimeout(toastTimer);
  toast.classList.remove('hide');
  toast.classList.add('show');
  toast.textContent = msg;
  toastTimer = setTimeout(() => {
    toast.classList.replace('show', 'hide');
    setTimeout(() => { toast.classList.remove('hide'); toast.style.display = ''; }, 260);
  }, 2200);
}

// ─── Count-up animation ──────────────────────────────────
const prevValues = new Map();

function animateValue(el, target) {
  const key = el.id;
  const from = prevValues.get(key) ?? 0;
  prevValues.set(key, target);
  if (from === target) return;

  const duration = Math.min(400, Math.abs(target - from) * 3 + 80);
  const start = performance.now();

  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const ease = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const val = Math.round(from + (target - from) * ease);
    el.textContent = val.toLocaleString('es');
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString('es');
  }

  el.classList.add('flash');
  el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
  requestAnimationFrame(tick);
}

function setTimeEl(el, seconds) {
  let text;
  if (seconds === 0) {
    text = '—';
  } else if (seconds < 60) {
    text = `${seconds}s`;
  } else {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    text = s > 0 ? `${m}m ${s}s` : `${m} min`;
  }
  if (el.textContent !== text) {
    el.classList.add('flash');
    el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
    el.textContent = text;
  }
}

// ─── Helpers ─────────────────────────────────────────────
function getWords(text) {
  const clean = ignoreSpaces.checked ? text.replace(/\s+/g, ' ').trim() : text.trim();
  if (!clean) return [];
  return clean.match(/[\wáéíóúüñÁÉÍÓÚÜÑ]+/g) || [];
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Analysis ────────────────────────────────────────────
function analyze() {
  const raw = textarea.value;
  const words = getWords(raw);

  const wordCount      = words.length;
  const chars          = raw.length;
  const charsNoSpaces  = raw.replace(/\s/g, '').length;
  const sentences      = raw.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const paragraphs     = raw.split(/\n+/).filter(p => p.trim().length > 0).length;
  const readSec        = Math.max(0, Math.round((wordCount / 200) * 60));
  const speakSec       = Math.max(0, Math.round((wordCount / 130) * 60));
  const uniqueCount    = new Set(words.map(w => w.toLowerCase())).size;

  animateValue(wordCountEl,  wordCount);
  animateValue(charCountEl,  chars);
  animateValue(charNoSpaces, charsNoSpaces);
  animateValue(sentenceEl,   sentences);
  animateValue(paraEl,       paragraphs);
  animateValue(uniqueEl,     uniqueCount);
  setTimeEl(readTimeEl,  readSec);
  setTimeEl(speakTimeEl, speakSec);

  const pct = Math.min(100, (chars / CHAR_LIMIT) * 100);
  progressFill.style.width = pct + '%';
  progressFill.classList.toggle('warn',   pct >= 70 && pct < 90);
  progressFill.classList.toggle('danger', pct >= 90);
  charLimitTxt.textContent = `${chars.toLocaleString('es')} / ${CHAR_LIMIT.toLocaleString('es')}`;

  updateDensity(words);
  refreshHighlight();
}

// ─── Density ─────────────────────────────────────────────
function updateDensity(words) {
  const freq = {};
  words.forEach(w => {
    const lw = w.toLowerCase();
    if (!STOP_WORDS.has(lw) && lw.length > 2) freq[lw] = (freq[lw] || 0) + 1;
  });

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);

  if (!sorted.length) {
    densityList.innerHTML = '<p class="empty-msg">Escribe para ver las palabras más frecuentes.</p>';
    return;
  }

  const max = sorted[0][1];
  densityList.innerHTML = sorted.map(([word, count], i) => {
    const pct  = ((count / words.length) * 100).toFixed(1);
    const barW = Math.round((count / max) * 100);
    const delay = i * 0.04;
    return `
      <div class="density-item" style="animation-delay:${delay}s">
        <span class="density-word">
          <span class="density-rank">${i + 1}</span>${word}
        </span>
        <div class="density-bar-wrap">
          <div class="density-bar" style="width:${barW}%;animation-delay:${delay + .1}s"></div>
        </div>
        <span class="density-pct">${count}×</span>
      </div>`;
  }).join('');
}

// ─── Search & highlight ───────────────────────────────────
function refreshHighlight() {
  const term = searchInput.value.trim();
  if (!term) {
    highlightBox.innerHTML = '';
    searchResult.textContent = '';
    searchResult.classList.remove('visible');
    return;
  }
  doSearch(term);
}

function doSearch(term) {
  const text = textarea.value;
  if (!term || !text) {
    highlightBox.innerHTML = '';
    searchResult.textContent = '';
    searchResult.classList.remove('visible');
    return;
  }

  const regex = new RegExp(escapeRegex(term), 'gi');
  const matches = text.match(regex);
  const count = matches ? matches.length : 0;

  if (count > 0) {
    searchResult.textContent = `${count} ocurrencia${count !== 1 ? 's' : ''} de "${term}"`;
  } else {
    searchResult.textContent = `Sin resultados para "${term}"`;
  }
  searchResult.classList.add('visible');

  if (count === 0) { highlightBox.innerHTML = ''; return; }

  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  highlightBox.innerHTML = safe.replace(
    new RegExp(escapeRegex(term), 'gi'),
    m => `<mark>${m}</mark>`
  );
}

// ─── Button events ────────────────────────────────────────
textarea.addEventListener('input', analyze);
ignoreSpaces.addEventListener('change', analyze);

document.getElementById('btn-clear').addEventListener('click', () => {
  textarea.value = '';
  searchInput.value = '';
  analyze();
  showToast('Texto limpiado');
});

document.getElementById('btn-copy').addEventListener('click', () => {
  if (!textarea.value) return showToast('No hay texto para copiar');
  navigator.clipboard.writeText(textarea.value)
    .then(() => showToast('Copiado al portapapeles'))
    .catch(() => showToast('No se pudo acceder al portapapeles'));
});

document.getElementById('btn-paste').addEventListener('click', () => {
  navigator.clipboard.readText()
    .then(text => { textarea.value = text; analyze(); showToast('Texto pegado'); })
    .catch(() => showToast('Permiso de portapapeles denegado'));
});

document.getElementById('btn-search').addEventListener('click', () => {
  doSearch(searchInput.value.trim());
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch(searchInput.value.trim());
});

document.getElementById('btn-clear-search').addEventListener('click', () => {
  searchInput.value = '';
  searchResult.textContent = '';
  searchResult.classList.remove('visible');
  highlightBox.innerHTML = '';
});

// ─── Theme toggle ─────────────────────────────────────────
const btnTheme = document.getElementById('btn-theme');
const html     = document.documentElement;

function applyTheme(theme, animate = false) {
  if (animate) {
    html.classList.add('theme-transition');
    setTimeout(() => html.classList.remove('theme-transition'), 400);
  }
  html.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

// Restaurar preferencia guardada (o preferencia del sistema)
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  applyTheme(savedTheme);
} else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
  applyTheme('light');
}

btnTheme.addEventListener('click', () => {
  const current = html.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';

  // Animación de giro
  btnTheme.classList.add('spinning');
  btnTheme.addEventListener('animationend', () => btnTheme.classList.remove('spinning'), { once: true });

  applyTheme(next, true);
  showToast(next === 'light' ? 'Modo claro activado' : 'Modo oscuro activado');
});

// ─── Init ─────────────────────────────────────────────────
analyze();
