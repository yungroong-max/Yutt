// ═══════════════════════════════════════════════════════
//  Sportlife — app.js
//  ดึงข่าวจริงจาก NewsData.io + แปลด้วย Claude AI
// ═══════════════════════════════════════════════════════

const CONFIG = {
  NEWSDATA_BASE: 'https://newsdata.io/api/1/latest',
  CLAUDE_BASE:   'https://api.anthropic.com/v1/messages',
  CLAUDE_MODEL:  'claude-sonnet-4-6',
  REFRESH_MS:    600000, // 10 นาที
};

// ── STATE ──
const state = {
  newsApiKey:    localStorage.getItem('st_news_key') || '',
  claudeApiKey:  localStorage.getItem('st_claude_key') || '',
  articles:      [],
  page:          null,
  currentSport:  'all',
  loading:       false,
};

// ── SPORT CONFIG ──
const SPORTS = {
  football:   { q: 'football soccer ฟุตบอล',   emoji: '⚽', label: 'ฟุตบอล' },
  boxing:     { q: 'boxing muay thai มวย',       emoji: '🥊', label: 'มวย' },
  badminton:  { q: 'badminton แบดมินตัน',        emoji: '🏸', label: 'แบดมินตัน' },
  basketball: { q: 'basketball NBA บาสเกตบอล',  emoji: '🏀', label: 'บาสเกตบอล' },
  tennis:     { q: 'tennis เทนนิส',              emoji: '🎾', label: 'เทนนิส' },
  motorsport: { q: 'Formula1 F1 motorsport',     emoji: '🏎️', label: 'มอเตอร์สปอร์ต' },
  mma:        { q: 'MMA UFC ONE Championship',   emoji: '🥋', label: 'MMA' },
};

// ── DETECT SPORT FROM TITLE/KEYWORDS ──
function detectSport(title = '', desc = '') {
  const t = (title + ' ' + desc).toLowerCase();
  if (/football|soccer|premier|liga|bundesliga|ฟุตบอล|เตะ|ลีก/.test(t)) return 'football';
  if (/boxing|muay|มวย|ชก|punch|knockout/.test(t)) return 'boxing';
  if (/badminton|แบดมินตัน/.test(t)) return 'badminton';
  if (/basketball|nba|บาสเกตบอล/.test(t)) return 'basketball';
  if (/tennis|เทนนิส|wimbledon|roland|usopen/.test(t)) return 'tennis';
  if (/formula|f1|grand prix|hamilton|verstappen|motorsport/.test(t)) return 'motorsport';
  if (/mma|ufc|one championship|mixed martial/.test(t)) return 'mma';
  return 'football';
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  updateDate();
  setInterval(updateDate, 30000);
  setupNav();
  setupChips();
  setupModal();

  // ผลกีฬาสด + วิดเจ็ตข้าง — แสดงให้ผู้เข้าชมทุกคนเห็น (ไม่ต้องมีคีย์)
  loadScoresLive();
  loadTrending();
  loadThaiAthletes();
  if (state.newsApiKey || state.claudeApiKey) {
    hideBanner();
    loadNews();
  } else {
    showFallback();
  }

  setInterval(refreshAll, CONFIG.REFRESH_MS);
});

// ── DATE ──
function updateDate() {
  const d = new Date();
  const date = d.toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const el = document.getElementById('dateDisplay');
  if (el) el.innerHTML = `${date}<br>${time}`;
}

// ── SAVE KEYS ──
function saveKeys() {
  const nk = document.getElementById('newsApiKey').value.trim();
  const ck = document.getElementById('claudeApiKey').value.trim();
  if (nk) { state.newsApiKey = nk; localStorage.setItem('st_news_key', nk); }
  if (ck) { state.claudeApiKey = ck; localStorage.setItem('st_claude_key', ck); }
  if (!nk && !ck) return alert('กรุณากรอก API Key อย่างน้อยหนึ่งตัว');
  hideBanner();
  bootLoad();
}

function hideBanner() {
  const b = document.getElementById('setupBanner');
  if (b) b.classList.add('hidden');
}

async function bootLoad() {
  await Promise.all([loadNews(), loadScoresLive(), loadTrending(), loadThaiAthletes()]);
}

// ── NAV / FILTER ──
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

// ── CHIPS ──
function setupChips() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      document.getElementById('aiInput').value = chip.dataset.query;
      document.getElementById('aiInput').focus();
    });
  });
  document.getElementById('aiInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') askAI();
  });
}

// ════════════════════════════════════════
//  NEWS LOADING
// ════════════════════════════════════════

async function loadNews() {
  if (state.newsApiKey) {
    await fetchFromNewsData();
  } else if (state.claudeApiKey) {
    await fetchFromClaude();
  } else {
    showFallback();
  }
}

// ── NEWSDATA.IO ──
async function fetchFromNewsData() {
  try {
    document.getElementById('srcStatus').textContent = '🟢 เชื่อมต่อแล้ว';

    // ดึงข่าวกีฬาไทยและต่างประเทศพร้อมกัน — เน้นข่าวไทยเป็นหลัก (กีฬาในกระแสของคนไทย)
    // หมายเหตุ: แผนฟรี NewsData จำกัด size ไม่เกิน 10
    const intlQuery = encodeURIComponent('football OR boxing OR badminton OR tennis OR basketball');
    const [thaiRes, intlRes] = await Promise.all([
      fetch(`${CONFIG.NEWSDATA_BASE}?apikey=${state.newsApiKey}&country=th&category=sports&language=th&size=10`),
      fetch(`${CONFIG.NEWSDATA_BASE}?apikey=${state.newsApiKey}&category=sports&language=en&q=${intlQuery}&size=8`)
    ]);

    const [thaiData, intlData] = await Promise.all([thaiRes.json(), intlRes.json()]);

    let articles = [];

    // ข่าวไทย (กันพังถ้า API ตอบ error — results จะเป็น object ไม่ใช่ array)
    if (Array.isArray(thaiData.results)) {
      articles.push(...thaiData.results.map(a => normalizeNewsData(a, 'th')));
    } else if (thaiData.status === 'error') {
      console.warn('NewsData (TH):', thaiData.results?.message);
    }
    // ข่าวต่างประเทศ
    if (Array.isArray(intlData.results)) {
      articles.push(...intlData.results.map(a => normalizeNewsData(a, 'en')));
    } else if (intlData.status === 'error') {
      console.warn('NewsData (INTL):', intlData.results?.message);
    }

    // จัดข่าวไทยขึ้นก่อน แล้วเรียงตามเวลาในแต่ละกลุ่ม (ให้ข่าวไทยเด่นกว่า)
    articles.sort((a, b) => {
      const thaiFirst = (b.lang === 'th') - (a.lang === 'th');
      if (thaiFirst !== 0) return thaiFirst;
      return new Date(b.pubDate) - new Date(a.pubDate);
    });

    state.articles = articles;
    state.page = thaiData.nextPage || null;

    renderArticles();
    updateTicker(articles);
    if (document.getElementById('loadMoreBtn'))
      document.getElementById('loadMoreBtn').style.display = articles.length >= 10 ? 'block' : 'none';

  } catch (err) {
    console.warn('NewsData error:', err);
    if (state.claudeApiKey) await fetchFromClaude();
    else showFallback();
  }
}

function normalizeNewsData(item, lang) {
  const sport = detectSport(item.title, item.description || '');
  const emoji = SPORTS[sport]?.emoji || '⚽';
  return {
    id: item.article_id || Math.random().toString(36),
    title_orig: item.title || '',
    title: item.title || '',
    summary: item.description || item.content?.substring(0, 120) + '...' || '',
    image: item.image_url || null,
    url: item.link || '#',
    source: item.source_name || 'NewsData',
    pubDate: item.pubDate || new Date().toISOString(),
    time: timeAgo(item.pubDate),
    sport, emoji, lang,
    translated: false,
  };
}

// ── TRANSLATE WITH CLAUDE ──
async function translateArticles(articles) {
  if (!state.claudeApiKey) return articles;
  const toTranslate = articles.filter(a => a.lang === 'en' && !a.translated).slice(0, 6);
  if (!toTranslate.length) return articles;

  const titles = toTranslate.map((a, i) => `${i + 1}. ${a.title_orig}`).join('\n');
  const summaries = toTranslate.map((a, i) => `${i + 1}. ${a.summary}`).join('\n');

  try {
    const res = await fetch(CONFIG.CLAUDE_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': state.claudeApiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: CONFIG.CLAUDE_MODEL,
        max_tokens: 1000,
        system: 'แปลหัวข้อข่าวกีฬาภาษาอังกฤษเป็นภาษาไทย ให้กระชับ อ่านง่าย เป็นธรรมชาติ ตอบเป็น JSON เท่านั้น: {"titles":["..."],"summaries":["..."]}',
        messages: [{ role: 'user', content: `แปลหัวข้อ:\n${titles}\n\nแปลสรุป:\n${summaries}` }]
      })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    toTranslate.forEach((a, i) => {
      if (parsed.titles?.[i]) a.title = parsed.titles[i];
      if (parsed.summaries?.[i]) a.summary = parsed.summaries[i];
      a.translated = true;
    });
  } catch (e) { console.warn('Translation error', e); }

  return articles;
}

// ── CLAUDE FALLBACK ──
async function fetchFromClaude() {
  if (!state.claudeApiKey) return showFallback();
  setLoading(true);
  try {
    const res = await fetch(CONFIG.CLAUDE_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': state.claudeApiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: CONFIG.CLAUDE_MODEL,
        max_tokens: 1000,
        system: 'ตอบ JSON เท่านั้น ไม่มี markdown ไม่มี backtick ไม่มีคำอธิบายเพิ่ม',
        messages: [{
          role: 'user',
          content: `สร้างข่าวกีฬาปี 2026 สำหรับเว็บไซต์ไทย 10 ข่าว ครบทุกประเภทกีฬา:
{"articles":[{
  "id":"1","sport":"football","emoji":"⚽","title":"หัวข้อข่าวภาษาไทย",
  "summary":"สรุปข่าว 2 ประโยค","time":"2 ชั่วโมงที่แล้ว","source":"BBC Sport",
  "url":"https://bbc.com/sport","lang":"ai","translated":true,
  "pubDate":"${new Date().toISOString()}"
}]}`
        }]
      })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    state.articles = parsed.articles || getFallbackData();
    renderArticles();
    updateTicker(state.articles);
  } catch (e) {
    state.articles = getFallbackData();
    renderArticles();
  }
  setLoading(false);
}

// ── LOAD MORE ──
async function loadMoreNews() {
  if (!state.newsApiKey || !state.page) return;
  const btn = document.getElementById('loadMoreBtn');
  btn.textContent = '⏳ กำลังโหลด...';
  try {
    const res = await fetch(`${CONFIG.NEWSDATA_BASE}?apikey=${state.newsApiKey}&category=sports&page=${state.page}&size=10`);
    const data = await res.json();
    if (data.results) {
      const more = data.results.map(a => normalizeNewsData(a, 'en'));
      state.articles.push(...more);
      state.page = data.nextPage || null;
      renderArticles();
    }
  } catch (e) { console.warn(e); }
  btn.textContent = 'โหลดเพิ่มเติม ▼';
  if (!state.page) btn.style.display = 'none';
}

// ════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════

function renderArticles() {
  const filtered = state.currentSport === 'all'
    ? state.articles
    : state.articles.filter(a => a.sport === state.currentSport);

  const featGrid = document.getElementById('featuredGrid');
  const newsList = document.getElementById('newsList');

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
        <div class="article-meta">
          <span>🕐 ${main.time}</span>
          <span class="source-badge">📰 ${esc(main.source)}</span>
          ${main.lang === 'en' && main.translated ? '<span style="color:var(--gold);font-size:10px">🤖 แปลแล้ว</span>' : ''}
        </div>
      </div>
    </div>
    ${rest.slice(0, 2).map(a => `
      <div class="card-sm" onclick="openArticle('${a.id}')">
        <div class="card-img">
          ${a.image ? `<img src="${a.image}" alt="${esc(a.title)}" loading="lazy" onerror="this.style.display='none'">` : a.emoji}
        </div>
        <div class="card-body">
          <div class="sport-tag">${a.emoji} ${SPORTS[a.sport]?.label || a.sport}</div>
          <div class="article-title">${esc(a.title)}</div>
          <div class="article-meta">
            <span>🕐 ${a.time}</span>
            <span class="source-badge">📰 ${esc(a.source)}</span>
          </div>
        </div>
      </div>
    `).join('')}
  `;

  newsList.innerHTML = rest.slice(2).map(a => `
    <div class="news-item" onclick="openArticle('${a.id}')">
      <div class="news-thumb">
        ${a.image ? `<img src="${a.image}" alt="${esc(a.title)}" loading="lazy" onerror="this.style.display='none'">` : a.emoji}
      </div>
      <div class="news-body">
        <div class="sport-tag" style="margin-bottom:6px">${a.emoji} ${SPORTS[a.sport]?.label || a.sport}</div>
        <div class="news-title">${esc(a.title)}</div>
        <div class="article-meta">
          <span>🕐 ${a.time}</span>
          <span class="source-badge">📰 ${esc(a.source)}</span>
          ${a.lang === 'en' && a.translated ? '<span style="color:var(--gold);font-size:10px">🤖 แปลแล้ว</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');

  // Translate English titles in background
  if (state.claudeApiKey) {
    translateArticles(state.articles).then(() => renderArticles());
  }
}

// ── TICKER ──
function updateTicker(articles) {
  const items = articles.slice(0, 12).map(a => `<span class="ticker-item">${a.emoji} ${esc(a.title)}</span>`).join('');
  const el = document.getElementById('tickerContent');
  if (el) el.innerHTML = items + items; // duplicate for loop
}

// ════════════════════════════════════════
//  MODAL / ARTICLE READER
// ════════════════════════════════════════

function setupModal() {
  const overlay = document.getElementById('modalOverlay');
  const closeBtn = document.getElementById('modalClose');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

async function openArticle(id) {
  const article = state.articles.find(a => a.id == id);
  if (!article) return;

  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  overlay.classList.add('open');

  content.innerHTML = `
    <div class="sport-tag">${article.emoji} ${SPORTS[article.sport]?.label || article.sport}</div>
    <div class="modal-title">${esc(article.title)}</div>
    <div class="modal-meta">
      <span>🕐 ${article.time}</span>
      <span class="source-badge">📰 ${esc(article.source)}</span>
    </div>
    <div class="loading-row"><div class="spinner"></div> AI กำลังขยายบทความ...</div>
  `;

  // ขยายบทความด้วย Claude
  if (state.claudeApiKey) {
    try {
      const res = await fetch(CONFIG.CLAUDE_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': state.claudeApiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: CONFIG.CLAUDE_MODEL,
          max_tokens: 1000,
          system: `คุณคือบรรณาธิการข่าวกีฬาอาวุโสของสื่อไทย
เขียนบทความข่าวภาษาไทยที่สมบูรณ์ สนุก อ่านง่าย 4-5 ย่อหน้า
ใช้ <p> tag ทุกย่อหน้า ห้ามใช้ markdown
เพิ่มบริบทเบื้องหลัง สถิติ และข้อมูลที่เกี่ยวข้องกับผู้อ่านชาวไทย`,
          messages: [{
            role: 'user',
            content: `เขียนบทความข่าวกีฬาฉบับเต็มจากข้อมูลนี้:
หัวข้อ: ${article.title_orig || article.title}
สรุป: ${article.summary}
แหล่งที่มา: ${article.source}`
          }]
        })
      });
      const data = await res.json();
      const body = data.content?.[0]?.text || `<p>${esc(article.summary)}</p>`;

      content.innerHTML = `
        <div class="sport-tag">${article.emoji} ${SPORTS[article.sport]?.label || article.sport}</div>
        <div class="modal-title">${esc(article.title)}</div>
        <div class="modal-meta">
          <span>🕐 ${article.time}</span>
          <span class="source-badge">📰 ${esc(article.source)}</span>
          <span style="color:var(--gold);font-size:10px">✨ AI Expanded</span>
        </div>
        <div class="modal-body">${body}</div>
        ${article.url && article.url !== '#'
          ? `<a href="${article.url}" target="_blank" rel="noopener" class="modal-source-link">📰 อ่านต้นฉบับที่ ${esc(article.source)} ↗</a>`
          : ''}
      `;
    } catch (e) {
      content.querySelector('.loading-row').innerHTML = `<p style="color:var(--muted);padding:20px">${esc(article.summary)}</p>`;
    }
  } else {
    content.innerHTML = `
      <div class="sport-tag">${article.emoji} ${SPORTS[article.sport]?.label || article.sport}</div>
      <div class="modal-title">${esc(article.title)}</div>
      <div class="modal-meta"><span>🕐 ${article.time}</span><span class="source-badge">📰 ${esc(article.source)}</span></div>
      <div class="modal-body"><p>${esc(article.summary)}</p></div>
      ${article.url && article.url !== '#' ? `<a href="${article.url}" target="_blank" rel="noopener" class="modal-source-link">📰 อ่านต้นฉบับ ↗</a>` : ''}
    `;
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ════════════════════════════════════════
//  AI ANALYST
// ════════════════════════════════════════

async function askAI() {
  const input = document.getElementById('aiInput').value.trim();
  if (!input) return;
  if (!state.claudeApiKey) {
    alert('กรุณาใส่ Anthropic API Key เพื่อใช้ฟีเจอร์ AI วิเคราะห์');
    return;
  }

  const btn = document.getElementById('askBtn');
  btn.disabled = true; btn.textContent = '⏳...';

  const result = document.getElementById('aiResult');
  result.innerHTML = `<div class="loading-row"><div class="spinner"></div>AI กำลังวิเคราะห์...</div>`;

  try {
    const res = await fetch(CONFIG.CLAUDE_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': state.claudeApiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: CONFIG.CLAUDE_MODEL,
        max_tokens: 1000,
        system: `คุณคือนักวิเคราะห์กีฬาผู้เชี่ยวชาญ ตอบภาษาไทยที่อ่านง่าย สนุก
จัดรูปแบบด้วย <p> tags เน้นข้อมูลเกี่ยวกับกีฬาและนักกีฬาไทย ตอบ 3-5 ย่อหน้า`,
        messages: [{ role: 'user', content: input }]
      })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || 'ไม่สามารถดึงข้อมูลได้';
    result.innerHTML = `<div class="ai-result-box">${text}</div>`;
  } catch (e) {
    result.innerHTML = `<div class="ai-result-box"><p>⚠️ เกิดข้อผิดพลาด กรุณาลองใหม่</p></div>`;
  }

  btn.disabled = false; btn.textContent = '🔍 วิเคราะห์';
}

// ════════════════════════════════════════
//  SIDEBAR WIDGETS
// ════════════════════════════════════════

// ── ผลกีฬาสด (ผ่าน Netlify Function → API-Sports) ──
async function loadScoresLive() {
  const el = document.getElementById('scoresWidget');
  if (!el) return;
  const render = (arr) => arr.map(m => `
      <div class="score-item">
        <div class="score-league">${m.lg}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1">
            <div class="score-row"><span class="score-team">${m.h}</span><span class="score-num ${m.hw?'win':''}">${m.sh ?? '-'}</span></div>
            <div class="score-row"><span class="score-team">${m.a}</span><span class="score-num ${!m.hw && m.sa>m.sh?'win':''}">${m.sa ?? '-'}</span></div>
          </div>
          <div class="match-badge ${String(m.st||'').includes('LIVE')?'badge-live':m.st==='FT'?'badge-ft':'badge-sched'}">${m.st}</div>
        </div>
      </div>`).join('');
  // แบดมินตัน + เทนนิส ไม่มีผลสดใน API ฟรี → ใส่รายการเด่นล่าสุด
  const extra = [
    { lg:'BWF World Tour', h:'กุนลวุฒิ', a:'แอกเซลเซน', sh:2, sa:1, st:'FT', hw:true },
    { lg:'เทนนิส แกรนด์สแลม', h:'อัลคาราส', a:'ซินเนอร์', sh:3, sa:2, st:'FT', hw:true },
  ];
  try {
    const res = await fetch('/.netlify/functions/scores');
    const data = await res.json();
    const live = Array.isArray(data.m) ? data.m : [];
    const all = live.concat(extra);
    el.innerHTML = all.length ? render(all) : renderFallbackScores();
  } catch (e) {
    el.innerHTML = renderFallbackScores();
  }
}

async function loadScores() {
  const el = document.getElementById('scoresWidget');
  if (!state.claudeApiKey) { el.innerHTML = renderFallbackScores(); return; }
  try {
    const res = await fetch(CONFIG.CLAUDE_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': state.claudeApiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: CONFIG.CLAUDE_MODEL,
        max_tokens: 1000,
        system: 'ตอบ JSON เท่านั้น',
        messages: [{
          role: 'user',
          content: `สร้างผลการแข่งขันล่าสุด 5 รายการ ครอบคลุม 5 กีฬาหลัก กีฬาละ 1 รายการ ตามลำดับ: ฟุตบอล, บาสเกตบอล, แบดมินตัน, วอลเลย์บอล, เทนนิส. คัดเฉพาะรายการสำคัญที่ได้รับความสนใจสูง (ฟุตบอล=พรีเมียร์ลีก/แชมเปียนส์ลีก/ทีมชาติไทย, บาส=NBA, แบดมินตัน=BWF All England/World Tour Finals/ชิงแชมป์โลก, วอลเลย์บอล=FIVB VNL/ชิงแชมป์โลก/เนชันส์ลีกหญิงไทย, เทนนิส=แกรนด์สแลม). ใส่ผู้เล่น/ทีมจริงที่กำลังเป็นกระแส ตอบ JSON เท่านั้น:
{"m":[{"lg":"พรีเมียร์ลีก","h":"แมนซิตี้","a":"อาร์เซนอล","sh":2,"sa":1,"st":"FT","hw":true},
{"lg":"NBA Finals","h":"บอสตัน เซลติกส์","a":"ไมอามี ฮีต","sh":105,"sa":98,"st":"FT","hw":true},
{"lg":"BWF All England","h":"กุนลวุฒิ","a":"ฉือ ยู่ฉี","sh":2,"sa":1,"st":"FT","hw":true},
{"lg":"VNL หญิง","h":"ไทย","a":"ญี่ปุ่น","sh":3,"sa":2,"st":"FT","hw":true},
{"lg":"Wimbledon","h":"อัลคาราส","a":"ซินเนอร์","sh":3,"sa":2,"st":"LIVE","hw":true}]}`
        }]
      })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';
    const p = JSON.parse(text.replace(/```json|```/g, '').trim());
    el.innerHTML = (p.m || []).map(m => `
      <div class="score-item">
        <div class="score-league">${m.lg}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1">
            <div class="score-row"><span class="score-team">${m.h}</span><span class="score-num ${m.hw?'win':''}">${m.sh ?? '-'}</span></div>
            <div class="score-row"><span class="score-team">${m.a}</span><span class="score-num ${!m.hw&&m.sa>m.sh?'win':''}">${m.sa ?? '-'}</span></div>
          </div>
          <div class="match-badge ${m.st.includes('LIVE')||m.st.includes('P')?'badge-live':m.st==='FT'?'badge-ft':'badge-sched'}">${m.st}</div>
        </div>
      </div>
    `).join('');
  } catch (e) { el.innerHTML = renderFallbackScores(); }
}

function renderFallbackScores() {
  return [
    { lg:'พรีเมียร์ลีก', h:'แมนซิตี้', a:'อาร์เซนอล', sh:2, sa:1, st:'FT', hw:true },
    { lg:'NBA Finals', h:'บอสตัน เซลติกส์', a:'ไมอามี ฮีต', sh:105, sa:98, st:'FT', hw:true },
    { lg:'BWF All England', h:'กุนลวุฒิ', a:'ฉือ ยู่ฉี', sh:2, sa:1, st:'FT', hw:true },
    { lg:'VNL หญิง', h:'ไทย', a:'ญี่ปุ่น', sh:3, sa:2, st:'FT', hw:true },
    { lg:'Wimbledon', h:'อัลคาราส', a:'ซินเนอร์', sh:3, sa:2, st:'LIVE', hw:true },
  ].map(m => `
    <div class="score-item">
      <div class="score-league">${m.lg}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1">
          <div class="score-row"><span class="score-team">${m.h}</span><span class="score-num ${m.hw?'win':''}">${m.sh??'-'}</span></div>
          <div class="score-row"><span class="score-team">${m.a}</span><span class="score-num ${!m.hw&&m.sa>m.sh?'win':''}">${m.sa??'-'}</span></div>
        </div>
        <div class="match-badge ${m.st.includes('LIVE')?'badge-live':m.st==='FT'?'badge-ft':'badge-sched'}">${m.st}</div>
      </div>
    </div>
  `).join('');
}

async function loadTrending() {
  const el = document.getElementById('trendingWidget');
  if (!state.claudeApiKey) { el.innerHTML = renderFallbackTrending(); return; }
  try {
    const res = await fetch(CONFIG.CLAUDE_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': state.claudeApiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: CONFIG.CLAUDE_MODEL,
        max_tokens: 1000,
        system: 'ตอบ JSON เท่านั้น',
        messages: [{ role: 'user', content: 'trending กีฬาไทย 6 รายการ: {"t":[{"r":1,"e":"🔥","n":"ชื่อ","c":"45.2K"}]}' }]
      })
    });
    const data = await res.json();
    const p = JSON.parse((data.content?.[0]?.text || '{}').replace(/```json|```/g,'').trim());
    el.innerHTML = (p.t || []).map(t => `
      <div class="trend-item" onclick="document.getElementById('aiInput').value='${t.n}';document.getElementById('aiInput').focus()">
        <span class="trend-rank">${t.r}</span>
        <span style="font-size:18px">${t.e}</span>
        <div><div class="trend-name">${t.n}</div><div class="trend-count">${t.c} กำลังพูดถึง</div></div>
      </div>
    `).join('');
  } catch (e) { el.innerHTML = renderFallbackTrending(); }
}

function renderFallbackTrending() {
  return [
    {r:1,e:'🔥',n:'บัวขาว แชมป์โลก',c:'45.2K'},
    {r:2,e:'⚽',n:'ทีมชาติไทย AFF',c:'32.1K'},
    {r:3,e:'🏸',n:'รัชนก ออล อิงแลนด์',c:'28.7K'},
    {r:4,e:'🏎️',n:'F1 GP บริเตน',c:'19.3K'},
    {r:5,e:'⚽',n:'พรีเมียร์ลีก',c:'15.8K'},
    {r:6,e:'🥋',n:'ONE Championship',c:'12.4K'},
  ].map(t => `
    <div class="trend-item">
      <span class="trend-rank">${t.r}</span>
      <span style="font-size:18px">${t.e}</span>
      <div><div class="trend-name">${t.n}</div><div class="trend-count">${t.c} กำลังพูดถึง</div></div>
    </div>
  `).join('');
}

async function loadThaiAthletes() {
  const el = document.getElementById('thaiWidget');
  if (!state.claudeApiKey) { el.innerHTML = renderFallbackAthletes(); return; }
  try {
    const res = await fetch(CONFIG.CLAUDE_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': state.claudeApiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: CONFIG.CLAUDE_MODEL,
        max_tokens: 1000,
        system: 'ตอบ JSON เท่านั้น',
        messages: [{ role: 'user', content: 'นักกีฬาไทยในเวทีโลกล่าสุด 5 คน: {"a":[{"n":"ชื่อ","s":"กีฬา","e":"🏆","r":"ผลงานล่าสุด"}]}' }]
      })
    });
    const data = await res.json();
    const p = JSON.parse((data.content?.[0]?.text || '{}').replace(/```json|```/g,'').trim());
    el.innerHTML = (p.a || []).map(a => `
      <div class="athlete-item">
        <span class="athlete-emoji">${a.e}</span>
        <div><div class="athlete-name">🇹🇭 ${a.n}</div><div class="athlete-sport">${a.s}</div><div class="athlete-status">${a.r}</div></div>
      </div>
    `).join('');
  } catch (e) { el.innerHTML = renderFallbackAthletes(); }
}

function renderFallbackAthletes() {
  return [
    {e:'🥊',n:'บัวขาว เมืองสุรินทร์',s:'มวยสากล',r:'แชมป์โลก WBC'},
    {e:'🏸',n:'รัชนก อินทนนท์',s:'แบดมินตัน',r:'รอบ 8 คนสุดท้าย BWF'},
    {e:'⚽',n:'ชนาธิป สรงกระสินธ์',s:'ฟุตบอล',r:'J-League ญี่ปุ่น'},
    {e:'🏊',n:'นิภาภรณ์ ตะรัตน์',s:'ว่ายน้ำ',r:'สถิติแห่งชาติใหม่'},
    {e:'🥋',n:'ONE Championship ไทย',s:'มวยไทย',r:'3 แชมป์โลก'},
  ].map(a => `
    <div class="athlete-item">
      <span class="athlete-emoji">${a.e}</span>
      <div><div class="athlete-name">🇹🇭 ${a.n}</div><div class="athlete-sport">${a.s}</div><div class="athlete-status">${a.r}</div></div>
    </div>
  `).join('');
}

// ════════════════════════════════════════
//  REFRESH
// ════════════════════════════════════════

async function refreshAll() {
  const btn = document.getElementById('refreshBtn');
  if (btn) { btn.textContent = '⏳ รีเฟรช...'; btn.disabled = true; }
  await bootLoad();
  if (btn) { btn.textContent = '🔄 รีเฟรช'; btn.disabled = false; }
}

// ════════════════════════════════════════
//  FALLBACK DATA
// ════════════════════════════════════════

function showFallback() {
  state.articles = getFallbackData();
  renderArticles();
  updateTicker(state.articles);
}

function getFallbackData() {
  return [
    { id:'f1', sport:'football', emoji:'⚽', title:'แมนซิตี้ไล่ตีเสมอ อาร์เซนอล 2-2 ศึกพรีเมียร์ลีก', summary:'เปปทีมดาวเตะต้านไม่อยู่ กลับมาเสมอในนาทีท้าย ลุ้นแชมป์ยังสูสี', time:'2 ชั่วโมงที่แล้ว', source:'BBC Sport', url:'https://bbc.com/sport', lang:'ai', translated:true, image:null, pubDate:new Date().toISOString() },
    { id:'f2', sport:'boxing', emoji:'🥊', title:'บัวขาว เมืองสุรินทร์ KO คู่ต่อสู้ชาวฟิลิปปินส์ รอบ 5 คว้าแชมป์โลก WBC', summary:'ยอดนักมวยไทยเอาชนะด้วย Right Hook อันทรงพลัง สร้างประวัติศาสตร์ป้องกันแชมป์ครั้งที่ 3', time:'5 ชั่วโมงที่แล้ว', source:'ESPN', url:'#', lang:'ai', translated:true, image:null, pubDate:new Date().toISOString() },
    { id:'f3', sport:'badminton', emoji:'🏸', title:'รัชนก อินทนนท์ พลิกเอาชนะ อัน เซยอง เข้ารอบชิงชนะเลิศ ออล อิงแลนด์', summary:'เจ้าหญิงแบดไทยเปิดเกมรุกได้สวยงาม เอาชนะมือ 1 โลกชาวเกาหลีใต้แบบตรงสองเซต', time:'8 ชั่วโมงที่แล้ว', source:'BWF Official', url:'#', lang:'ai', translated:true, image:null, pubDate:new Date().toISOString() },
    { id:'f4', sport:'motorsport', emoji:'🏎️', title:'เวอร์สตัปเป็น คว้า Pole Position GP ออสเตรีย ทิ้งห่าง เลอแคลร์ 0.3 วินาที', summary:'แชมป์โลก 4 สมัย ยังครองความเหนือกว่า เตรียมล่าแชมป์สนามที่ 7 ของฤดูกาล', time:'12 ชั่วโมงที่แล้ว', source:'F1 Official', url:'#', lang:'ai', translated:true, image:null, pubDate:new Date().toISOString() },
    { id:'f5', sport:'football', emoji:'⚽', title:'ทีมชาติไทย ประกาศ 23 ผู้เล่น AFF Championship 2026 มีชื่อ ชนาธิป', summary:'สมาคมฟุตบอลไทยประกาศทีมชุดแข่ง AFF ชนาธิป สรงกระสินธ์ กลับมาติดทีมอีกครั้ง', time:'1 วันที่แล้ว', source:'FAT Official', url:'#', lang:'ai', translated:true, image:null, pubDate:new Date().toISOString() },
    { id:'f6', sport:'tennis', emoji:'🎾', title:'คาร์ลอส อัลคาราส คว้าแชมป์วิมเบิลดัน เอาชนะ ยานนิค ซินเนอร์ 5 เซต', summary:'ดาวเด่นสเปนวัย 22 ปี ป้องกันแชมป์วิมเบิลดันสำเร็จ เอาชนะสุดมันส์ 3-7, 6-4, 6-2, 4-6, 6-3', time:'1 วันที่แล้ว', source:'Wimbledon', url:'#', lang:'ai', translated:true, image:null, pubDate:new Date().toISOString() },
    { id:'f7', sport:'basketball', emoji:'🏀', title:'บอสตัน เซลติกส์ คว้าแชมป์ NBA Finals ครั้งที่ 18 เอาชนะ ไมอามี ฮีต', summary:'ทีมใบโคลเวอร์จากบอสตัน คว้าแชมป์ NBA สมัยที่ 18 ในประวัติศาสตร์ Jayson Tatum ซิว MVP', time:'2 วันที่แล้ว', source:'NBA.com', url:'#', lang:'ai', translated:true, image:null, pubDate:new Date().toISOString() },
    { id:'f8', sport:'mma', emoji:'🥋', title:'ONE Championship ไทย ครอง 3 แชมป์โลก ส่งศึก ONE 172 สิงคโปร์', summary:'นักสู้ไทย 3 คน ป้องกันแชมป์สำเร็จในคืนเดียว สร้างประวัติศาสตร์ให้วงการมวยไทยโลก', time:'2 วันที่แล้ว', source:'ONE Championship', url:'#', lang:'ai', translated:true, image:null, pubDate:new Date().toISOString() },
  ];
}

// ════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════

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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setLoading(on) {
  state.loading = on;
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.textContent = on ? '⏳...' : '🔄 รีเฟรช';
}
