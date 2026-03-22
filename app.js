// ============ DATA ============
let trades = JSON.parse(localStorage.getItem('ma_trades')) || []
let chart = null
let kzInterval = null

const COINS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'DOGE/USDT',
  'DOT/USDT',
  'MATIC/USDT',
  'LINK/USDT',
  'AVAX/USDT',
  'UNI/USDT',
  'ATOM/USDT',
  'LTC/USDT',
  'ETC/USDT',
  'TRX/USDT',
  'NEAR/USDT',
  'APT/USDT',
  'ARB/USDT',
  'OP/USDT',
]

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  updateClocks()
  setInterval(updateClocks, 1000)
  initKZTracker()
  fetchMarketData()
  setInterval(fetchMarketData, 30000)
  loadCoinSuggestions()
  setupRiskPreview()
  renderHistory()
  updateStats()
})

// ============ TOAST NOTIFICATIONS ============
function toast(msg, type = 'success', duration = 3000) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.className = `toast show ${type}`
  clearTimeout(el._timer)
  el._timer = setTimeout(() => {
    el.className = 'toast'
  }, duration)
}

// ============ NAVIGATION ============
function showSection(id) {
  document
    .querySelectorAll('.app-section')
    .forEach((s) => (s.style.display = 'none'))
  document.getElementById(id).style.display = 'block'
  document
    .querySelectorAll('.nav-item')
    .forEach((btn) => btn.classList.remove('active'))
  document.getElementById(`nav-${id}`).classList.add('active')

  if (id === 'history') renderHistory()
  if (id === 'stats') updateStats()
}

// ============ QUICK COIN SELECT ============
function setQuickCoin(coin) {
  document.getElementById('coin').value = coin
  document.querySelectorAll('.coin-pill').forEach((p) => {
    p.classList.toggle('active', p.textContent === coin.replace('/USDT', ''))
  })
  calcRisk()
}

// ============ RISK CALCULATOR ============
function setupRiskPreview() {
  ;['entry', 'tp', 'sl', 'side'].forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.addEventListener('input', calcRisk)
  })
}

function calcRisk() {
  const entry = parseFloat(document.getElementById('entry').value)
  const tp = parseFloat(document.getElementById('tp').value)
  const sl = parseFloat(document.getElementById('sl').value)
  const side = document.getElementById('side').value

  const preview = document.getElementById('risk-preview')
  if (!preview) return

  if (!entry || !tp || !sl) {
    preview.style.display = 'none'
    return
  }

  let profitPct, lossPct
  if (side.includes('LONG')) {
    profitPct = ((tp - entry) / entry) * 100
    lossPct = ((entry - sl) / entry) * 100
  } else {
    profitPct = ((entry - tp) / entry) * 100
    lossPct = ((sl - entry) / entry) * 100
  }

  const rr = lossPct > 0 ? (profitPct / lossPct).toFixed(2) : '∞'

  document.getElementById('rr-ratio').textContent = `1:${rr}`
  document.getElementById('profit-pct').textContent =
    `+${profitPct.toFixed(2)}%`
  document.getElementById('loss-pct').textContent = `-${lossPct.toFixed(2)}%`
  preview.style.display = 'flex'
}

// ============ SIGNAL GENERATOR ============
function executeSignal() {
  const coin = document.getElementById('coin').value.trim()
  const side = document.getElementById('side').value
  const entry = parseFloat(document.getElementById('entry').value)
  const tp = parseFloat(document.getElementById('tp').value)
  const be = document.getElementById('be').value
  const sl = parseFloat(document.getElementById('sl').value)
  const note = document.getElementById('note').value
  const leverage = document.getElementById('leverage').value

  if (!coin) return toast('❌ Asset name required', 'error')
  if (isNaN(entry) || entry <= 0)
    return toast('❌ Valid entry price required', 'error')
  if (isNaN(sl) || sl <= 0) return toast('❌ Valid stop loss required', 'error')
  if (isNaN(tp) || tp <= 0)
    return toast('❌ Valid take profit required', 'error')

  const trade = {
    id: Date.now(),
    date: new Date().toISOString(),
    coin: coin.toUpperCase(),
    side,
    entry,
    tp,
    be: be || 'None',
    sl,
    leverage: leverage || 'None',
    note,
    status: 'OPEN',
    exitPrice: null,
    exitDate: null,
    profit: null,
  }

  trades.unshift(trade)
  saveTrades()

  // Telegram message
  const leverageLine = leverage ? `🔹 Leverage: ${leverage}\n` : ''
  const beLine = be ? `🔹 BE: ${be}\n` : ''
  const noteLine = note ? `📝 Note: ${note}\n` : ''
  const message =
    `✅ NEW SIGNAL: ${trade.coin}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔹 Side: ${trade.side}\n` +
    `🔹 Entry: ${trade.entry}\n` +
    `🔹 TP: ${trade.tp}\n` +
    `🔹 SL: ${trade.sl}\n` +
    beLine +
    leverageLine +
    noteLine +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚀 Master Analyst VIP - Trade with Confidence!`

  const output = document.getElementById('output')
  const outputArea = document.getElementById('output-area')
  output.value = message
  outputArea.style.display = 'block'
  outputArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

  // Clear form
  ;['entry', 'tp', 'sl', 'be', 'note', 'leverage'].forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  document.getElementById('risk-preview').style.display = 'none'
  document
    .querySelectorAll('.coin-pill')
    .forEach((p) => p.classList.remove('active'))

  updateStats()
  toast('✅ Signal saved successfully!', 'success')
}

function copyOutput() {
  const output = document.getElementById('output')
  if (!output.value) return toast('Nothing to copy', 'error')
  navigator.clipboard
    .writeText(output.value)
    .then(() => toast('📋 Copied to clipboard!', 'info'))
    .catch(() => {
      output.select()
      document.execCommand('copy')
      toast('📋 Copied!', 'info')
    })
}

// ============ TRADE STATUS ============
function updateTradeStatus(id, status) {
  const trade = trades.find((t) => t.id === id)
  if (!trade || trade.status !== 'OPEN') return

  const exitDefault = status === 'WIN' ? trade.tp : trade.sl
  const rawExit = prompt(
    `Enter exit price for P&L (default: ${exitDefault}):`,
    exitDefault,
  )
  if (rawExit === null) return // cancelled

  const exitPrice = parseFloat(rawExit) || exitDefault

  trade.status = status
  trade.exitDate = new Date().toISOString()
  trade.exitPrice = exitPrice

  if (trade.side.includes('LONG')) {
    trade.profit = ((exitPrice - trade.entry) / trade.entry) * 100
  } else {
    trade.profit = ((trade.entry - exitPrice) / trade.entry) * 100
  }
  trade.profit = parseFloat(trade.profit.toFixed(2))

  saveTrades()
  renderHistory()
  updateStats()
  toast(`Trade marked as ${status}`, status === 'WIN' ? 'success' : 'error')
}

function deleteTrade(id) {
  if (!confirm('Delete this trade permanently?')) return
  trades = trades.filter((t) => t.id !== id)
  saveTrades()
  renderHistory()
  updateStats()
  toast('🗑 Trade deleted', 'info')
}

function saveTrades() {
  localStorage.setItem('ma_trades', JSON.stringify(trades))
}

// ============ HISTORY ============
function renderHistory() {
  const log = document.getElementById('trade-log')
  if (!log) return

  const filter = document.getElementById('history-filter')?.value || 'ALL'
  const filtered =
    filter === 'ALL' ? trades : trades.filter((t) => t.status === filter)

  const sub = document.getElementById('history-subtitle')
  if (sub)
    sub.textContent = `${filtered.length} of ${trades.length} trade${trades.length !== 1 ? 's' : ''}`

  if (filtered.length === 0) {
    log.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>${trades.length === 0 ? 'No trades yet. Generate your first signal!' : 'No trades match this filter.'}</p>
      </div>`
    return
  }

  log.innerHTML = filtered
    .map((trade) => {
      const sideClass = trade.side.includes('LONG')
        ? 'badge-long'
        : 'badge-short'
      const statusClass =
        trade.status === 'WIN'
          ? 'badge-win'
          : trade.status === 'LOSS'
            ? 'badge-loss'
            : 'badge-open'
      const itemClass =
        trade.status === 'WIN'
          ? 'status-win'
          : trade.status === 'LOSS'
            ? 'status-loss'
            : 'status-open'
      const date = new Date(trade.date).toLocaleString()

      const pnlHtml =
        trade.profit !== null
          ? `
      <div class="trade-pnl">
        <span class="pnl-val ${trade.profit >= 0 ? 'pos' : 'neg'}">${trade.profit >= 0 ? '+' : ''}${trade.profit}%</span>
        <span class="pnl-close-info">Exit: ${trade.exitPrice} · Closed: ${new Date(trade.exitDate).toLocaleString()}</span>
      </div>`
          : ''

      const actionsHtml =
        trade.status === 'OPEN'
          ? `
      <div class="trade-actions">
        <button class="trade-btn win"  onclick="updateTradeStatus(${trade.id}, 'WIN')">✓ WIN</button>
        <button class="trade-btn loss" onclick="updateTradeStatus(${trade.id}, 'LOSS')">✗ LOSS</button>
        <button class="trade-btn del"  onclick="deleteTrade(${trade.id})">Delete</button>
      </div>`
          : `
      <div class="trade-actions">
        <button class="trade-btn del" onclick="deleteTrade(${trade.id})">Delete</button>
      </div>`

      return `
      <div class="trade-item ${itemClass}">
        <div class="trade-top">
          <div>
            <div class="trade-name">${trade.coin}</div>
            <div class="trade-badges">
              <span class="badge ${sideClass}">${trade.side}</span>
              <span class="badge ${statusClass}">${trade.status}</span>
              ${trade.leverage !== 'None' ? `<span class="badge badge-open">${trade.leverage}</span>` : ''}
            </div>
          </div>
          <div class="trade-date">${date}</div>
        </div>
        <div class="trade-prices">
          <div class="price-item"><span class="price-label">Entry</span><span class="price-val">${trade.entry}</span></div>
          <div class="price-item"><span class="price-label">TP</span><span class="price-val">${trade.tp}</span></div>
          <div class="price-item"><span class="price-label">SL</span><span class="price-val">${trade.sl}</span></div>
          <div class="price-item"><span class="price-label">BE</span><span class="price-val">${trade.be}</span></div>
        </div>
        ${trade.note ? `<div class="trade-note">📝 ${trade.note}</div>` : ''}
        ${actionsHtml}
        ${pnlHtml}
      </div>`
    })
    .join('')
}

// ============ STATISTICS ============
function updateStats() {
  const closed = trades.filter((t) => t.status !== 'OPEN')
  const wins = closed.filter((t) => t.status === 'WIN').length
  const open = trades.filter((t) => t.status === 'OPEN').length
  const winRate = closed.length
    ? ((wins / closed.length) * 100).toFixed(1)
    : '0'

  const totalProfit = closed
    .filter((t) => t.profit > 0)
    .reduce((s, t) => s + t.profit, 0)
  const totalLoss = Math.abs(
    closed.filter((t) => t.profit < 0).reduce((s, t) => s + t.profit, 0),
  )
  const profitFactor =
    totalLoss > 0
      ? (totalProfit / totalLoss).toFixed(2)
      : totalProfit > 0
        ? '∞'
        : '0'
  const totalPnl = closed.reduce((s, t) => s + (t.profit || 0), 0)

  const set = (id, val) => {
    const el = document.getElementById(id)
    if (el) el.textContent = val
  }
  set('stat-total', trades.length)
  set('stat-closed', closed.length)
  set('stat-open', open)
  set('stat-winrate', winRate + '%')
  set('stat-profit-factor', profitFactor)

  const pnlEl = document.getElementById('stat-total-pnl')
  if (pnlEl) {
    pnlEl.textContent = (totalPnl >= 0 ? '+' : '') + totalPnl.toFixed(2) + '%'
    pnlEl.style.color = totalPnl >= 0 ? 'var(--win)' : 'var(--loss)'
  }

  updateMonthlyChart()
}

function updateMonthlyChart() {
  const ctx = document.getElementById('monthly-chart')
  if (!ctx) return

  const monthlyData = {}
  trades
    .filter((t) => t.status !== 'OPEN')
    .forEach((trade) => {
      const month = new Date(trade.date).toLocaleString('default', {
        month: 'short',
        year: 'numeric',
      })
      if (!monthlyData[month])
        monthlyData[month] = { wins: 0, losses: 0, pnl: 0 }
      if (trade.status === 'WIN') monthlyData[month].wins++
      if (trade.status === 'LOSS') monthlyData[month].losses++
      if (trade.profit) monthlyData[month].pnl += trade.profit
    })

  const months = Object.keys(monthlyData)
  const winData = months.map((m) => monthlyData[m].wins)
  const lossData = months.map((m) => monthlyData[m].losses)

  if (chart) chart.destroy()

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Wins',
          data: winData,
          backgroundColor: 'rgba(34,211,160,0.7)',
          borderRadius: 6,
        },
        {
          label: 'Losses',
          data: lossData,
          backgroundColor: 'rgba(244,63,94,0.7)',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#4a5a78',
            font: { family: 'Space Grotesk', size: 12 },
          },
        },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { ticks: { color: '#4a5a78' }, grid: { color: '#1e2d45' } },
        y: {
          ticks: { color: '#4a5a78', stepSize: 1 },
          grid: { color: '#1e2d45' },
          beginAtZero: true,
        },
      },
    },
  })
}

// ============ EXPORT / IMPORT ============
function exportAllData() {
  const blob = new Blob([JSON.stringify(trades, null, 2)], {
    type: 'application/json',
  })
  dlBlob(blob, `trades_backup_${today()}.json`)
  toast('💾 Data exported!', 'success')
}

function importAdminData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = (e) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result)
        if (!Array.isArray(imported)) throw new Error()
        trades = imported
        saveTrades()
        renderHistory()
        updateStats()
        toast('✅ Data imported!', 'success')
      } catch {
        toast('❌ Invalid JSON file', 'error')
      }
    }
    reader.readAsText(e.target.files[0])
  }
  input.click()
}

function downloadCSV() {
  const headers = [
    'ID',
    'Date',
    'Coin',
    'Side',
    'Entry',
    'TP',
    'SL',
    'BE',
    'Leverage',
    'Status',
    'Exit Price',
    'P&L%',
    'Note',
  ]
  const rows = trades.map((t) => [
    t.id,
    new Date(t.date).toLocaleString(),
    t.coin,
    t.side,
    t.entry,
    t.tp,
    t.sl,
    t.be,
    t.leverage || '',
    t.status,
    t.exitPrice || '',
    t.profit !== null ? t.profit : '',
    t.note || '',
  ])
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${c}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  dlBlob(blob, `trades_report_${today()}.csv`)
  toast('📊 CSV exported!', 'success')
}

function dlBlob(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function clearAllData() {
  if (!confirm('⚠️ This will permanently delete ALL trade history. Continue?'))
    return
  const code = prompt('Type "DELETE" to confirm:')
  if (code !== 'DELETE') {
    toast('Cancelled', 'info')
    return
  }
  trades = []
  localStorage.clear()
  renderHistory()
  updateStats()
  const outputArea = document.getElementById('output-area')
  if (outputArea) outputArea.style.display = 'none'
  toast('🗑 Database wiped', 'info')
}

// ============ MARKET DATA ============
async function fetchMarketData() {
  try {
    const resp = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT","DOGEUSDT"]',
    )
    const data = await resp.json()
    const tickerText = data
      .map((coin) => {
        const price = parseFloat(coin.lastPrice).toLocaleString(undefined, {
          maximumFractionDigits: 4,
        })
        const change = parseFloat(coin.priceChangePercent).toFixed(2)
        const arrow = parseFloat(change) >= 0 ? '▲' : '▼'
        const sym = coin.symbol.replace('USDT', '')
        return `${sym} $${price} ${arrow} ${change}%`
      })
      .join('   ·   ')

    const el = document.getElementById('binance-ticker')
    if (el) el.textContent = `⬡ LIVE   ${tickerText}   ⬡   ${tickerText}`

    const statusEl = document.getElementById('sidebar-status')
    if (statusEl) statusEl.textContent = 'LIVE'
  } catch {
    const el = document.getElementById('binance-ticker')
    if (el) el.textContent = '⚠ Market data unavailable'
    const statusEl = document.getElementById('sidebar-status')
    if (statusEl) {
      statusEl.textContent = 'OFFLINE'
      statusEl.style.color = 'var(--loss)'
    }
  }
}

// ============ COIN SUGGESTIONS ============
function loadCoinSuggestions() {
  const datalist = document.getElementById('coin-suggestions')
  if (datalist)
    datalist.innerHTML = COINS.map((c) => `<option value="${c}">`).join('')
}

function filterQuickSearch() {
  const term = document.getElementById('search-coin').value.toLowerCase()
  const datalist = document.getElementById('coin-suggestions')
  if (!datalist) return
  const filtered = COINS.filter((c) => c.toLowerCase().includes(term))
  datalist.innerHTML = filtered.map((c) => `<option value="${c}">`).join('')

  // Highlight matching quick pills
  document.querySelectorAll('.coin-pill').forEach((p) => {
    const visible = p.textContent.toLowerCase().includes(term)
    p.style.opacity = term && !visible ? '0.3' : '1'
  })
}

// ============ CLOCKS ============
function updateClocks() {
  const now = new Date()
  const fmt = (tz) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now)

  const set = (id, val) => {
    const el = document.getElementById(id)
    if (el) el.textContent = val
  }
  set('time-ny', fmt('America/New_York'))
  set('time-london', fmt('Europe/London'))
  set('time-sl', fmt('Asia/Colombo'))
}

// ============ KZ TRACKER ============
function initKZTracker() {
  if (kzInterval) clearInterval(kzInterval)
  updateKZTracker()
  kzInterval = setInterval(updateKZTracker, 1000)
}

const KZ_SESSIONS = [
  {
    name: 'LONDON KZ',
    start: 8,
    end: 10,
    icon: '🔥',
    color: '#f97316',
    desc: 'High volatility · London open',
  },
  {
    name: 'LONDON-NY OVERLAP',
    start: 12,
    end: 13,
    icon: '⚡',
    color: '#ef4444',
    desc: 'Maximum liquidity · Best time to trade',
  },
  {
    name: 'NEW YORK KZ',
    start: 13,
    end: 15,
    icon: '💪',
    color: '#f43f5e',
    desc: 'Major moves · US session open',
  },
  {
    name: 'ASIA KZ',
    start: 20,
    end: 22,
    icon: '🌏',
    color: '#8b5cf6',
    desc: 'Asian breakouts · JPY pairs',
  },
]

function updateKZTracker() {
  const now = new Date()
  const london = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/London' }),
  )
  const h = london.getHours(),
    m = london.getMinutes(),
    s = london.getSeconds()
  const cur = h + m / 60 + s / 3600

  let active = null

  for (const sess of KZ_SESSIONS) {
    if (cur >= sess.start && cur < sess.end) {
      const elapsed = cur - sess.start
      const duration = sess.end - sess.start
      const pct = (elapsed / duration) * 100
      const remaining = (sess.end - cur) * 3600
      active = { sess, pct, remaining }
      break
    }
  }

  const tracker = document.getElementById('kz-tracker')
  const nameEl = document.getElementById('active-kz-name')
  const pctEl = document.getElementById('kz-percent')
  const barEl = document.getElementById('kz-bar')
  const msgEl = document.getElementById('kz-message')
  const countdownEl = document.getElementById('kz-countdown')

  if (active) {
    const { sess, pct, remaining } = active
    if (tracker) tracker.classList.add('active')
    if (nameEl) nameEl.textContent = `${sess.icon} ${sess.name} — ACTIVE`
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`
    if (barEl) {
      barEl.style.width = `${pct}%`
      barEl.style.backgroundColor = sess.color
    }
    if (msgEl) msgEl.textContent = sess.desc
    if (countdownEl)
      countdownEl.textContent = `🔥 Ends in ${fmtCountdown(remaining)}`
  } else {
    if (tracker) tracker.classList.remove('active')

    // Find next session
    let next = null,
      minWait = Infinity
    for (const sess of KZ_SESSIONS) {
      const wait = cur < sess.start ? sess.start - cur : 24 - cur + sess.start
      if (wait < minWait) {
        minWait = wait
        next = sess
      }
    }

    const waitSecs = minWait * 3600
    const maxWait = 24 * 3600
    const pct = Math.max(
      0,
      Math.min(100, ((maxWait - waitSecs) / maxWait) * 100),
    )

    if (nameEl) nameEl.textContent = `⏰ Next: ${next?.name || '—'}`
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`
    if (barEl) {
      barEl.style.width = `${pct}%`
      barEl.style.backgroundColor = '#4a5a78'
    }
    if (msgEl) msgEl.textContent = next ? `${next.icon} ${next.desc}` : ''
    if (countdownEl)
      countdownEl.textContent = next
        ? `Starts in ${fmtCountdown(waitSecs)}`
        : ''
  }
}

function fmtCountdown(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0)
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}
//
