// ── Netlify Function: ผลกีฬาสด (proxy → API-Sports) ─────────────
// ผลสด ฟุตบอล / บาสเกตบอล / วอลเลย์บอล + รายการเด่น แบดมินตัน / เทนนิส
// แต่ละแมตช์ติด field sport, emoji เพื่อให้หน้าเว็บจัดกลุ่มตามกีฬา
// คีย์เก็บใน Environment Variable ชื่อ API_SPORTS_KEY (ไม่โผล่ในเบราว์เซอร์)
// cache ~10 นาที เพื่อประหยัดโควตาฟรี (~100 req/วัน)

const KEY = process.env.API_SPORTS_KEY;
const TTL_MS = 10 * 60 * 1000;
let CACHE = { at: 0, data: null };

async function apiGet(host, path) {
  const res = await fetch(`https://${host}${path}`, { headers: { 'x-apisports-key': KEY } });
  if (!res.ok) throw new Error(`${host} ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.response) ? json.response : [];
}

function badge(short, finished, live) {
  if (finished.includes(short)) return 'FT';
  if (live.includes(short)) return 'LIVE';
  return short || '-';
}

async function football() {
  const r = await apiGet('v3.football.api-sports.io', '/fixtures?live=all');
  return r.slice(0, 4).map((f) => ({
    sport: 'football', emoji: '⚽',
    lg: f.league?.name || 'ฟุตบอล',
    h: f.teams?.home?.name || '-', a: f.teams?.away?.name || '-',
    sh: f.goals?.home, sa: f.goals?.away,
    st: badge(f.fixture?.status?.short, ['FT', 'AET', 'PEN'], ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE']),
    hw: f.teams?.home?.winner === true || (f.goals?.home > f.goals?.away),
  }));
}

async function basketball() {
  const r = await apiGet('v1.basketball.api-sports.io', '/games?live=all');
  return r.slice(0, 4).map((g) => ({
    sport: 'basketball', emoji: '🏀',
    lg: g.league?.name || 'บาสเกตบอล',
    h: g.teams?.home?.name || '-', a: g.teams?.away?.name || '-',
    sh: g.scores?.home?.total ?? g.scores?.home, sa: g.scores?.away?.total ?? g.scores?.away,
    st: badge(g.status?.short, ['FT', 'AOT'], ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'HT', 'BT', 'LIVE']),
    hw: (g.scores?.home?.total ?? 0) > (g.scores?.away?.total ?? 0),
  }));
}

async function volleyball() {
  const r = await apiGet('v1.volleyball.api-sports.io', '/games?live=all');
  return r.slice(0, 4).map((g) => ({
    sport: 'volleyball', emoji: '🏐',
    lg: g.league?.name || 'วอลเลย์บอล',
    h: g.teams?.home?.name || '-', a: g.teams?.away?.name || '-',
    sh: g.scores?.home, sa: g.scores?.away,
    st: badge(g.status?.short, ['FT'], ['S1', 'S2', 'S3', 'S4', 'S5', 'LIVE']),
    hw: (g.scores?.home ?? 0) > (g.scores?.away ?? 0),
  }));
}

// แบดมินตัน + เทนนิส ไม่มีผลสดใน API ฟรี → รายการเด่นล่าสุด
const STATIC_EXTRA = [
  { sport: 'badminton', emoji: '🏸', lg: 'BWF World Tour', h: 'กุนลวุฒิ วิทิตศานต์', a: 'วิกเตอร์ แอกเซลเซน', sh: 2, sa: 1, st: 'FT', hw: true },
  { sport: 'tennis', emoji: '🎾', lg: 'เทนนิส แกรนด์สแลม', h: 'คาร์ลอส อัลคาราส', a: 'ยานนิค ซินเนอร์', sh: 3, sa: 2, st: 'FT', hw: true },
];

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'Access-Control-Allow-Origin': '*',
  };

  if (!KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ m: STATIC_EXTRA, error: 'missing API_SPORTS_KEY' }) };
  }
  if (CACHE.data && Date.now() - CACHE.at < TTL_MS) {
    return { statusCode: 200, headers, body: JSON.stringify({ m: CACHE.data, cached: true }) };
  }

  const results = await Promise.allSettled([football(), basketball(), volleyball()]);
  const live = [];
  for (const r of results) if (r.status === 'fulfilled') live.push(...r.value);

  const m = live.concat(STATIC_EXTRA);
  CACHE = { at: Date.now(), data: m };
  return { statusCode: 200, headers, body: JSON.stringify({ m }) };
};
