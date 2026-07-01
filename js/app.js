// ═══════════════════════════════════════════════════════
//  Sportlife — app.js (เว็บสาธารณะ ไม่ใช้ API key ฝั่งเบราว์เซอร์)
//  ข่าว + ผลสด ดึงผ่าน Netlify Functions (proxy)
// ═══════════════════════════════════════════════════════

const CONFIG = {
  NEWS_FN:   '/.netlify/functions/news',
  SCORES_FN: '/.netlify/functions/scores',
  REFRESH_MS: 600000, // 10 นาที
};

const state = { articles: [], currentSport: 'all' };

// ── SPORT CONFIG ──
const SPORTS = {
  football:   { emoji: '⚽', label: 'ฟุตบอล' },
  boxing:     { emoji: '🥊', label: 'มวย' },
  badminton:  { emoji: '🏸', label: 'แบดมินตัน' },
  basketball: { emoji: '🏀', label: 'บาสเกตบอล' },
  volleyball: { emoji: '🏐', label: 'วอลเลย์บอล' },
  tennis:     { emoji: '🎾', label: 'เทนนิส' },
  motorsport: { emoji: '🏎️', label: 'มอเตอร์สปอร์ต' },
  mma:        { emoji: '🥋', label: 'MMA' },
};

// ลำดับหมวดกีฬาในกล่องผลการแข่งขัน
const SPORT_ORDER = [
  { key: 'football',   emoji: '⚽', label: 'ฟุตบอล' },
  { key: 'basketball', emoji: '🏀', label: 'บาสเกตบอล' },
  { key: 'badminton',  emoji: '🏸', label: 'แบดมินตัน' },
  { key: 'volleyball', emoji: '🏐', label: 'วอลเลย์บอล' },
  { key: 'tennis',     emoji: '🎾', label: 'เทนนิส' },
];

// ── DETECT SPORT ──
function detectSport(title = '', desc = '') {
  const t = (title + ' ' + desc).toLowerCase();
  if (/football|soccer|premier|liga|bundesliga|ฟุตบอล|เตะ|ลีก/.test(t)) return 'football';
  if (/basketball|nba|บาสเกตบอล/.test(t)) return 'basketball';
  if (/badminton|แบดมินตัน|bwf/.test(t)) return 'badminton';
  if (/volleyball|วอลเลย์บอล|fivb|vnl/.test(t)) return 'volleyball';
  if (/tennis|เทนนิส|wimbledon|roland|us open/.test(t)) return 'tennis';
  if (/boxing|muay|มวย|knockout/.test(t)) return 'boxing';
  if (/formula|f1|grand prix|motorsport/.test(t)) return 'motorsport';
  if (/mma|ufc|one championship/.test(t)) return 'mma';
  return 'football';
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  updateDate();
  setInterval(updateDate, 30000);
  setupNav();
  setupModal();
  loadNews();
  loadScores();
  setInterval(refreshAll, CONFIG.REFRESH_MS);
});

function updateDate() {
  const d = new Date();
  const date = d.toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const el = document.getElementById('dateDisplay');
  if (el) el.innerHTML = `${date}<br>${time}`;
}

function setupNav() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentSport = btn.dataset.sport;
      renderArticles();
    });
  });
}

async function refreshAll() {
  const btn = document.getElementById('refreshBtn');
  if (btn) { btn.textContent = '⏳ รีเฟรช...'; btn.disabled = true; }
  await Promise.all([loadNews(), loadScores()]);
  if (btn) { btn.textContent = '🔄 รีเฟรช'; btn.disabled = false; }
}

// ════════════════════════════════════════  NEWS  ════════════════════════════════════════

async function loadNews() {
  try {
    const res = await fetch(CONFIG.NEWS_FN);
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    let articles = results.map(normalizeNewsData);
    articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    state.articles = articles.length ? articles : getFallbackData();
  } catch (e) {
    state.articles = getFallbackData();
  }
  renderArticles();
  updateTicker(state.articles);
  loadTrending();
}

function normalizeNewsData(item) {
  const sport = detectSport(item.title, item.description || '');
  return {
    id: item.article_id || Math.random().toString(36).slice(2),
    title: item.title || '',
    summary: item.description || (item.content ? item.content.substring(0, 140) + '...' : ''),
    image: item.image_url || null,
    url: item.link || '#',
    source: item.source_name || 'NewsData',
    pubDate: item.pubDate || new Date().toISOString(),
    time: timeAgo(item.pubDate),
    sport, emoji: SPORTS[sport]?.emoji || '⚽',
  };
}

function renderArticles() {
  const filtered = state.currentSport === 'all'
    ? state.articles
    : state.articles.filter(a => a.sport === state.currentSport);

  const featGrid = document.getElementById('featuredGrid');
  const newsList = document.getElementById('newsList');
  if (!featGrid || !newsList) return;

  if (!filtered.length) {
    featGrid.innerHTML = `<div style="grid-column:1/3;padding:40px;text-align:center;color:var(--muted)">ไม่พบข่าวในหมวดนี้</div>`;
    newsList.innerHTML = '';
    return;
  }

  const [main, ...rest] = filtered;
  featGrid.innerHTML = `
    <div class="featured-main" onclick="openArticle('${main.id}')">
      <div class="hero-img-wrap">
        ${main.image ? `<img src="${main.image}" alt="${esc(main.title)}" loading="lazy" onerror="this.style.display='none'">` : main.emoji}
      </div>
      <div class="featured-body">
        <div class="sport-tag">${main.emoji} ${SPORTS[main.sport]?.label || main.sport}</div>
        <div class="article-title">${esc(main.title)}</div>
        <p class="article-summary">${esc(main.summary)}</p>
        <div class="article-meta"><span>🕐 ${main.time}</span><span class="source-badge">📰 ${esc(main.source)}</span></div>
      </div>
    </div>
    ${rest.slice(0, 2).map(a => `
      <div class="card-sm" onclick="openArticle('${a.id}')">
        <div class="card-img">${a.image ? `<img src="${a.image}" alt="${esc(a.title)}" loading="lazy" onerror="this.style.display='none'">` : a.emoji}</div>
        <div class="card-body">
          <div class="sport-tag">${a.emoji} ${SPORTS[a.sport]?.label || a.sport}</div>
          <div class="article-title">${esc(a.title)}</div>
          <div class="article-meta"><span>🕐 ${a.time}</span><span class="source-badge">📰 ${esc(a.source)}</span></div>
        </div>
      </div>`).join('')}
  `;

  newsList.innerHTML = rest.slice(2).map(a => `
    <div class="news-item" onclick="openArticle('${a.id}')">
      <div class="news-thumb">${a.image ? `<img src="${a.image}" alt="${esc(a.title)}" loading="lazy" onerror="this.style.display='none'">` : a.emoji}</div>
      <div class="news-body">
        <div class="sport-tag" style="margin-bottom:6px">${a.emoji} ${SPORTS[a.sport]?.label || a.sport}</div>
        <div class="news-title">${esc(a.title)}</div>
        <div class="article-meta"><span>🕐 ${a.time}</span><span class="source-badge">📰 ${esc(a.source)}</span></div>
      </div>
    </div>`).join('');
}

function updateTicker(articles) {
  const items = articles.slice(0, 12).map(a => `<span class="ticker-item">${a.emoji} ${esc(a.title)}</span>`).join('');
  const el = document.getElementById('tickerContent');
  if (el) el.innerHTML = items + items;
}

// ════════════════════════════════════════  SCORES (แบ่งหมวดกีฬา)  ════════════════════════════════════════

async function loadScores() {
  const el = document.getElementById('scoresWidget');
  if (!el) return;
  try {
    const res = await fetch(CONFIG.SCORES_FN);
    const data = await res.json();
    const m = Array.isArray(data.m) ? data.m : [];
    el.innerHTML = renderScoresGrouped(m);
  } catch (e) {
    el.innerHTML = `<div class="score-empty">โหลดผลการแข่งขันไม่สำเร็จ</div>`;
  }
}

function renderScoresGrouped(matches) {
  return SPORT_ORDER.map(sp => {
    const list = matches.filter(m => m.sport === sp.key);
    const body = list.length
      ? list.map(scoreItem).join('')
      : `<div class="score-empty">— ยังไม่มีการแข่งขันสดขณะนี้ —</div>`;
    return `<div class="score-group">
      <div class="score-group-title">${sp.emoji} ${sp.label}</div>
      ${body}
    </div>`;
  }).join('');
}

function scoreItem(m) {
  const live = String(m.st || '').includes('LIVE');
  const badgeClass = live ? 'badge-live' : (m.st === 'FT' ? 'badge-ft' : 'badge-sched');
  return `
    <div class="score-item">
      <div class="score-league">${esc(m.lg)}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1">
          <div class="score-row"><span class="score-team">${esc(m.h)}</span><span class="score-num ${m.hw ? 'win' : ''}">${m.sh ?? '-'}</span></div>
          <div class="score-row"><span class="score-team">${esc(m.a)}</span><span class="score-num ${!m.hw && m.sa > m.sh ? 'win' : ''}">${m.sa ?? '-'}</span></div>
        </div>
        <div class="match-badge ${badgeClass}">${esc(m.st)}</div>
      </div>
    </div>`;
}

// ════════════════════════════════════════  TRENDING (จากข่าว ไม่ใช้ AI)  ════════════════════════════════════════

function loadTrending() {
  const el = document.getElementById('trendingWidget');
  if (!el) return;
  const items = state.articles.slice(0, 6);
  if (!items.length) { el.innerHTML = `<div class="score-empty">—</div>`; return; }
  el.innerHTML = items.map((a, i) => `
    <div class="trend-item" onclick="openArticle('${a.id}')">
      <span class="trend-rank">${i + 1}</span>
      <span style="font-size:18px">${a.emoji}</span>
      <div><div class="trend-name">${esc(a.title.slice(0, 70))}</div><div class="trend-count">${esc(a.source)}</div></div>
    </div>`).join('');
}

// ════════════════════════════════════════  MODAL  ════════════════════════════════════════

function setupModal() {
  const overlay = document.getElementById('modalOverlay');
  const closeBtn = document.getElementById('modalClose');
  if (!overlay) return;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function openArticle(id) {
  const article = state.articles.find(a => a.id == id);
  if (!article) return;
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  overlay.classList.add('open');
  content.innerHTML = `
    <div class="sport-tag">${article.emoji} ${SPORTS[article.sport]?.label || article.sport}</div>
    <div class="modal-title">${esc(article.title)}</div>
    <div class="modal-meta"><span>🕐 ${article.time}</span><span class="source-badge">📰 ${esc(article.source)}</span></div>
    <div class="modal-body"><p>${esc(article.summary) || 'อ่านรายละเอียดเต็มได้ที่แหล่งข่าวต้นฉบับ'}</p></div>
    ${article.url && article.url !== '#' ? `<a href="${article.url}" target="_blank" rel="noopener" class="modal-source-link">📰 อ่านต้นฉบับที่ ${esc(article.source)} ↗</a>` : ''}
  `;
}

function closeModal() {
  const o = document.getElementById('modalOverlay');
  if (o) o.classList.remove('open');
}

// ════════════════════════════════════════  FALLBACK + UTILS  ════════════════════════════════════════

function getFallbackData() {
  const now = new Date().toISOString();
  return [
    { id: 'f1', sport: 'football', emoji: '⚽', title: 'พรีเมียร์ลีก: ผลการแข่งขันและอัปเดตล่าสุด', summary: 'ติดตามผลและไฮไลต์ศึกลูกหนังพรีเมียร์ลีกอังกฤษรอบล่าสุด', image: null, url: '#', source: 'Sportlife', pubDate: now, time: 'วันนี้' },
    { id: 'f2', sport: 'basketball', emoji: '🏀', title: 'NBA: สรุปผลและตารางแข่งขันประจำสัปดาห์', summary: 'อัปเดตผลการแข่งขัน NBA และตำแหน่งผู้นำสายตะวันออก-ตะวันตก', image: null, url: '#', source: 'Sportlife', pubDate: now, time: 'วันนี้' },
    { id: 'f3', sport: 'tennis', emoji: '🎾', title: 'เทนนิสแกรนด์สแลม: อัปเดตรอบล่าสุด', summary: 'ผลและไฮไลต์การแข่งขันเทนนิสระดับแกรนด์สแลม', image: null, url: '#', source: 'Sportlife', pubDate: now, time: 'วันนี้' },
  ];
}

function timeAgo(dateStr) {
  if (!dateStr) return 'เมื่อกี้';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'เมื่อกี้';
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
