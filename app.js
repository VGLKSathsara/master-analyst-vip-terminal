// ============================================================
//  MASTER ANALYST VIP — app.js  v4.0
// ============================================================

// ── DATA ────────────────────────────────────────────────────
let trades = JSON.parse(localStorage.getItem('ma_trades')) || []
let chart = null
let kzInterval = null
let priceMonitorInterval = null
let liveprices = {}
let tpCount = 2

const COINS = [
  'BTC/USDT.P',
  'ETH/USDT.P',
  'BNB/USDT.P',
  'SOL/USDT.P',
  'XRP/USDT.P',
  'ADA/USDT.P',
  'DOGE/USDT.P',
  'DOT/USDT.P',
  'MATIC/USDT.P',
  'LINK/USDT.P',
  'AVAX/USDT.P',
  'UNI/USDT.P',
  'ATOM/USDT.P',
  'LTC/USDT.P',
  'ETC/USDT.P',
  'TRX/USDT.P',
  'NEAR/USDT.P',
  'APT/USDT.P',
  'ARB/USDT.P',
  'OP/USDT.P',
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'XRP/USDT',
  'DOGE/USDT',
]

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateClocks()
  setInterval(updateClocks, 1000)
  initKZTracker()
  fetchMarketData()
  setInterval(fetchMarketData, 15000)
  startPriceMonitor()
  loadCoinSuggestions()
  setupRiskPreview()
  renderHistory()
  updateStats()
})

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, type = 'success', duration = 3500) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.className = `toast show ${type}`
  clearTimeout(el._t)
  el._t = setTimeout(() => {
    el.className = 'toast'
  }, duration)
}

// ── NAVIGATION ───────────────────────────────────────────────
function showSection(id) {
  document
    .querySelectorAll('.app-section')
    .forEach((s) => (s.style.display = 'none'))
  document.getElementById(id).style.display = 'block'
  document
    .querySelectorAll('.nav-item')
    .forEach((b) => b.classList.remove('active'))
  document.getElementById(`nav-${id}`).classList.add('active')
  if (id === 'history') renderHistory()
  if (id === 'stats') updateStats()
}

// ── QUICK COIN ───────────────────────────────────────────────
function setQuickCoin(coin) {
  document.getElementById('coin').value = coin
  document
    .querySelectorAll('.coin-pill')
    .forEach((p) =>
      p.classList.toggle(
        'active',
        p.textContent === coin.replace('/USDT.P', '').replace('/USDT', ''),
      ),
    )
  calcRisk()
}

// ── MULTI-TP ─────────────────────────────────────────────────
function addTP() {
  if (tpCount >= 6) return toast('Maximum 6 TPs allowed', 'info')
  tpCount++
  const row = document.createElement('div')
  row.className = 'tp-row'
  row.id = `tp-row-${tpCount}`
  row.innerHTML = `
    <span class="tp-label">TP ${tpCount}</span>
    <input type="number" id="tp${tpCount}" placeholder="0.00000" step="any"/>
    <button class="tp-remove" onclick="removeTP(${tpCount})">✕</button>`
  document.getElementById('tp-inputs').appendChild(row)
}

function removeTP(n) {
  if (n === 1) return
  document.getElementById(`tp-row-${n}`)?.remove()
  const rows = document.querySelectorAll('.tp-row')
  tpCount = 0
  rows.forEach((row, i) => {
    tpCount = i + 1
    row.id = `tp-row-${tpCount}`
    row.querySelector('.tp-label').textContent = `TP ${tpCount}`
    const inp = row.querySelector('input')
    inp.id = `tp${tpCount}`
    const btn = row.querySelector('.tp-remove')
    if (btn) {
      btn.onclick = () => removeTP(tpCount)
      btn.style.display = tpCount === 1 ? 'none' : ''
    }
  })
}

function getTPValues() {
  return Array.from(document.querySelectorAll('.tp-row'))
    .map((_, i) => parseFloat(document.getElementById(`tp${i + 1}`)?.value))
    .filter((v) => !isNaN(v) && v > 0)
}

// ── RISK CALCULATOR ──────────────────────────────────────────
function setupRiskPreview() {
  ;['entry', 'sl', 'side'].forEach((id) =>
    document.getElementById(id)?.addEventListener('input', calcRisk),
  )
  document.getElementById('tp-inputs')?.addEventListener('input', calcRisk)
}

function calcRisk() {
  const entry = parseFloat(document.getElementById('entry').value)
  const tp = parseFloat(document.getElementById('tp1')?.value)
  const sl = parseFloat(document.getElementById('sl').value)
  const isShort = document.getElementById('side').value.includes('Short')
  const preview = document.getElementById('risk-preview')
  if (!preview) return
  if (!entry || !tp || !sl) {
    preview.style.display = 'none'
    return
  }
  const profitPct = isShort
    ? ((entry - tp) / entry) * 100
    : ((tp - entry) / entry) * 100
  const lossPct = isShort
    ? ((sl - entry) / entry) * 100
    : ((entry - sl) / entry) * 100
  const rr = lossPct > 0 ? (profitPct / lossPct).toFixed(2) : '∞'
  document.getElementById('rr-ratio').textContent = `1 : ${rr}`
  document.getElementById('profit-pct').textContent =
    `+${profitPct.toFixed(2)}%`
  document.getElementById('loss-pct').textContent =
    `-${Math.abs(lossPct).toFixed(2)}%`
  preview.style.display = 'flex'
}

// ── MESSAGE BUILDER ──────────────────────────────────────────
function buildMessage(trade) {
  const isShort = trade.side.includes('Short') || trade.side.includes('Sell')
  const coinTag = '#' + trade.coin.replace('/', '').toUpperCase()
  const dir = isShort ? 'SHORT 🔴' : 'LONG  🟢'
  const arrow = isShort ? '⬇️' : '⬆️'

  // R:R from TP1
  const tp1 = trade.tps[0]
  const profitPct = isShort
    ? (((trade.entry - tp1) / trade.entry) * 100).toFixed(2)
    : (((tp1 - trade.entry) / trade.entry) * 100).toFixed(2)
  const lossPct = isShort
    ? (((trade.sl - trade.entry) / trade.entry) * 100).toFixed(2)
    : (((trade.entry - trade.sl) / trade.entry) * 100).toFixed(2)
  const rr = (Math.abs(profitPct) / Math.abs(lossPct)).toFixed(2)

  // TP lines with per-TP profit %
  const tpMedals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const tpLines = trade.tps
    .map((tp, i) => {
      const pct = isShort
        ? (((trade.entry - tp) / trade.entry) * 100).toFixed(2)
        : (((tp - trade.entry) / trade.entry) * 100).toFixed(2)
      return `  ${tpMedals[i]} TP ${i + 1}  ›  ${tp}   (+${pct}%)`
    })
    .join('\n')

  const beLine =
    trade.be && trade.be !== 'None' ? `  🔵 BE     ›  ${trade.be}\n` : ''
  const noteLine = trade.note ? `\n💬 ${trade.note}\n` : ''

  return (
    `╔══════════════════════════╗\n` +
    `  🀄  ${coinTag}\n` +
    `  ${dir}  ${arrow}\n` +
    `╚══════════════════════════╝\n` +
    `\n` +
    `📋 ${(trade.orderType || 'LIMIT ORDER').toUpperCase()}\n` +
    `🔒 Leverage  :  ${trade.leverage}\n` +
    `\n` +
    `┌─────────────────────────┐\n` +
    `  📍 Entry  ›  ${trade.entry}\n` +
    `${tpLines}\n` +
    `  🛑 SL     ›  ${trade.sl}   (-${Math.abs(lossPct)}%)\n` +
    beLine +
    `└─────────────────────────┘\n` +
    `\n` +
    `📊 Risk / Reward\n` +
    `  💰 Risk    :  ${trade.riskPct}% of balance\n` +
    `  📈 Reward  :  +${profitPct}%  (TP1)\n` +
    `  ⚖️  R : R   :  1 : ${rr}\n` +
    noteLine +
    `\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `🙌 Risk Mgmt  ·  🔰 Powered by\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

// ── SIGNAL GENERATOR ─────────────────────────────────────────
function executeSignal() {
  const coin = document.getElementById('coin').value.trim()
  const side = document.getElementById('side').value
  const orderType = document.getElementById('order-type').value
  const entry = parseFloat(document.getElementById('entry').value)
  const be = document.getElementById('be').value
  const sl = parseFloat(document.getElementById('sl').value)
  const note = document.getElementById('note').value
  const leverage = document.getElementById('leverage').value || '10x or Max'
  const riskPct = document.getElementById('risk-pct').value || '1'
  const tps = getTPValues()

  if (!coin) return toast('❌ Asset name required', 'error')
  if (isNaN(entry) || entry <= 0)
    return toast('❌ Valid entry price required', 'error')
  if (isNaN(sl) || sl <= 0) return toast('❌ Valid stop loss required', 'error')
  if (tps.length === 0) return toast('❌ At least one TP required', 'error')

  const trade = {
    id: Date.now(),
    date: new Date().toISOString(),
    coin: coin.toUpperCase(),
    side,
    orderType,
    entry,
    tps,
    tp: tps[0],
    be: be || 'None',
    sl,
    leverage,
    riskPct,
    note,
    status: 'OPEN',
    exitPrice: null,
    exitDate: null,
    profit: null,
    hitTPs: [],
    autoTriggered: false,
  }

  trades.unshift(trade)
  saveTrades()

  const message = buildMessage(trade)
  const output = document.getElementById('output')
  const outputArea = document.getElementById('output-area')
  output.value = message
  outputArea.style.display = 'block'
  outputArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

  // Reset form
  ;['entry', 'sl', 'be', 'note'].forEach((id) => {
    const e = document.getElementById(id)
    if (e) e.value = ''
  })
  document.querySelectorAll('.tp-row').forEach((row, i) => {
    if (i === 0) {
      const inp = row.querySelector('input')
      if (inp) inp.value = ''
    } else row.remove()
  })
  tpCount = 1
  document
    .querySelectorAll('.coin-pill')
    .forEach((p) => p.classList.remove('active'))
  document.getElementById('risk-preview').style.display = 'none'

  updateStats()
  startPriceMonitor()
  toast('✅ Signal saved & price monitoring active!', 'success')
}

function copyOutput() {
  const output = document.getElementById('output')
  if (!output?.value) return toast('Nothing to copy', 'error')
  navigator.clipboard
    .writeText(output.value)
    .then(() => toast('📋 Copied!', 'info'))
    .catch(() => {
      output.select()
      document.execCommand('copy')
      toast('📋 Copied!', 'info')
    })
}

// ── LIVE PRICE MONITOR ───────────────────────────────────────
function startPriceMonitor() {
  if (priceMonitorInterval) clearInterval(priceMonitorInterval)
  priceMonitorInterval = setInterval(checkOpenTrades, 10000)
  checkOpenTrades()
}

async function checkOpenTrades() {
  const openTrades = trades.filter((t) => t.status === 'OPEN')
  if (openTrades.length === 0) return

  const symbols = [...new Set(openTrades.map((t) => toBinanceSym(t.coin)))]
  if (symbols.length === 0) return

  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(symbols)}`
    const data = await fetch(url).then((r) => r.json())

    if (Array.isArray(data))
      data.forEach((d) => {
        liveprices[d.symbol] = parseFloat(d.price)
      })
    else if (data.symbol) liveprices[data.symbol] = parseFloat(data.price)

    let changed = false
    openTrades.forEach((trade) => {
      const sym = toBinanceSym(trade.coin)
      const price = liveprices[sym]
      if (!price) return

      const isShort =
        trade.side.includes('Short') || trade.side.includes('Sell')

      // SL check
      if (isShort ? price >= trade.sl : price <= trade.sl) {
        autoCloseTrade(trade, 'LOSS', price)
        changed = true
        return
      }

      // TP checks
      trade.tps.forEach((tp, i) => {
        if ((trade.hitTPs || []).includes(i)) return
        const hit = isShort ? price <= tp : price >= tp
        if (hit) {
          if (!trade.hitTPs) trade.hitTPs = []
          trade.hitTPs.push(i)
          toast(
            `🎯 ${trade.coin} — TP${i + 1} hit @ ${price}!`,
            'success',
            5000,
          )
          if (trade.hitTPs.length === trade.tps.length) {
            autoCloseTrade(trade, 'WIN', price)
            changed = true
          }
        }
      })

      // Update live badge in UI
      updateLivePriceDisplay(trade.id, price)
    })

    if (changed) {
      saveTrades()
      renderHistory()
      updateStats()
    }
  } catch (e) {
    console.warn('Price monitor error:', e)
  }
}

function autoCloseTrade(trade, status, exitPrice) {
  if (trade.status !== 'OPEN') return
  const isShort = trade.side.includes('Short') || trade.side.includes('Sell')
  trade.status = status
  trade.exitDate = new Date().toISOString()
  trade.exitPrice = exitPrice
  trade.autoTriggered = true
  trade.profit = isShort
    ? parseFloat((((trade.entry - exitPrice) / trade.entry) * 100).toFixed(2))
    : parseFloat((((exitPrice - trade.entry) / trade.entry) * 100).toFixed(2))
  const icon = status === 'WIN' ? '✅' : '🛑'
  toast(
    `${icon} ${trade.coin} AUTO-${status} @ ${exitPrice}  (${trade.profit >= 0 ? '+' : ''}${trade.profit}%)`,
    status === 'WIN' ? 'success' : 'error',
    7000,
  )
}

function updateLivePriceDisplay(id, price) {
  const el = document.getElementById(`live-${id}`)
  if (el)
    el.textContent = `● $${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
}

function toBinanceSym(coin) {
  return coin.replace('/', '').replace('.P', '').toUpperCase()
}

// ── MANUAL TRADE STATUS ──────────────────────────────────────
function updateTradeStatus(id, status) {
  const trade = trades.find((t) => t.id === id)
  if (!trade || trade.status !== 'OPEN') return
  const exitDefault = status === 'WIN' ? trade.tp : trade.sl
  const rawExit = prompt(
    `Exit price for P&L (default: ${exitDefault}):`,
    exitDefault,
  )
  if (rawExit === null) return
  const exitPrice = parseFloat(rawExit) || exitDefault
  const isShort = trade.side.includes('Short') || trade.side.includes('Sell')
  trade.status = status
  trade.exitDate = new Date().toISOString()
  trade.exitPrice = exitPrice
  trade.profit = isShort
    ? parseFloat((((trade.entry - exitPrice) / trade.entry) * 100).toFixed(2))
    : parseFloat((((exitPrice - trade.entry) / trade.entry) * 100).toFixed(2))
  saveTrades()
  renderHistory()
  updateStats()
  toast(`Trade marked ${status}`, status === 'WIN' ? 'success' : 'error')
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

// ── HISTORY RENDER ───────────────────────────────────────────
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
    log.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span>
      <p>${trades.length === 0 ? 'No trades yet. Generate your first signal!' : 'No trades match this filter.'}</p></div>`
    return
  }

  log.innerHTML = filtered
    .map((trade) => {
      const isShort =
        trade.side.includes('Short') || trade.side.includes('Sell')
      const sideClass = isShort ? 'badge-short' : 'badge-long'
      const stClass = {
        WIN: 'badge-win',
        LOSS: 'badge-loss',
        OPEN: 'badge-open',
      }[trade.status]
      const itemClass = {
        WIN: 'status-win',
        LOSS: 'status-loss',
        OPEN: 'status-open',
      }[trade.status]

      const tpList = (trade.tps || [trade.tp])
        .map((tp, i) => {
          const hit = (trade.hitTPs || []).includes(i)
          return `<span class="${hit ? 'tp-hit' : ''}">${tp}</span>`
        })
        .join(' · ')

      const liveBadge =
        trade.status === 'OPEN'
          ? `<span class="live-badge" id="live-${trade.id}">● Live</span>`
          : ''

      const autoBadge = trade.autoTriggered
        ? `<span class="badge badge-auto">⚡ AUTO</span>`
        : ''

      const pnlHtml =
        trade.profit !== null
          ? `
      <div class="trade-pnl">
        <span class="pnl-val ${trade.profit >= 0 ? 'pos' : 'neg'}">${trade.profit >= 0 ? '+' : ''}${trade.profit}%</span>
        <span class="pnl-close-info">Exit: ${trade.exitPrice} · ${new Date(trade.exitDate).toLocaleString()}</span>
      </div>`
          : ''

      const actionsHtml =
        trade.status === 'OPEN'
          ? `
      <div class="trade-actions">
        <button class="trade-btn win"  onclick="updateTradeStatus(${trade.id},'WIN')">✓ WIN</button>
        <button class="trade-btn loss" onclick="updateTradeStatus(${trade.id},'LOSS')">✗ LOSS</button>
        <button class="trade-btn del"  onclick="deleteTrade(${trade.id})">Delete</button>
      </div>`
          : `
      <div class="trade-actions">
        <button class="trade-btn del" onclick="deleteTrade(${trade.id})">Delete</button>
      </div>`

      return `
      <div class="trade-item ${itemClass}" id="card-${trade.id}">
        <div class="trade-top">
          <div>
            <div class="trade-name">${trade.coin} ${liveBadge}</div>
            <div class="trade-badges">
              <span class="badge ${sideClass}">${trade.side}</span>
              <span class="badge ${stClass}">${trade.status}</span>
              ${autoBadge}
              ${trade.leverage ? `<span class="badge badge-open">${trade.leverage}</span>` : ''}
            </div>
          </div>
          <div class="trade-date">${new Date(trade.date).toLocaleString()}</div>
        </div>
        <div class="trade-prices">
          <div class="price-item"><span class="price-label">Entry</span><span class="price-val">${trade.entry}</span></div>
          <div class="price-item"><span class="price-label">TPs</span><span class="price-val tp-list">${tpList}</span></div>
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

// ── STATISTICS ───────────────────────────────────────────────
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

  const set = (id, v) => {
    const e = document.getElementById(id)
    if (e) e.textContent = v
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
  const md = {}
  trades
    .filter((t) => t.status !== 'OPEN')
    .forEach((t) => {
      const m = new Date(t.date).toLocaleString('default', {
        month: 'short',
        year: 'numeric',
      })
      if (!md[m]) md[m] = { wins: 0, losses: 0 }
      if (t.status === 'WIN') md[m].wins++
      if (t.status === 'LOSS') md[m].losses++
    })
  const months = Object.keys(md)
  if (chart) chart.destroy()
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Wins',
          data: months.map((m) => md[m].wins),
          backgroundColor: 'rgba(34,211,160,0.7)',
          borderRadius: 6,
        },
        {
          label: 'Losses',
          data: months.map((m) => md[m].losses),
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

// ── EXPORT / IMPORT ──────────────────────────────────────────
function exportAllData() {
  dlBlob(
    new Blob([JSON.stringify(trades, null, 2)], { type: 'application/json' }),
    `trades_backup_${today()}.json`,
  )
  toast('💾 Exported!', 'success')
}
function importAdminData() {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = 'application/json'
  inp.onchange = (e) => {
    const r = new FileReader()
    r.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result)
        if (!Array.isArray(d)) throw 0
        trades = d
        saveTrades()
        renderHistory()
        updateStats()
        toast('✅ Imported!', 'success')
      } catch {
        toast('❌ Invalid file', 'error')
      }
    }
    r.readAsText(e.target.files[0])
  }
  inp.click()
}
function downloadCSV() {
  const h = [
    'ID',
    'Date',
    'Coin',
    'Side',
    'Entry',
    'TPs',
    'SL',
    'BE',
    'Leverage',
    'Status',
    'Exit',
    'P&L%',
    'Note',
  ]
  const rows = trades.map((t) => [
    t.id,
    new Date(t.date).toLocaleString(),
    t.coin,
    t.side,
    t.entry,
    (t.tps || [t.tp]).join('|'),
    t.sl,
    t.be,
    t.leverage || '',
    t.status,
    t.exitPrice || '',
    t.profit ?? '',
    t.note || '',
  ])
  const csv = [h, ...rows]
    .map((r) => r.map((c) => `"${c}"`).join(','))
    .join('\n')
  dlBlob(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
    `trades_report_${today()}.csv`,
  )
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
  if (!confirm('⚠️ Delete ALL trade history permanently?')) return
  if (prompt('Type "DELETE" to confirm:') !== 'DELETE') {
    toast('Cancelled', 'info')
    return
  }
  trades = []
  localStorage.clear()
  renderHistory()
  updateStats()
  const oa = document.getElementById('output-area')
  if (oa) oa.style.display = 'none'
  toast('🗑 Database wiped', 'info')
}

// ── MARKET TICKER ─────────────────────────────────────────────
async function fetchMarketData() {
  try {
    const data = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT","DOGEUSDT"]',
    ).then((r) => r.json())
    const text = data
      .map((c) => {
        const price = parseFloat(c.lastPrice).toLocaleString(undefined, {
          maximumFractionDigits: 4,
        })
        const change = parseFloat(c.priceChangePercent).toFixed(2)
        return `${c.symbol.replace('USDT', '')} $${price} ${parseFloat(change) >= 0 ? '▲' : '▼'} ${change}%`
      })
      .join('   ·   ')
    const el = document.getElementById('binance-ticker')
    if (el) el.textContent = `⬡ LIVE   ${text}   ⬡   ${text}`
    const st = document.getElementById('sidebar-status')
    if (st) {
      st.textContent = 'LIVE'
      st.style.color = 'var(--win)'
    }
  } catch {
    const el = document.getElementById('binance-ticker')
    if (el) el.textContent = '⚠ Market data unavailable'
    const st = document.getElementById('sidebar-status')
    if (st) {
      st.textContent = 'OFFLINE'
      st.style.color = 'var(--loss)'
    }
  }
}

// ── COIN SUGGESTIONS ─────────────────────────────────────────
function loadCoinSuggestions() {
  const dl = document.getElementById('coin-suggestions')
  if (dl) dl.innerHTML = COINS.map((c) => `<option value="${c}">`).join('')
}
function filterQuickSearch() {
  const term = document.getElementById('search-coin').value.toLowerCase()
  const dl = document.getElementById('coin-suggestions')
  if (dl)
    dl.innerHTML = COINS.filter((c) => c.toLowerCase().includes(term))
      .map((c) => `<option value="${c}">`)
      .join('')
  document.querySelectorAll('.coin-pill').forEach((p) => {
    p.style.opacity =
      term && !p.textContent.toLowerCase().includes(term) ? '0.3' : '1'
  })
}

// ── CLOCKS ───────────────────────────────────────────────────
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
  const set = (id, v) => {
    const e = document.getElementById(id)
    if (e) e.textContent = v
  }
  set('time-ny', fmt('America/New_York'))
  set('time-london', fmt('Europe/London'))
  set('time-sl', fmt('Asia/Colombo'))
}

// ── KZ TRACKER ───────────────────────────────────────────────
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
    desc: 'Maximum liquidity · Best time',
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
  const cur =
    london.getHours() + london.getMinutes() / 60 + london.getSeconds() / 3600
  let active = null
  for (const s of KZ_SESSIONS) {
    if (cur >= s.start && cur < s.end) {
      active = {
        sess: s,
        pct: ((cur - s.start) / (s.end - s.start)) * 100,
        remaining: (s.end - cur) * 3600,
      }
      break
    }
  }
  const tracker = document.getElementById('kz-tracker')
  const nameEl = document.getElementById('active-kz-name')
  const pctEl = document.getElementById('kz-percent')
  const barEl = document.getElementById('kz-bar')
  const msgEl = document.getElementById('kz-message')
  const cdEl = document.getElementById('kz-countdown')

  if (active) {
    const { sess, pct, remaining } = active
    tracker?.classList.add('active')
    if (nameEl) nameEl.textContent = `${sess.icon} ${sess.name} — ACTIVE`
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`
    if (barEl) {
      barEl.style.width = `${pct}%`
      barEl.style.backgroundColor = sess.color
    }
    if (msgEl) msgEl.textContent = sess.desc
    if (cdEl) cdEl.textContent = `🔥 Ends in ${fmtCountdown(remaining)}`
  } else {
    tracker?.classList.remove('active')
    let next = null,
      minWait = Infinity
    for (const s of KZ_SESSIONS) {
      const w = cur < s.start ? s.start - cur : 24 - cur + s.start
      if (w < minWait) {
        minWait = w
        next = s
      }
    }
    const waitSecs = minWait * 3600
    const pct = Math.max(
      0,
      Math.min(100, ((24 * 3600 - waitSecs) / (24 * 3600)) * 100),
    )
    if (nameEl) nameEl.textContent = `⏰ Next: ${next?.name || '—'}`
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`
    if (barEl) {
      barEl.style.width = `${pct}%`
      barEl.style.backgroundColor = '#4a5a78'
    }
    if (msgEl) msgEl.textContent = next ? `${next.icon} ${next.desc}` : ''
    if (cdEl)
      cdEl.textContent = next ? `Starts in ${fmtCountdown(waitSecs)}` : ''
  }
}

function fmtCountdown(secs) {
  const h = Math.floor(secs / 3600),
    m = Math.floor((secs % 3600) / 60),
    s = Math.floor(secs % 60)
  if (h > 0)
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}
