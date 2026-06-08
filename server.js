const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json({ limit: '10mb' }));

// 静的ファイルに30日間ブラウザキャッシュを適用（フォント・画像・CSS・JS）
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '30d',
  etag: true,
  setHeaders: (res, filePath) => {
    // HTMLだけはキャッシュしない（更新の反映のため）
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('.otf') || filePath.endsWith('.woff2') || filePath.endsWith('.png')) {
      // フォント・画像は1年キャッシュ（CDNでも同様に保持）
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// ─── チーム定義（48チーム）── 公式グループ分け + ブックメーカーオッズ準拠 ───
// iso2: flagcdn.com で使う ISO 3166-1 alpha-2 コード（または gb-eng 等の地域コード）
const TEAMS = [
  // Group A
  { name: 'メキシコ', code: 'MEX', group: 'A', iso2: 'mx', defaultOdds: 58.05 },
  { name: '南アフリカ', code: 'RSA', group: 'A', iso2: 'za', defaultOdds: 128.0 },
  { name: '韓国', code: 'KOR', group: 'A', iso2: 'kr', defaultOdds: 128.0 },
  { name: 'チェコ', code: 'CZE', group: 'A', iso2: 'cz', defaultOdds: 128.0 },

  // Group B
  { name: 'カナダ', code: 'CAN', group: 'B', iso2: 'ca', defaultOdds: 178.0 },
  { name: 'ボスニア・ヘルツェゴビナ', code: 'BIH', group: 'B', iso2: 'ba', defaultOdds: 128.0 },
  { name: 'カタール', code: 'QAT', group: 'B', iso2: 'qa', defaultOdds: 128.0 },
  { name: 'スイス', code: 'SUI', group: 'B', iso2: 'ch', defaultOdds: 92.86 },

  // Group C
  { name: 'ブラジル', code: 'BRA', group: 'C', iso2: 'br', defaultOdds: 9.07 },
  { name: 'モロッコ', code: 'MAR', group: 'C', iso2: 'ma', defaultOdds: 53.55 },
  { name: 'ハイチ', code: 'HAI', group: 'C', iso2: 'ht', defaultOdds: 128.0 },
  { name: 'スコットランド', code: 'SCO', group: 'C', iso2: 'gb-sct', defaultOdds: 128.0 },

  // Group D
  { name: 'アメリカ', code: 'USA', group: 'D', iso2: 'us', defaultOdds: 65.40 },
  { name: 'パラグアイ', code: 'PAR', group: 'D', iso2: 'py', defaultOdds: 178.0 },
  { name: 'オーストラリア', code: 'AUS', group: 'D', iso2: 'au', defaultOdds: 128.0 },
  { name: 'トルコ', code: 'TUR', group: 'D', iso2: 'tr', defaultOdds: 128.0 },

  // Group E
  { name: 'ドイツ', code: 'GER', group: 'E', iso2: 'de', defaultOdds: 12.21 },
  { name: 'キュラソー', code: 'CUW', group: 'E', iso2: 'cw', defaultOdds: 128.0 },
  { name: 'コートジボワール', code: 'CIV', group: 'E', iso2: 'ci', defaultOdds: 128.0 },
  { name: 'エクアドル', code: 'ECU', group: 'E', iso2: 'ec', defaultOdds: 76.62 },

  // Group F
  { name: 'オランダ', code: 'NED', group: 'F', iso2: 'nl', defaultOdds: 16.39 },
  { name: '日本', code: 'JPN', group: 'F', iso2: 'jp', defaultOdds: 49.82 },
  { name: 'スウェーデン', code: 'SWE', group: 'F', iso2: 'se', defaultOdds: 128.0 },
  { name: 'チュニジア', code: 'TUN', group: 'F', iso2: 'tn', defaultOdds: 128.0 },

  // Group G
  { name: 'ベルギー', code: 'BEL', group: 'G', iso2: 'be', defaultOdds: 24.72 },
  { name: 'エジプト', code: 'EGY', group: 'G', iso2: 'eg', defaultOdds: 128.0 },
  { name: 'イラン', code: 'IRN', group: 'G', iso2: 'ir', defaultOdds: 128.0 },
  { name: 'ニュージーランド', code: 'NZL', group: 'G', iso2: 'nz', defaultOdds: 128.0 },

  // Group H
  { name: 'スペイン', code: 'ESP', group: 'H', iso2: 'es', defaultOdds: 4.84 },
  { name: 'カーボベルデ', code: 'CPV', group: 'H', iso2: 'cv', defaultOdds: 128.0 },
  { name: 'サウジアラビア', code: 'KSA', group: 'H', iso2: 'sa', defaultOdds: 128.0 },
  { name: 'ウルグアイ', code: 'URU', group: 'H', iso2: 'uy', defaultOdds: 46.43 },

  // Group I
  { name: 'フランス', code: 'FRA', group: 'I', iso2: 'fr', defaultOdds: 6.56 },
  { name: 'セネガル', code: 'SEN', group: 'I', iso2: 'sn', defaultOdds: 116.0 },
  { name: 'イラク', code: 'IRQ', group: 'I', iso2: 'iq', defaultOdds: 128.0 },
  { name: 'ノルウェー', code: 'NOR', group: 'I', iso2: 'no', defaultOdds: 27.01 },

  // Group J
  { name: 'アルゼンチン', code: 'ARG', group: 'J', iso2: 'ar', defaultOdds: 8.39 },
  { name: 'アルジェリア', code: 'ALG', group: 'J', iso2: 'dz', defaultOdds: 128.0 },
  { name: 'オーストリア', code: 'AUT', group: 'J', iso2: 'at', defaultOdds: 116.0 },
  { name: 'ヨルダン', code: 'JOR', group: 'J', iso2: 'jo', defaultOdds: 128.0 },

  // Group K
  { name: 'ポルトガル', code: 'POR', group: 'K', iso2: 'pt', defaultOdds: 10.50 },
  { name: 'コンゴ民主共和国', code: 'COD', group: 'K', iso2: 'cd', defaultOdds: 128.0 },
  { name: 'ウズベキスタン', code: 'UZB', group: 'K', iso2: 'uz', defaultOdds: 128.0 },
  { name: 'コロンビア', code: 'COL', group: 'K', iso2: 'co', defaultOdds: 46.44 },

  // Group L
  { name: 'イングランド', code: 'ENG', group: 'L', iso2: 'gb-eng', defaultOdds: 6.36 },
  { name: 'クロアチア', code: 'CRO', group: 'L', iso2: 'hr', defaultOdds: 71.41 },
  { name: 'ガーナ', code: 'GHA', group: 'L', iso2: 'gh', defaultOdds: 128.0 },
  { name: 'パナマ', code: 'PAN', group: 'L', iso2: 'pa', defaultOdds: 128.0 },
];

const INITIAL_COINS = 5000;
const ADMIN_KEY = 'wc2026admin';

const BET_TYPES = {
  win:      { name: '単勝', description: '優勝国を当てる', picks: 1 },
  place:    { name: '複勝', description: '3位以内に入る国を当てる', picks: 1 },
  trio:     { name: '三連複', description: '上位3カ国を順不同で当てる', picks: 3 },
  trifecta: { name: '三連単', description: '1位・2位・3位を着順通りに当てる', picks: 3 },
};

// ─── データ管理 ───
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultOdds = {};
    TEAMS.forEach(t => { defaultOdds[t.code] = t.defaultOdds; });
    const initial = {
      odds: defaultOdds, bets: [],
      votingClosed: false, settled: false,
      results: null, payouts: null,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  // 旧データ互換：settled のみあった場合は votingClosed も同期
  if (d.votingClosed === undefined) d.votingClosed = !!d.settled;
  return d;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── オッズ計算 ───
function calcPlaceOdds(winOdds) {
  return Math.max(1.1, Math.round((winOdds * 0.35) * 10) / 10);
}

function calcTrioOdds(winOddsMap, codes) {
  const o = codes.map(c => winOddsMap[c] || 100);
  const product = o[0] * o[1] * o[2];
  const sum = o[0] + o[1] + o[2];
  return Math.max(2.0, Math.round((product / sum) * 10) / 10);
}

function calcTrifectaOdds(winOddsMap, codes) {
  const trio = calcTrioOdds(winOddsMap, codes);
  return Math.max(5.0, Math.round(trio * 5 * 10) / 10);
}

function getOddsForBet(winOddsMap, type, picks) {
  switch (type) {
    case 'win':
      return winOddsMap[picks[0]] || 100;
    case 'place':
      return calcPlaceOdds(winOddsMap[picks[0]] || 100);
    case 'trio':
      return calcTrioOdds(winOddsMap, picks);
    case 'trifecta':
      return calcTrifectaOdds(winOddsMap, picks);
    default:
      return 1;
  }
}

// ─── 残高計算 ───
function getBalance(bets, name) {
  const spent = bets
    .filter(b => b.name === name)
    .reduce((sum, b) => sum + b.amount, 0);
  return INITIAL_COINS - spent;
}

// ─── プール統計 ───
function getPoolStats(data) {
  const participants = new Set(data.bets.map(b => b.name));
  const participantCount = participants.size;
  const pool = participantCount * INITIAL_COINS;
  const totalBet = data.bets.reduce((s, b) => s + b.amount, 0);
  return { participantCount, pool, totalBet, initialCoins: INITIAL_COINS };
}

// ─── 「Anchor が当たるとき、Other も確実に当たるか？」 ───
// 厳密計算は 4.6M通りの結果列挙が必要なため、確実な同時当選のみを近似で扱う
function mustWinWith(otherBet, anchorBet) {
  if (otherBet.id === anchorBet.id) return true;
  const anchor = anchorBet.picks;
  switch (anchorBet.type) {
    case 'win': {
      // anchor: X が1位 → X はトップ4にも入る
      if (otherBet.type === 'win') return otherBet.picks[0] === anchor[0];
      if (otherBet.type === 'place') return otherBet.picks[0] === anchor[0];
      return false; // trio/trifecta は2〜3位次第なので不確定
    }
    case 'place': {
      // anchor: X がトップ4 → X が1位かは不明
      if (otherBet.type === 'place') return otherBet.picks[0] === anchor[0];
      return false;
    }
    case 'trio': {
      // anchor: {A,B,C} がトップ3（順不同）
      const set = new Set(anchor);
      if (otherBet.type === 'trio') {
        return otherBet.picks.length === 3 && otherBet.picks.every(p => set.has(p));
      }
      if (otherBet.type === 'place') return set.has(otherBet.picks[0]);
      return false; // win/trifecta は順序次第
    }
    case 'trifecta': {
      // anchor: (A,B,C) がトップ3（順序通り）
      const set = new Set(anchor);
      if (otherBet.type === 'trifecta') return otherBet.picks.every((p, i) => p === anchor[i]);
      if (otherBet.type === 'trio') return otherBet.picks.length === 3 && otherBet.picks.every(p => set.has(p));
      if (otherBet.type === 'win') return otherBet.picks[0] === anchor[0];
      if (otherBet.type === 'place') return set.has(otherBet.picks[0]);
      return false;
    }
  }
  return false;
}

// ─── 各参加者の「最大払戻」を、プール上限を考慮して試算（簡易版・後方互換用） ───
function projectMaxPayout(userName, allBets, pool) {
  const userBets = allBets.filter(b => b.name === userName);
  let maxPayout = 0;
  for (const anchor of userBets) {
    const concurrent = allBets.filter(b => mustWinWith(b, anchor));
    const totalRaw = concurrent.reduce((s, b) => s + b.amount * b.odds, 0);
    const scale = totalRaw > 0 ? Math.min(1, pool / totalRaw) : 1;
    const myPayout = concurrent
      .filter(b => b.name === userName)
      .reduce((s, b) => s + b.amount * b.odds * scale, 0);
    if (myPayout > maxPayout) maxPayout = myPayout;
  }
  return Math.round(maxPayout);
}

// ─── 全結果パターン総当たりで、各参加者の真の最大払戻を計算 ───
// 48 × 47 × 46 = 103,776 通りの1〜3位を全列挙し、
// 各シナリオで全参加者の払戻を計算 → 各参加者の最大値を記録
function projectMaxPayoutFull(allBets, pool) {
  if (allBets.length === 0) return {};
  const codes = TEAMS.map(t => t.code);
  const userMax = new Map();

  // 事前にベットをタイプ別グループ化（高速化）
  const winBets = allBets.filter(b => b.type === 'win');
  const placeBets = allBets.filter(b => b.type === 'place');
  const trioBets = allBets.filter(b => b.type === 'trio');
  const trifectaBets = allBets.filter(b => b.type === 'trifecta');

  // 'win' 当選額をチーム別に事前集計
  const winRawByTeam = new Map();
  for (const b of winBets) {
    const key = b.picks[0];
    const arr = winRawByTeam.get(key) || [];
    arr.push(b);
    winRawByTeam.set(key, arr);
  }
  // 'place' も同様
  const placeRawByTeam = new Map();
  for (const b of placeBets) {
    const key = b.picks[0];
    const arr = placeRawByTeam.get(key) || [];
    arr.push(b);
    placeRawByTeam.set(key, arr);
  }
  // 'trio' をソート済キーで事前集計
  const trioByKey = new Map();
  for (const b of trioBets) {
    const key = [...b.picks].sort().join('|');
    const arr = trioByKey.get(key) || [];
    arr.push(b);
    trioByKey.set(key, arr);
  }
  // 'trifecta' を順序通りキーで事前集計
  const trifectaByKey = new Map();
  for (const b of trifectaBets) {
    const key = b.picks.join('|');
    const arr = trifectaByKey.get(key) || [];
    arr.push(b);
    trifectaByKey.set(key, arr);
  }

  // 全シナリオ列挙：1位、2位、3位の組み合わせ
  for (let i = 0; i < codes.length; i++) {
    const c1 = codes[i];
    const winners = winRawByTeam.get(c1) || [];

    for (let j = 0; j < codes.length; j++) {
      if (j === i) continue;
      const c2 = codes[j];

      for (let k = 0; k < codes.length; k++) {
        if (k === i || k === j) continue;
        const c3 = codes[k];

        // このシナリオで当選するベットを収集
        const wonBets = [];
        let totalRaw = 0;

        // win bets
        for (const b of winners) {
          const raw = b.amount * b.odds;
          totalRaw += raw;
          wonBets.push({ name: b.name, raw });
        }
        // place bets (1〜3位のいずれか)
        for (const team of [c1, c2, c3]) {
          const arr = placeRawByTeam.get(team) || [];
          for (const b of arr) {
            const raw = b.amount * b.odds;
            totalRaw += raw;
            wonBets.push({ name: b.name, raw });
          }
        }
        // trio bets ({c1,c2,c3} ソート済キーと一致)
        const trioKey = [c1, c2, c3].slice().sort().join('|');
        const trios = trioByKey.get(trioKey) || [];
        for (const b of trios) {
          const raw = b.amount * b.odds;
          totalRaw += raw;
          wonBets.push({ name: b.name, raw });
        }
        // trifecta bets (順序通り一致)
        const trifectaKey = `${c1}|${c2}|${c3}`;
        const trifs = trifectaByKey.get(trifectaKey) || [];
        for (const b of trifs) {
          const raw = b.amount * b.odds;
          totalRaw += raw;
          wonBets.push({ name: b.name, raw });
        }

        if (wonBets.length === 0) continue;

        // プール上限による縮小
        const scale = totalRaw > 0 ? Math.min(1, pool / totalRaw) : 1;

        // 参加者ごとの払戻を集計
        const perUser = new Map();
        for (const w of wonBets) {
          const payout = w.raw * scale;
          perUser.set(w.name, (perUser.get(w.name) || 0) + payout);
        }
        // 各参加者の最大値を更新
        for (const [name, payout] of perUser) {
          if (payout > (userMax.get(name) || 0)) {
            userMax.set(name, payout);
          }
        }
      }
    }
  }

  // オブジェクト形式で返却
  const result = {};
  for (const [name, payout] of userMax) {
    result[name] = Math.round(payout);
  }
  return result;
}

// ─── API ───
app.get('/api/teams', (_req, res) => res.json(TEAMS));
app.get('/api/bet-types', (_req, res) => res.json(BET_TYPES));
app.get('/api/config', (_req, res) => res.json({ initialCoins: INITIAL_COINS }));

// チーム別オッズ（単勝＋複勝）一覧
app.get('/api/odds', (_req, res) => {
  const data = loadData();
  const result = TEAMS.map(t => ({
    ...t,
    winOdds: data.odds[t.code] || t.defaultOdds,
    placeOdds: calcPlaceOdds(data.odds[t.code] || t.defaultOdds),
  }));
  res.json(result);
});

// 組み合わせオッズ計算（三連複・三連単用）
app.post('/api/calc-odds', (req, res) => {
  const { type, picks } = req.body;
  const data = loadData();
  const odds = getOddsForBet(data.odds, type, picks);
  res.json({ odds });
});

// 残高取得
app.get('/api/balance/:name', (req, res) => {
  const data = loadData();
  const balance = getBalance(data.bets, req.params.name);
  res.json({ name: req.params.name, balance, initialCoins: INITIAL_COINS });
});

// 投票
app.post('/api/bet', (req, res) => {
  const { name, type, picks, amount } = req.body;
  if (!name || !type || !picks || !amount) {
    return res.status(400).json({ error: '全項目を入力してください' });
  }
  if (!BET_TYPES[type]) {
    return res.status(400).json({ error: '無効な賭け式です' });
  }
  if (!Array.isArray(picks) || picks.length !== BET_TYPES[type].picks) {
    return res.status(400).json({ error: `${BET_TYPES[type].name}は${BET_TYPES[type].picks}チーム選択してください` });
  }
  const amt = parseInt(amount);
  if (isNaN(amt) || amt < 100) {
    return res.status(400).json({ error: '最低100コインから賭けられます' });
  }
  if (amt % 100 !== 0) {
    return res.status(400).json({ error: '100コイン単位で賭けてください' });
  }

  const data = loadData();
  if (data.votingClosed || data.settled) {
    return res.status(400).json({ error: '投票は締め切られています' });
  }

  const balance = getBalance(data.bets, name.trim());
  if (amt > balance) {
    return res.status(400).json({ error: `コインが足りません（残高: ${balance}コイン）` });
  }

  const betOdds = getOddsForBet(data.odds, type, picks);
  const bet = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    type,
    picks,
    amount: amt,
    odds: betOdds,
    timestamp: new Date().toISOString(),
  };
  data.bets.push(bet);
  saveData(data);
  res.json({ success: true, bet, balance: balance - amt });
});

// 投票一覧
app.get('/api/bets', (_req, res) => {
  const data = loadData();
  res.json(data.bets);
});

// プール状況
app.get('/api/pool', (_req, res) => {
  const data = loadData();
  const stats = getPoolStats(data);

  // 各賭けの「もし当たれば」の最大払戻総額（参考値）
  // ＝オッズ通り払うと想定した時の最大払戻総額（実際の最大はもっと小さい）
  // 単勝で全員同じ国に賭けた場合の最大などのワーストケース推定
  const maxRawByType = {};
  for (const type of ['win', 'place', 'trio', 'trifecta']) {
    const typeBets = data.bets.filter(b => b.type === type);
    // 最も払戻が大きくなる組み合わせを試算（同じ組合せに賭けた合計が最大の所が当たる場合）
    const comboTotals = {};
    for (const bet of typeBets) {
      const key = type === 'trifecta' ? bet.picks.join('-') : [...bet.picks].sort().join('-');
      comboTotals[key] = (comboTotals[key] || 0) + bet.amount * bet.odds;
    }
    maxRawByType[type] = Math.max(0, ...Object.values(comboTotals));
  }
  const maxRawPayout = Math.max(0, ...Object.values(maxRawByType));
  const wouldScale = maxRawPayout > stats.pool;
  const estimatedScale = wouldScale ? stats.pool / maxRawPayout : 1;

  res.json({
    ...stats,
    maxRawPayout: Math.round(maxRawPayout),
    wouldScale,
    estimatedScale: Math.round(estimatedScale * 100) / 100,
  });
});

// 投票取消（本人のみ）
app.delete('/api/bet/:id', (req, res) => {
  const data = loadData();
  if (data.votingClosed || data.settled) {
    return res.status(400).json({ error: '投票は締め切られています' });
  }
  const idx = data.bets.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '投票が見つかりません' });

  const requester = (req.body && req.body.name || '').trim();
  if (!requester || requester !== data.bets[idx].name) {
    return res.status(403).json({ error: '自分の投票のみ取り消せます' });
  }

  data.bets.splice(idx, 1);
  saveData(data);
  res.json({ success: true });
});

// 参加者一覧（残高付き / プール調整後の真の最大払戻つき）
app.get('/api/participants', (_req, res) => {
  const data = loadData();
  const stats = getPoolStats(data);
  const names = [...new Set(data.bets.map(b => b.name))];

  // 全シナリオ列挙で各参加者の最大払戻を一括計算（全他人の投票を反映）
  const maxPayoutMap = projectMaxPayoutFull(data.bets, stats.pool);

  const participants = names.map(name => {
    const userBets = data.bets.filter(b => b.name === name);
    const spent = userBets.reduce((s, b) => s + b.amount, 0);
    const rawMax = Math.max(0, ...userBets.map(b => Math.round(b.amount * b.odds)));
    return {
      name,
      betCount: userBets.length,
      spent,
      balance: INITIAL_COINS - spent,
      rawMaxPayout: rawMax,                       // オッズそのまま
      projectedMaxPayout: maxPayoutMap[name] || 0, // 全シナリオ総当たりで導出
    };
  });
  res.json(participants);
});

// ─── 管理者API ───
// オッズ更新
app.post('/api/admin/odds', (req, res) => {
  const { adminKey, odds } = req.body;
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: '管理者キーが正しくありません' });
  const data = loadData();
  data.odds = { ...data.odds, ...odds };
  saveData(data);
  res.json({ success: true });
});

// 投票締切トグル（取消可能）
app.post('/api/admin/close', (req, res) => {
  const { adminKey, closed } = req.body;
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: '管理者キーが正しくありません' });
  const data = loadData();
  if (data.settled) {
    return res.status(400).json({ error: '結果確定済のため、まず結果確定を取り消してください' });
  }
  data.votingClosed = !!closed;
  saveData(data);
  res.json({ success: true, votingClosed: data.votingClosed });
});

// 結果確定の取り消し（payoutsを破棄して再投票可能に戻す）
app.post('/api/admin/unsettle', (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: '管理者キーが正しくありません' });
  const data = loadData();
  data.settled = false;
  data.results = null;
  data.payouts = null;
  data.adjustment = null;
  // votingClosed は維持（明示的に再開する設計）
  saveData(data);
  res.json({ success: true });
});

// 結果確定
app.post('/api/admin/settle', (req, res) => {
  const { adminKey, results } = req.body;
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: '管理者キーが正しくありません' });
  if (!results || results.length !== 3) {
    return res.status(400).json({ error: '上位3カ国を指定してください' });
  }

  const data = loadData();
  data.settled = true;
  data.votingClosed = true;
  data.results = results;

  // まず生払戻（オッズそのまま）を計算
  const rawPayouts = data.bets.map(bet => {
    let won = false;
    switch (bet.type) {
      case 'win':
        won = bet.picks[0] === results[0];
        break;
      case 'place':
        won = results.includes(bet.picks[0]);
        break;
      case 'trio': {
        const sorted = [...bet.picks].sort().join('-');
        const resultSorted = [...results].sort().join('-');
        won = sorted === resultSorted;
        break;
      }
      case 'trifecta':
        won = bet.picks.join('-') === results.join('-');
        break;
    }
    const rawPayout = won ? Math.round(bet.amount * bet.odds) : 0;
    return { ...bet, won, rawPayout };
  });

  // プール上限による調整
  const stats = getPoolStats(data);
  const totalRaw = rawPayouts.reduce((s, p) => s + p.rawPayout, 0);
  const scale = (totalRaw > stats.pool && totalRaw > 0) ? stats.pool / totalRaw : 1;

  const payouts = rawPayouts.map(p => ({
    ...p,
    payout: Math.round(p.rawPayout * scale),
    effectiveOdds: p.amount > 0 ? Math.round((p.rawPayout * scale / p.amount) * 100) / 100 : 0,
  }));

  data.payouts = payouts;
  data.adjustment = {
    pool: stats.pool,
    participantCount: stats.participantCount,
    totalRawPayout: Math.round(totalRaw),
    totalActualPayout: payouts.reduce((s, p) => s + p.payout, 0),
    scale: Math.round(scale * 1000) / 1000,
    adjusted: scale < 1,
  };
  saveData(data);

  // ランキング計算
  const names = [...new Set(payouts.map(p => p.name))];
  const ranking = names.map(name => {
    const userBets = payouts.filter(p => p.name === name);
    const totalSpent = userBets.reduce((s, b) => s + b.amount, 0);
    const totalPayout = userBets.reduce((s, b) => s + b.payout, 0);
    const remaining = INITIAL_COINS - totalSpent;
    return {
      name,
      remaining,
      totalPayout,
      finalCoins: remaining + totalPayout,
      wins: userBets.filter(b => b.won).length,
    };
  }).sort((a, b) => b.finalCoins - a.finalCoins);

  res.json({ results, payouts, ranking });
});

// ステータス
app.get('/api/status', (_req, res) => {
  const data = loadData();
  res.json({
    votingClosed: !!data.votingClosed,
    settled: !!data.settled,
    results: data.results,
    semifinalists: data.semifinalists || null,
    totalBets: data.bets.length,
    payouts: data.payouts || null,
    adjustment: data.adjustment || null,
  });
});

// デモデータ生成（20人がランダム投票）
app.post('/api/admin/demo', (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: '管理者キーが正しくありません' });
  const data = loadData();
  if (data.settled) return res.status(400).json({ error: '結果確定済のため取消してから実行してください' });

  // 既存のデモ投票（プレフィックス Demo_ で始まる名前）を削除して上書き
  data.bets = data.bets.filter(b => !b.name.startsWith('Demo_'));

  const names = [
    'Demo_田中', 'Demo_佐藤', 'Demo_鈴木', 'Demo_高橋', 'Demo_伊藤',
    'Demo_渡辺', 'Demo_山本', 'Demo_中村', 'Demo_小林', 'Demo_加藤',
    'Demo_吉田', 'Demo_山田', 'Demo_佐々木', 'Demo_山口', 'Demo_松本',
    'Demo_井上', 'Demo_木村', 'Demo_林', 'Demo_斎藤', 'Demo_清水',
  ];

  // オッズが低い（人気）チームほど選ばれやすい重み
  function pickTeam(exclude = []) {
    const candidates = TEAMS.filter(t => !exclude.includes(t.code));
    const weights = candidates.map(t => {
      const o = data.odds[t.code] || t.defaultOdds;
      // 人気度: オッズが低いほど高い重み (1/odds系)
      return Math.pow(1 / o, 0.6);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i].code;
    }
    return candidates[candidates.length - 1].code;
  }

  function randAmount(maxBalance) {
    // 100コイン単位、200〜1500の間で
    const max = Math.min(1500, maxBalance);
    if (max < 100) return 0;
    const n = Math.floor(Math.random() * (max / 100)) + 1;
    return n * 100;
  }

  const typeWeights = [
    { type: 'win', weight: 40 },
    { type: 'place', weight: 30 },
    { type: 'trio', weight: 15 },
    { type: 'trifecta', weight: 15 },
  ];
  function pickType() {
    const total = typeWeights.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of typeWeights) {
      r -= t.weight;
      if (r <= 0) return t.type;
    }
    return 'win';
  }

  for (const name of names) {
    let balance = INITIAL_COINS;
    const betCount = 1 + Math.floor(Math.random() * 4); // 1〜4票

    for (let i = 0; i < betCount; i++) {
      if (balance < 100) break;
      const type = pickType();
      const picksNeeded = BET_TYPES[type].picks;
      const picks = [];
      while (picks.length < picksNeeded) {
        picks.push(pickTeam(picks));
      }
      const amount = randAmount(balance);
      if (amount < 100) break;
      const betOdds = getOddsForBet(data.odds, type, picks);
      data.bets.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name, type, picks, amount, odds: betOdds,
        timestamp: new Date().toISOString(),
      });
      balance -= amount;
    }
  }

  saveData(data);
  res.json({
    success: true,
    generated: data.bets.filter(b => b.name.startsWith('Demo_')).length,
    participants: names.length,
  });
});

// デモデータ削除
app.post('/api/admin/demo-clear', (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: '管理者キーが正しくありません' });
  const data = loadData();
  if (data.settled) return res.status(400).json({ error: '結果確定済のため取消してから実行してください' });
  const before = data.bets.length;
  data.bets = data.bets.filter(b => !b.name.startsWith('Demo_'));
  saveData(data);
  res.json({ success: true, removed: before - data.bets.length });
});

// データバックアップ（ダウンロード）
app.get('/api/admin/export', (req, res) => {
  const adminKey = req.query.key;
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: '管理者キーが正しくありません' });
  const data = loadData();
  const filename = `wc2026-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g, '-')}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(data, null, 2));
});

// データ復元（アップロード）
app.post('/api/admin/import', (req, res) => {
  const { adminKey, data: backupData } = req.body;
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: '管理者キーが正しくありません' });
  if (!backupData || typeof backupData !== 'object') {
    return res.status(400).json({ error: 'バックアップデータが不正です' });
  }
  // 必須フィールドの簡易チェック
  if (!Array.isArray(backupData.bets) || typeof backupData.odds !== 'object') {
    return res.status(400).json({ error: 'データ形式が不正です（bets / odds が必要）' });
  }
  // 既存データを退避（万一に備えて）
  try {
    const current = loadData();
    fs.writeFileSync(DATA_FILE + '.prev', JSON.stringify(current, null, 2), 'utf-8');
  } catch (e) { /* ignore */ }
  saveData(backupData);
  res.json({
    success: true,
    bets: backupData.bets.length,
    settled: !!backupData.settled,
  });
});

// リセット
app.post('/api/admin/reset', (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: '管理者キーが正しくありません' });
  const defaultOdds = {};
  TEAMS.forEach(t => { defaultOdds[t.code] = t.defaultOdds; });
  const initial = {
    odds: defaultOdds, bets: [],
    votingClosed: false, settled: false,
    results: null, payouts: null, adjustment: null, semifinalists: null,
  };
  saveData(initial);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`W杯2026予想大会サーバー起動: http://localhost:${PORT}`);
});
