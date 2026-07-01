// ── Netlify Function: ข่าวกีฬา (proxy → NewsData.io) ────────────
// ดึงข่าวกีฬา เน้นรายการระดับสากล ลดข่าวในประเทศ
// คีย์เก็บใน Environment Variable ชื่อ NEWSDATA_KEY (ไม่โผล่ในเบราว์เซอร์)
// cache ~10 นาที เพื่อประหยัดโควตาฟรี (200 req/วัน)

const KEY = process.env.NEWSDATA_KEY;
const BASE = 'https://newsdata.io/api/1/latest';
const TTL_MS = 10 * 60 * 1000;
let CACHE = { at: 0, data: null };

// คีย์เวิร์ดกีฬาระดับสากลที่คนไทยติดตาม
const INTL_TH = encodeURIComponent(
  'พรีเมียร์ลีก OR แชมเปียนส์ลีก OR ลาลีกา OR เอ็นบีเอ OR โอลิมปิก OR เทนนิส OR วอลเลย์บอลโลก OR ฟอร์มูล่าวัน'
);
const INTL_EN = encodeURIComponent(
  'Premier League OR Champions League OR LaLiga OR NBA OR Formula 1 OR Wimbledon OR volleyball'
);

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
    fetchNews(`category=sports&language=th&q=${INTL_TH}&size=10`),
    fetchNews(`category=sports&language=en&q=${INTL_EN}&size=10`),
  ]);

  const merged = [];
  // ข่าวสากลภาษาไทยขึ้นก่อน (อ่านง่ายสำหรับคนไทย) แล้วตามด้วยสากลภาษาอังกฤษ
  if (thai.status === 'fulfilled') merged.push(...thai.value);
  if (intl.status === 'fulfilled') merged.push(...intl.value);

  // กันข่าวซ้ำด้วย link
  const seen = new Set();
  const results = merged.filter((a) => {
    const k = a.link || a.article_id || a.title;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  CACHE = { at: Date.now(), data: results };
  return { statusCode: 200, headers, body: JSON.stringify({ results }) };
};
