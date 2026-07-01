// ── Netlify Function: ข่าวกีฬา (proxy → NewsData.io) ────────────
// ดึงข่าวกีฬา เน้นรายการระดับสากล ลดข่าวในประเทศ
// คีย์เก็บใน Environment Variable ชื่อ NEWSDATA_KEY (ไม่โผล่ในเบราว์เซอร์)
// cache ~10 นาที เพื่อประหยัดโควตาฟรี (200 req/วัน)

const KEY = process.env.NEWSDATA_KEY;
const BASE = 'https://newsdata.io/api/1/latest';
const TTL_MS = 10 * 60 * 1000;
let CACHE = { at: 0, data: null };

// ข่าวกีฬาภาษาไทย (สื่อไทยเน้นโคฟเวอร์กีฬาต่างประเทศเป็นหลักอยู่แล้ว อ่านง่าย)
const TH_QS = 'category=sports&language=th&size=10';
// ข่าวกีฬาสากลจากสำนักข่าวชั้นนำ (กรองด้วยโดเมนเพื่อความน่าเชื่อถือ ลดข่าวนอกเรื่อง)
const EN_QS = 'category=sports&language=en&domainurl=bbc.com,espn.com,skysports.com,goal.com&size=6';

async function fetchNews(qs) {
  const res = await fetch(`${BASE}?apikey=${KEY}&${qs}`);
  const json = await res.json();
  return Array.isArray(json.results) ? json.results : [];
}

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'Access-Control-Allow-Origin': '*',
  };

  if (!KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ results: [], error: 'missing NEWSDATA_KEY' }) };
  }
  if (CACHE.data && Date.now() - CACHE.at < TTL_MS) {
    return { statusCode: 200, headers, body: JSON.stringify({ results: CACHE.data, cached: true }) };
  }

  const [thai, intl] = await Promise.allSettled([
    fetchNews(TH_QS),
    fetchNews(EN_QS),
  ]);

  const merged = [];
  // ข่าวสากลภาษาไทยขึ้นก่อน (อ่านง่ายสำหรับคนไทย) แล้วตามด้วยสากลภาษาอังกฤษ
  if (thai.status === 'fulfilled') merged.push(...thai.value);
  if (intl.status === 'fulfilled') merged.push(...intl.value);

  // กรองสแปม/พนัน + กันข่าวซ้ำ
  const BLOCK = /đá gà|nổ hũ|cựa dao|tài xỉu|neko|casino|slot|jackpot|bắn cá|game bài|สล็อต|พนัน|บาคาร่า|คาสิโน|เดิมพัน|แทงบอล|เว็บพนัน|หวย|ยิงปลา/i;
  const BLOCK_SRC = new Set(['elakhbar', 'asiannews']);
  const seen = new Set();
  const results = merged.filter((a) => {
    const title = (a.title || '').trim();
    if (!title) return false;            // ตัดข่าวที่ไม่มีหัวข้อ
    if (BLOCK.test(title)) return false;
    if (BLOCK_SRC.has((a.source_name || '').toLowerCase().trim())) return false;
    const k = a.link || a.article_id || title;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  CACHE = { at: Date.now(), data: results };
  return { statusCode: 200, headers, body: JSON.stringify({ results }) };
};
