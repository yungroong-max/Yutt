// ── Netlify Function: ผลกีฬาสด (proxy → API-Sports) ─────────────
// ดึงผลสด ฟุตบอล / บาสเกตบอล / วอลเลย์บอล จาก API-Sports ฝั่งเซิร์ฟเวอร์
// คีย์เก็บเป็น Environment Variable ชื่อ API_SPORTS_KEY (ไม่โผล่ในเบราว์เซอร์)
// มี cache ในหน่วยความจำ ~10 นาที เพื่อประหยัดโควตาฟรี (~100 req/วัน)

const KEY = process.env.API_SPORTS_KEY;
const TTL_MS = 10 * 60 * 1000; // 10 นาที
let CACHE = { at: 0, data: null };

async function apiGet(host, path) {
  const res = await fetch(`https://${host}${path}`, {
    headers: { 'x-apisports-key': KEY },
  });
  if (!res.ok) throw new Error(`${host} ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.response) ? json.response : [];
}

function liveBadge(short, finishedCodes, liveCodes) {
  if (finishedCodes.includes(short)) return 'FT';
  if (liveCodes.includes(short)) return 'LIVE';
  return short || '-';
}

async function football() {
  const r = await apiGet('v3.football.api-sports.io', '/fixtures?live=all');
  return r.slice(0, 2).map((f) => ({
    lg: f.league?.name || 'ฟุตบอล',
    h: f.teams?.home?.name || '-',
    a: f.teams?.away?.name || '-',
    sh: f.goals?.home,
    sa: f.goals?.away,
    st: liveBadge(f.fixture?.status?.short, ['FT', 'AET', 'PEN'], ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE']),
    hw: f.teams?.home?.winner === true || (f.goals?.home > f.goals?.away),
  }));
}

async function basketball() {
  const r = await apiGet('v1.basketball.api-sports.io', '/games?live=all');
  return r.slice(0, 2).map((g) => ({
    lg: g.league?.name || 'บาสเกตบอล',
    h: g.teams?.home?.name || '-',
    a: g.teams?.away?.name || '-',
    sh: g.scores?.home?.total ?? g.scores?.home,
    sa: g.scores?.away?.total ?? g.scores?.away,
    st: liveBadge(g.status?.short, ['FT', 'AOT'], ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'HT', 'BT', 'LIVE']),
    hw: (g.scores?.home?.total ?? 0) > (g.scores?.away?.total ?? 0),
  }));
}

async function volleyball() {
  const r = await apiGet('v1.volleyball.api-sports.io', '/games?live=all');
  return r.slice(0, 2).map((g) => ({
    lg: g.league?.name || 'วอลเลย์บอล',
    h: g.teams?.home?.name || '-',
    a: g.teams?.away?.name || '-',
    sh: g.scores?.home,
    sa: g.scores?.away,
    st: liveBadge(g.status?.short, ['FT'], ['S1', 'S2', 'S3', 'S4', 'S5', 'LIVE']),
    hw: (g.scores?.home ?? 0) > (g.scores?.away ?? 0),
  }));
}

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'Access-Control-Allow-Origin': '*',
  };

  if (!KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ m: [], error: 'missing API_SPORTS_KEY' }) };
  }

  // ใช้ cache ถ้ายังไม่หมดอายุ
  if (CACHE.data && Date.now() - CACHE.at < TTL_MS) {
    return { statusCode: 200, headers, body: JSON.stringify({ m: CACHE.data, cached: true }) };
  }

  const results = await Promise.allSettled([football(), basketball(), volleyball()]);
  const m = [];
  for (const r of results) if (r.status === 'fulfilled') m.push(...r.value);

  CACHE = { at: Date.now(), data: m };
  return { statusCode: 200, headers, body: JSON.stringify({ m }) };
};
