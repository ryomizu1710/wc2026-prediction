// ─── State ───
let teams = [];
let oddsData = [];       // { code, name, group, winOdds, placeOdds }[]
let currentBetType = 'win';
let picks = [];
let balance = 5000;
let initialCoins = 5000;

const TYPE_NAMES = { win: '単勝', place: '複勝', trio: '三連複', trifecta: '三連単' };

// ─── 国旗HTML生成（flagcdn.com の PNG） ───
function flagImg(team, size = 'sm') {
  if (!team || !team.iso2) return '';
  const w = size === 'lg' ? 80 : size === 'md' ? 40 : 20;
  return `<img class="flag flag-${size}" src="https://flagcdn.com/w${w}/${team.iso2}.png" alt="${team.name}" loading="lazy">`;
}
function teamWithFlag(code, size = 'sm') {
  const t = teams.find(t => t.code === code);
  if (!t) return code;
  return `${flagImg(t, size)}<span class="team-label">${t.name}</span>`;
}
const BET_CONFIG = {
  win:      { picks: 1, labels: ['優勝'] },
  place:    { picks: 1, labels: ['3位以内'] },
  trio:     { picks: 3, labels: ['1カ国目', '2カ国目', '3カ国目'] },
  trifecta: { picks: 3, labels: ['1位（優勝）', '2位（準優勝）', '3位'] },
};

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
  const [teamsRes, configRes, oddsRes] = await Promise.all([
    fetch('/api/teams').then(r => r.json()),
    fetch('/api/config').then(r => r.json()),
    fetch('/api/odds').then(r => r.json()),
  ]);
  teams = teamsRes;
  initialCoins = configRes.initialCoins;
  oddsData = oddsRes;

  const saved = localStorage.getItem('voterName');
  if (saved) {
    document.getElementById('voterName').value = saved;
    refreshBalance();
  }

  setupTabs();
  setupBetTypeCards();
  setupAmountControls();
  setupNameChangeHandler();
  renderTeamGrid();
  renderPickSlots();
  setupSubmit();
  setupAdmin();
  refreshPoolStatus();
});

// ─── Pool Status ───
async function refreshPoolStatus() {
  try {
    const res = await fetch('/api/pool');
    const p = await res.json();
    document.getElementById('poolParticipants').textContent = p.participantCount.toLocaleString();
    document.getElementById('poolTotal').textContent = p.pool.toLocaleString();
    document.getElementById('poolBet').textContent = p.totalBet.toLocaleString();

    const adjustEl = document.getElementById('poolAdjust');
    const adjustBox = document.getElementById('poolAdjustBox');
    if (p.wouldScale && p.estimatedScale < 1) {
      adjustEl.innerHTML = `×${p.estimatedScale.toFixed(2)} <span style="font-size:0.7rem">(縮小)</span>`;
      adjustBox.classList.add('warning');
    } else {
      adjustEl.textContent = '調整なし';
      adjustBox.classList.remove('warning');
    }
  } catch (e) { /* ignore */ }
}

// ─── Tabs ───
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'odds') loadOddsTable();
      if (tab.dataset.tab === 'history') loadHistory();
      if (tab.dataset.tab === 'ranking') loadRanking();
      if (tab.dataset.tab === 'vote') refreshPoolStatus();
    });
  });
}

// ─── Balance ───
function setupNameChangeHandler() {
  let debounce;
  document.getElementById('voterName').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(refreshBalance, 400);
  });
}

async function refreshBalance() {
  const name = document.getElementById('voterName').value.trim();
  if (!name) {
    balance = initialCoins;
  } else {
    const res = await fetch(`/api/balance/${encodeURIComponent(name)}`);
    const data = await res.json();
    balance = data.balance;
  }
  document.getElementById('balanceValue').textContent = balance.toLocaleString();
  document.getElementById('headerBalance').textContent = balance.toLocaleString();
  updatePayoutPreview();
}

// ─── Bet Type ───
function setupBetTypeCards() {
  document.querySelectorAll('.bet-type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.bet-type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      currentBetType = card.dataset.type;
      picks = [];
      renderPickSlots();
      renderTeamGrid();
      updatePickLabel();
      updateBetAmountVisibility();
    });
  });
  updatePickLabel();
}

function updatePickLabel() {
  const labels = {
    win: '優勝国を選択',
    place: '3位以内に入る国を選択',
    trio: '上位3カ国を選択（順不同）',
    trifecta: '1位→2位→3位の順に選択',
  };
  document.getElementById('pickLabel').textContent = labels[currentBetType];
}

// ─── Pick Slots ───
function renderPickSlots() {
  const container = document.getElementById('pickSlots');
  const config = BET_CONFIG[currentBetType];
  container.innerHTML = '';

  for (let i = 0; i < config.picks; i++) {
    const slot = document.createElement('div');
    slot.className = 'pick-slot' + (picks[i] ? ' filled' : '');

    if (picks[i]) {
      const team = teams.find(t => t.code === picks[i]);
      const od = oddsData.find(o => o.code === picks[i]);
      const odds = currentBetType === 'win' ? od?.winOdds : od?.placeOdds;
      slot.innerHTML = `
        <span class="slot-label">${config.labels[i]}</span>
        <span class="slot-team">${flagImg(team, 'sm')}<span>${team?.name || picks[i]}</span></span>
        ${config.picks === 1 ? `<span class="slot-odds">${odds?.toFixed(1)}倍</span>` : ''}
        <span class="remove-pick" data-idx="${i}">✕</span>
      `;
    } else {
      slot.innerHTML = `<span class="slot-label">${config.labels[i]}</span><span class="slot-team">—</span>`;
    }
    container.appendChild(slot);
  }

  container.querySelectorAll('.remove-pick').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      picks.splice(parseInt(btn.dataset.idx), 1);
      renderPickSlots();
      renderTeamGrid();
      updateBetAmountVisibility();
    });
  });
}

// ─── Team Grid ───
function renderTeamGrid() {
  const grid = document.getElementById('teamGrid');
  grid.innerHTML = '';
  const config = BET_CONFIG[currentBetType];
  const groups = [...new Set(teams.map(t => t.group))].sort();

  for (const group of groups) {
    const section = document.createElement('div');
    section.className = 'group-section';

    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `<span class="group-badge">Group ${group}</span>`;
    section.appendChild(header);

    const row = document.createElement('div');
    row.className = 'group-row';

    const groupTeams = teams.filter(t => t.group === group);
    for (const team of groupTeams) {
      const od = oddsData.find(o => o.code === team.code);
      const odds = currentBetType === 'place' ? od?.placeOdds : od?.winOdds;
      const isSelected = picks.includes(team.code);
      const isFull = picks.length >= config.picks && !isSelected;
      const pickIdx = picks.indexOf(team.code);

      const btn = document.createElement('button');
      btn.className = 'team-btn' + (isSelected ? ' selected' : '') + (isFull ? ' disabled' : '');
      const orderBadge = (currentBetType === 'trifecta' && isSelected)
        ? `<span class="order-badge">${pickIdx + 1}</span>` : '';
      btn.innerHTML = `
        ${orderBadge}
        ${flagImg(team, 'md')}
        <span class="team-name">${team.name}</span>
        <span class="team-odds">${odds?.toFixed(1)}倍</span>
      `;
      btn.addEventListener('click', () => {
        if (isFull && !isSelected) return;
        if (isSelected) picks = picks.filter(p => p !== team.code);
        else picks.push(team.code);
        renderPickSlots();
        renderTeamGrid();
        updateBetAmountVisibility();
      });
      row.appendChild(btn);
    }
    section.appendChild(row);
    grid.appendChild(section);
  }
}

// ─── Amount ───
function setupAmountControls() {
  document.querySelectorAll('.amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('betAmount');
      let val = parseInt(input.value) || 0;
      val += parseInt(btn.dataset.delta);
      val = Math.max(100, Math.min(val, balance));
      val = Math.round(val / 100) * 100;
      input.value = val;
      updatePayoutPreview();
    });
  });
  document.getElementById('betAmount').addEventListener('input', updatePayoutPreview);
}

function updateBetAmountVisibility() {
  const config = BET_CONFIG[currentBetType];
  const ready = picks.length === config.picks;
  document.getElementById('betAmountSection').style.display = ready ? 'block' : 'none';
  if (ready) {
    const input = document.getElementById('betAmount');
    if (parseInt(input.value) > balance) input.value = Math.floor(balance / 100) * 100;
    updatePayoutPreview();
  }
}

async function updatePayoutPreview() {
  const config = BET_CONFIG[currentBetType];
  if (picks.length !== config.picks) return;

  const [oddsRes, poolRes] = await Promise.all([
    fetch('/api/calc-odds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: currentBetType, picks }),
    }).then(r => r.json()),
    fetch('/api/pool').then(r => r.json()),
  ]);
  const amount = parseInt(document.getElementById('betAmount').value) || 0;
  const rawPayout = Math.round(amount * oddsRes.odds);
  document.getElementById('previewOdds').textContent = oddsRes.odds.toFixed(1);

  // プール上限考慮：単独で全プールを上限とした実効払戻
  const cap = poolRes.pool;
  const adjustedPayout = cap > 0 ? Math.min(rawPayout, cap) : rawPayout;
  const wasCapped = adjustedPayout < rawPayout;
  const previewEl = document.getElementById('payoutPreview');
  if (wasCapped) {
    previewEl.innerHTML = `${adjustedPayout.toLocaleString()} <span style="font-size:0.75rem;color:#ff9966">(プール上限 🪙${cap.toLocaleString()} で頭打ち)</span>`;
  } else {
    previewEl.textContent = rawPayout.toLocaleString();
  }
}

// ─── Submit ───
function setupSubmit() {
  document.getElementById('submitBet').addEventListener('click', async () => {
    const name = document.getElementById('voterName').value.trim();
    const msg = document.getElementById('voteMessage');
    const config = BET_CONFIG[currentBetType];

    if (!name) return showMessage(msg, '名前を入力してください', 'error');
    if (picks.length !== config.picks) return showMessage(msg, `${config.picks}チーム選択してください`, 'error');

    const amount = parseInt(document.getElementById('betAmount').value);
    if (!amount || amount < 100) return showMessage(msg, '100コイン以上賭けてください', 'error');

    localStorage.setItem('voterName', name);

    const res = await fetch('/api/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: currentBetType, picks, amount }),
    });
    const data = await res.json();

    if (data.success) {
      const teamNames = picks.map(c => teams.find(t => t.code === c)?.name || c).join(' → ');
      showMessage(msg,
        `投票完了！ [${TYPE_NAMES[currentBetType]}] ${teamNames} に ${amount.toLocaleString()}コイン（${data.bet.odds.toFixed(1)}倍）`,
        'success'
      );
      picks = [];
      renderPickSlots();
      renderTeamGrid();
      document.getElementById('betAmountSection').style.display = 'none';
      balance = data.balance;
      document.getElementById('balanceValue').textContent = balance.toLocaleString();
      document.getElementById('headerBalance').textContent = balance.toLocaleString();
      refreshPoolStatus();
    } else {
      showMessage(msg, data.error, 'error');
    }
  });
}

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = 'message ' + type;
  setTimeout(() => { el.className = 'message'; }, 5000);
}

// ─── Odds Table ───
async function loadOddsTable() {
  const res = await fetch('/api/odds');
  oddsData = await res.json();
  renderOddsTable();

  document.getElementById('oddsSort').addEventListener('change', renderOddsTable);
}

function renderOddsTable() {
  const container = document.getElementById('oddsTable');
  const sort = document.getElementById('oddsSort').value;

  let sorted = [...oddsData];
  if (sort === 'odds-asc') sorted.sort((a, b) => a.winOdds - b.winOdds);
  else if (sort === 'odds-desc') sorted.sort((a, b) => b.winOdds - a.winOdds);
  else sorted.sort((a, b) => a.group.localeCompare(b.group));

  let html = `<table class="odds-table">
    <thead><tr><th>国</th><th>Group</th><th>単勝</th><th>複勝</th></tr></thead><tbody>`;

  for (const t of sorted) {
    const cls = t.winOdds <= 10 ? 'fav' : t.winOdds <= 30 ? 'mid' : 'long';
    html += `<tr>
      <td class="td-team">${flagImg(t, 'sm')}<span>${t.name}</span></td>
      <td style="color:#667">${t.group}</td>
      <td><span class="odds-val ${cls}">${t.winOdds.toFixed(1)}倍</span></td>
      <td><span class="odds-val">${t.placeOdds.toFixed(1)}倍</span></td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ─── History ───
async function loadHistory() {
  const res = await fetch('/api/bets');
  const bets = await res.json();
  const container = document.getElementById('betHistory');
  const filter = document.getElementById('historyFilter');

  // Update filter options
  const names = [...new Set(bets.map(b => b.name))];
  const currentFilter = filter.value;
  filter.innerHTML = '<option value="all">全員</option>' +
    names.map(n => `<option value="${n}">${n}</option>`).join('');
  filter.value = currentFilter;
  filter.onchange = () => renderHistory(bets);

  renderHistory(bets);
}

function renderHistory(bets) {
  const container = document.getElementById('betHistory');
  const filterVal = document.getElementById('historyFilter').value;
  const filtered = filterVal === 'all' ? bets : bets.filter(b => b.name === filterVal);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">投票がありません</div>';
    return;
  }

  const currentName = (document.getElementById('voterName').value.trim()
    || localStorage.getItem('voterName') || '').trim();

  let html = '';
  for (const bet of [...filtered].reverse()) {
    const teamNames = bet.picks.map(c => teamWithFlag(c, 'sm'));
    const sep = bet.type === 'trifecta' ? ' → ' : ' / ';
    const time = new Date(bet.timestamp).toLocaleString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const isMine = currentName && bet.name === currentName;
    const deleteBtn = isMine
      ? `<button class="bet-delete" data-id="${bet.id}">取消</button>`
      : '';

    html += `<div class="bet-entry${isMine ? ' my-bet' : ''}">
      <span class="bet-name">${bet.name}${isMine ? ' <span class="mine-tag">自分</span>' : ''}</span>
      <span class="bet-type-badge">${TYPE_NAMES[bet.type]}</span>
      <span class="bet-picks">${teamNames.join(sep)}</span>
      <span class="bet-coins">🪙${bet.amount.toLocaleString()}</span>
      <span class="bet-odds-badge">${bet.odds.toFixed(1)}倍</span>
      <span style="font-size:0.7rem;color:#556">${time}</span>
      ${deleteBtn}
    </div>`;
  }
  container.innerHTML = html;

  container.querySelectorAll('.bet-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('この投票を取り消しますか？')) return;
      const res = await fetch(`/api/bet/${btn.dataset.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: currentName }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || '取消に失敗しました');
      }
      loadHistory();
      refreshBalance();
      refreshPoolStatus();
    });
  });
}

// ─── Ranking ───
async function loadRanking() {
  const [statusRes, betsRes] = await Promise.all([
    fetch('/api/status').then(r => r.json()),
    fetch('/api/bets').then(r => r.json()),
  ]);
  const container = document.getElementById('rankingContent');

  if (betsRes.length === 0) {
    container.innerHTML = '<div class="empty-state">まだ投票がありません</div>';
    return;
  }

  // 結果確定後
  if (statusRes.settled && statusRes.payouts) {
    const resultTeams = (statusRes.results || []).map(c => teamWithFlag(c, 'sm'));
    let html = `<div class="result-badges">
      <span class="result-badge gold">🥇 ${resultTeams[0] || '?'}</span>
      <span class="result-badge silver">🥈 ${resultTeams[1] || '?'}</span>
      <span class="result-badge bronze">🥉 ${resultTeams[2] || '?'}</span>
    </div>`;

    // 調整情報
    if (statusRes.adjustment) {
      const a = statusRes.adjustment;
      if (a.adjusted) {
        html += `<div class="adjust-box warning">
          ⚠️ <strong>払戻調整あり</strong><br>
          賞金プール上限 🪙${a.pool.toLocaleString()}（${a.participantCount}人×5,000）に対し、
          生払戻総額 🪙${a.totalRawPayout.toLocaleString()} だったため、
          全当選者に <strong>×${a.scale.toFixed(3)}</strong> の係数を適用しました。
          <br>実際の払戻総額: 🪙${a.totalActualPayout.toLocaleString()}
        </div>`;
      } else {
        html += `<div class="adjust-box ok">
          ✅ 賞金プール上限 🪙${a.pool.toLocaleString()} の範囲内のため、オッズ通り払い戻されました。
          <br>払戻総額: 🪙${a.totalActualPayout.toLocaleString()}
        </div>`;
      }
    }

    const names = [...new Set(statusRes.payouts.map(p => p.name))];
    const ranking = names.map(name => {
      const userBets = statusRes.payouts.filter(p => p.name === name);
      const spent = userBets.reduce((s, b) => s + b.amount, 0);
      const payout = userBets.reduce((s, b) => s + b.payout, 0);
      const remaining = initialCoins - spent;
      return { name, remaining, payout, final: remaining + payout, wins: userBets.filter(b => b.won).length };
    }).sort((a, b) => b.final - a.final);

    html += renderRankingTable(ranking, true);

    // 的中詳細
    const winners = statusRes.payouts.filter(p => p.won);
    if (winners.length > 0) {
      html += '<h3 style="margin-top:1.5rem;color:#0a3;">的中一覧</h3>';
      for (const p of winners) {
        const tNames = p.picks.map(c => teamWithFlag(c, 'sm'));
        const sep = p.type === 'trifecta' ? ' → ' : ' / ';
        const effOdds = p.effectiveOdds !== undefined ? p.effectiveOdds : p.odds;
        const oddsBadge = (effOdds < p.odds)
          ? `<span style="color:#889">表示${p.odds.toFixed(1)}倍 → 実効<strong style="color:#ff9966">${effOdds.toFixed(2)}倍</strong></span>`
          : `×${p.odds.toFixed(1)}倍`;
        html += `<div class="payout-entry won">
          <strong>${p.name}</strong>
          <span class="bet-type-badge">${TYPE_NAMES[p.type]}</span>
          ${tNames.join(sep)} ${oddsBadge}
          🪙${p.amount.toLocaleString()} → <span class="payout-amount">🪙${p.payout.toLocaleString()}</span>
        </div>`;
      }
    }

    container.innerHTML = html;
    return;
  }

  // 確定前：現在の投資状況（プール調整後の最大払戻試算付き）
  const partsRes = await fetch('/api/participants').then(r => r.json());
  const poolRes = await fetch('/api/pool').then(r => r.json());

  const ranking = [...partsRes].sort((a, b) =>
    (b.projectedMaxPayout + b.balance) - (a.projectedMaxPayout + a.balance)
  );

  let html = `<p class="note">
    大会終了後、管理者が結果を確定するとランキングが決まります。<br>
    「最大払戻（試算）」は <strong>プール上限 🪙${poolRes.pool.toLocaleString()}</strong> と
    同じ国へ賭けた他の人の投票額を考慮した <strong>近似値</strong> です。
    他の人が投票するたびに変動する可能性があります。
  </p>`;
  html += `<table class="ranking-table">
    <thead><tr>
      <th>#</th><th>名前</th><th>投票数</th><th>使用</th><th>残高</th>
      <th>最大払戻<br><span style="font-weight:400;color:#667;font-size:0.7rem">(調整前 → 調整後)</span></th>
    </tr></thead><tbody>`;

  ranking.forEach((r, i) => {
    const adjusted = r.projectedMaxPayout < r.rawMaxPayout;
    html += `<tr>
      <td>${i + 1}</td>
      <td>${r.name}</td>
      <td>${r.betCount}票</td>
      <td>🪙${r.spent.toLocaleString()}</td>
      <td>🪙${r.balance.toLocaleString()}</td>
      <td style="color:#69db7c">
        ${adjusted
          ? `<span style="color:#889;text-decoration:line-through;font-size:0.8rem">🪙${r.rawMaxPayout.toLocaleString()}</span><br>🪙${r.projectedMaxPayout.toLocaleString()}`
          : `🪙${r.projectedMaxPayout.toLocaleString()}`}
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  html += `<details style="margin-top:1rem;color:#889;font-size:0.8rem;">
    <summary style="cursor:pointer;color:#aab">最大払戻試算の仕組み（クリックで展開）</summary>
    <div style="padding:0.6rem;background:#0d1130;border-radius:6px;margin-top:0.5rem;line-height:1.6">
      ・各人の「最も払戻が大きい賭け」が当たるシナリオを想定<br>
      ・そのシナリオで <strong>確実に同時当選する全ての賭け</strong> の生払戻総額を計算<br>
      ・プール上限を超える場合は係数で全員縮小（最終的な払戻ロジックと同じ）<br>
      ・自分の同時当選分の払戻 = この値が「最大払戻」<br>
      ・<strong style="color:#ff9966">注意：</strong> 三連単／三連複は2〜3位次第で当落が変わるため、
      単勝・複勝の同時当選のみを「確実」として扱う近似計算です
    </div>
  </details>`;
  container.innerHTML = html;
}

function renderRankingTable(ranking, settled) {
  const medals = ['🥇', '🥈', '🥉'];
  let html = `<table class="ranking-table">
    <thead><tr><th>#</th><th>名前</th><th>残高</th><th>払戻</th><th>最終コイン</th><th>損益</th></tr></thead><tbody>`;

  ranking.forEach((r, i) => {
    const profit = r.final - initialCoins;
    const profitClass = profit >= 0 ? 'positive' : 'negative';
    const profitStr = (profit >= 0 ? '+' : '') + profit.toLocaleString();

    html += `<tr>
      <td>${medals[i] || (i + 1)}</td>
      <td>${r.name}</td>
      <td>🪙${r.remaining.toLocaleString()}</td>
      <td>🪙${r.payout.toLocaleString()}</td>
      <td class="rank-coins">🪙${r.final.toLocaleString()}</td>
      <td class="rank-profit ${profitClass}">${profitStr}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  return html;
}

// ─── Admin ───
function setupAdmin() {
  // Odds editor
  renderOddsEditor();

  document.getElementById('saveOddsBtn').addEventListener('click', saveOdds);

  // Result selects（グループごとに optgroup で整理）
  const groups = [...new Set(teams.map(t => t.group))].sort();
  const opts = groups.map(g => {
    const gTeams = teams.filter(t => t.group === g);
    const items = gTeams.map(t => `<option value="${t.code}">${t.name}</option>`).join('');
    return `<optgroup label="Group ${g}">${items}</optgroup>`;
  }).join('');
  ['result1', 'result2', 'result3'].forEach(id => {
    document.getElementById(id).innerHTML = opts;
  });

  document.getElementById('settleBtn').addEventListener('click', settleResults);
  document.getElementById('unsettleBtn').addEventListener('click', unsettleResults);
  document.getElementById('closeBtn').addEventListener('click', () => toggleClose(true));
  document.getElementById('reopenBtn').addEventListener('click', () => toggleClose(false));
  document.getElementById('resetBtn').addEventListener('click', resetAll);
  document.getElementById('demoBtn').addEventListener('click', generateDemo);
  document.getElementById('demoClearBtn').addEventListener('click', clearDemo);
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', importData);

  refreshAdminState();
}

async function refreshAdminState() {
  const status = await fetch('/api/status').then(r => r.json());
  // 投票締切表示
  const closeStateEl = document.getElementById('closeState');
  const closeStateBox = document.getElementById('closeStateBox');
  const closeBtn = document.getElementById('closeBtn');
  const reopenBtn = document.getElementById('reopenBtn');
  if (status.votingClosed) {
    closeStateEl.textContent = '🔒 投票締切中';
    closeStateBox.classList.add('warning');
    closeBtn.style.display = 'none';
    reopenBtn.style.display = status.settled ? 'none' : 'block';
  } else {
    closeStateEl.textContent = '✅ 投票受付中';
    closeStateBox.classList.remove('warning');
    closeBtn.style.display = 'block';
    reopenBtn.style.display = 'none';
  }
  // 結果確定表示
  const settleStateEl = document.getElementById('settleState');
  const settleStateBox = document.getElementById('settleStateBox');
  const settleBtn = document.getElementById('settleBtn');
  const unsettleBtn = document.getElementById('unsettleBtn');
  if (status.settled) {
    settleStateEl.textContent = '🏆 結果確定済';
    settleStateBox.classList.add('warning');
    settleBtn.style.display = 'none';
    unsettleBtn.style.display = 'block';
  } else {
    settleStateEl.textContent = '⏳ 未確定';
    settleStateBox.classList.remove('warning');
    settleBtn.style.display = 'block';
    unsettleBtn.style.display = 'none';
  }
}

async function toggleClose(closed) {
  const adminKey = document.getElementById('adminKey').value;
  const msg = document.getElementById('adminMessage');
  if (!adminKey) return showMessage(msg, '管理者キーを入力してください', 'error');

  const action = closed ? '投票を締め切る' : '投票を再開する';
  if (!confirm(`本当に「${action}」を実行しますか？`)) return;

  const res = await fetch('/api/admin/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey, closed }),
  });
  const data = await res.json();
  if (data.success) {
    showMessage(msg, `${action} を実行しました`, 'success');
    refreshAdminState();
  } else {
    showMessage(msg, data.error, 'error');
  }
}

async function unsettleResults() {
  const adminKey = document.getElementById('adminKey').value;
  const msg = document.getElementById('adminMessage');
  if (!adminKey) return showMessage(msg, '管理者キーを入力してください', 'error');

  if (!confirm(
    '本当に結果確定を取り消しますか？\n\n' +
    '・払戻データが破棄されます\n' +
    '・「ランキング」タブの確定結果も消えます\n' +
    '・投票締切状態は維持されます（必要なら別途解除してください）\n\n' +
    'この操作は元に戻せません。'
  )) return;

  const res = await fetch('/api/admin/unsettle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey }),
  });
  const data = await res.json();
  if (data.success) {
    showMessage(msg, '結果確定を取り消しました', 'success');
    refreshAdminState();
  } else {
    showMessage(msg, data.error, 'error');
  }
}

function renderOddsEditor() {
  const container = document.getElementById('oddsEditor');
  const groups = [...new Set(oddsData.map(t => t.group))].sort();
  let html = '';
  for (const g of groups) {
    html += `<div class="odds-editor-group">
      <div class="group-header"><span class="group-badge">Group ${g}</span></div>
      <div class="odds-editor-grid">`;
    for (const t of oddsData.filter(t => t.group === g)) {
      html += `<div class="odds-editor-item">
        ${flagImg(t, 'sm')}
        <label>${t.name}</label>
        <input type="number" step="0.1" min="1" value="${t.winOdds}" data-code="${t.code}" />
        <span style="color:#667;font-size:0.75rem">倍</span>
      </div>`;
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
}

async function saveOdds() {
  const adminKey = document.getElementById('adminKey').value;
  const msg = document.getElementById('adminMessage');
  const odds = {};
  document.querySelectorAll('#oddsEditor input[data-code]').forEach(input => {
    odds[input.dataset.code] = parseFloat(input.value) || 1;
  });

  const res = await fetch('/api/admin/odds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey, odds }),
  });
  const data = await res.json();
  if (data.success) {
    showMessage(msg, 'オッズを保存しました', 'success');
    const oddsRes = await fetch('/api/odds');
    oddsData = await oddsRes.json();
    renderTeamGrid();
  } else {
    showMessage(msg, data.error, 'error');
  }
}

async function settleResults() {
  const adminKey = document.getElementById('adminKey').value;
  const msg = document.getElementById('adminMessage');
  if (!adminKey) return showMessage(msg, '管理者キーを入力してください', 'error');

  const results = [
    document.getElementById('result1').value,
    document.getElementById('result2').value,
    document.getElementById('result3').value,
  ];

  if (new Set(results).size !== 3) {
    return showMessage(msg, '1位～3位はすべて異なるチームにしてください', 'error');
  }

  // 確認ダイアログ：選択した結果を明示
  const resultNames = results.map(c => teams.find(t => t.code === c)?.name || c);
  if (!confirm(
    '本当に結果を確定しますか？\n\n' +
    `🥇 優勝: ${resultNames[0]}\n` +
    `🥈 準優勝: ${resultNames[1]}\n` +
    `🥉 3位: ${resultNames[2]}\n\n` +
    '・払戻が計算されます\n' +
    '・以降は投票・取消ができなくなります\n' +
    '・取消可能ですが、誤った内容での確定は混乱を招きます'
  )) return;

  const res = await fetch('/api/admin/settle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey, results }),
  });
  const data = await res.json();
  if (data.ranking) {
    showMessage(msg, '結果を確定しました！「ランキング」タブで確認できます。', 'success');
    refreshAdminState();
  } else {
    showMessage(msg, data.error, 'error');
  }
}

function exportData() {
  const adminKey = document.getElementById('adminKey').value;
  const msg = document.getElementById('adminMessage');
  if (!adminKey) return showMessage(msg, '管理者キーを入力してください', 'error');
  // 認証エラーはサーバー側でハンドル、リンクで直接ダウンロード
  const url = `/api/admin/export?key=${encodeURIComponent(adminKey)}`;
  window.location.href = url;
  showMessage(msg, 'バックアップをダウンロードしています...', 'success');
}

async function importData() {
  const adminKey = document.getElementById('adminKey').value;
  const msg = document.getElementById('adminMessage');
  const file = document.getElementById('importFile').files[0];
  if (!adminKey) return showMessage(msg, '管理者キーを入力してください', 'error');
  if (!file) return showMessage(msg, 'バックアップファイルを選択してください', 'error');
  if (!confirm(
    'バックアップを読み込んで現在のデータを上書きしますか？\n\n' +
    '・現在の全投票・結果がバックアップの内容に置き換わります\n' +
    '・この操作は元に戻せません'
  )) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const res = await fetch('/api/admin/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey, data }),
    });
    const json = await res.json();
    if (json.success) {
      showMessage(msg, `復元完了：投票${json.bets}件を読み込みました`, 'success');
      refreshBalance();
      refreshAdminState();
      refreshPoolStatus();
    } else {
      showMessage(msg, json.error || '復元に失敗しました', 'error');
    }
  } catch (e) {
    showMessage(msg, `ファイル読み込みエラー: ${e.message}`, 'error');
  }
}

async function generateDemo() {
  const adminKey = document.getElementById('adminKey').value;
  const msg = document.getElementById('adminMessage');
  if (!adminKey) return showMessage(msg, '管理者キーを入力してください', 'error');
  if (!confirm('20人分のランダム投票デモを生成しますか？\n（既存のDemo_◯◯の投票は上書きされます）')) return;

  const res = await fetch('/api/admin/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey }),
  });
  const data = await res.json();
  if (data.success) {
    showMessage(msg, `デモ投票 ${data.generated}件 を ${data.participants}人分生成しました`, 'success');
    refreshPoolStatus();
  } else {
    showMessage(msg, data.error, 'error');
  }
}

async function clearDemo() {
  const adminKey = document.getElementById('adminKey').value;
  const msg = document.getElementById('adminMessage');
  if (!adminKey) return showMessage(msg, '管理者キーを入力してください', 'error');
  if (!confirm('Demo_◯◯ で始まる投票だけを削除しますか？')) return;

  const res = await fetch('/api/admin/demo-clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey }),
  });
  const data = await res.json();
  if (data.success) {
    showMessage(msg, `デモ投票 ${data.removed}件 を削除しました`, 'success');
    refreshPoolStatus();
  } else {
    showMessage(msg, data.error, 'error');
  }
}

async function resetAll() {
  if (!confirm('全データをリセットしますか？この操作は元に戻せません。')) return;
  const adminKey = document.getElementById('adminKey').value;
  const msg = document.getElementById('adminMessage');

  const res = await fetch('/api/admin/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey }),
  });
  const data = await res.json();
  if (data.success) {
    showMessage(msg, 'リセットしました', 'success');
    refreshBalance();
    refreshAdminState();
    refreshPoolStatus();
  } else {
    showMessage(msg, data.error, 'error');
  }
}
