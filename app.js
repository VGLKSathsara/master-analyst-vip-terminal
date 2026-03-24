// ════════════════════════════════════════════════════
//  MASTER ANALYST VIP  ·  app.js  v5.0
// ════════════════════════════════════════════════════

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

// ── INIT ─────────────────────────────────────────────
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

// ── TOAST ─────────────────────────────────────────────
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

// ── NAV ───────────────────────────────────────────────
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

// ── QUICK COIN ────────────────────────────────────────
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

// ── MULTI-TP ──────────────────────────────────────────
function addTP() {
  if (tpCount >= 6) return toast('Maximum 6 TPs allowed', 'info')
  tpCount++
  const row = document.createElement('div')
  row.className = 'tp-row'
  row.id = `tp-row-${tpCount}`
  row.innerHTML = `<span class="tp-label">TP ${tpCount}</span>
    <input type="number" id="tp${tpCount}" placeholder="0.00000" step="any"/>
    <button class="tp-remove" onclick="removeTP(${tpCount})">✕</button>`
  document.getElementById('tp-inputs').appendChild(row)
}

function removeTP(n) {
  if (n === 1) return
  document.getElementById(`tp-row-${n}`)?.remove()
  tpCount = 0
  document.querySelectorAll('.tp-row').forEach((row, i) => {
    tpCount = i + 1
    row.id = `tp-row-${tpCount}`
    row.querySelector('.tp-label').textContent = `TP ${tpCount}`
    row.querySelector('input').id = `tp${tpCount}`
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

// ── RISK CALC ─────────────────────────────────────────
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

// ── HELPERS ───────────────────────────────────────────
function calcProfitPct(trade, price) {
  const isShort = trade.side.includes('Short') || trade.side.includes('Sell')
  return isShort
    ? ((trade.entry - price) / trade.entry) * 100
    : ((price - trade.entry) / trade.entry) * 100
}

function calcLossPct(trade) {
  const isShort = trade.side.includes('Short') || trade.side.includes('Sell')
  return isShort
    ? ((trade.sl - trade.entry) / trade.entry) * 100
    : ((trade.entry - trade.sl) / trade.entry) * 100
}

function getRRLabel(rr) {
  if (rr <= 0) return '0'
  if (rr < 0.5) return '< 0.5'
  if (rr < 1.0) return '< 1'
  if (rr < 1.5) return '1 : 1'
  if (rr < 2.5) return '1 : 2'
  if (rr < 3.5) return '1 : 3'
  if (rr < 4.5) return '1 : 4'
  return `1 : ${Math.floor(rr)}`
}

function getRREmoji(rr) {
  if (rr < 1) return '⚠️'
  if (rr < 2) return '✅'
  if (rr < 3) return '🔥'
  return '🚀'
}

function coinTag(trade) {
  return '#' + trade.coin.replace('/', '').toUpperCase()
}

function toBinanceSym(coin) {
  return coin.replace('/', '').replace('.P', '').toUpperCase()
}

// ── OPEN SIGNAL MESSAGE ───────────────────────────────
function buildOpenMessage(trade) {
  const isShort = trade.side.includes('Short') || trade.side.includes('Sell')
  const tag = coinTag(trade)
  const dir = isShort ? 'SHORT 🔴' : 'LONG  🟢'
  const arrow = isShort ? '⬇️' : '⬆️'
  const lossPct = Math.abs(calcLossPct(trade)).toFixed(2)
  const tp1Pct = Math.abs(calcProfitPct(trade, trade.tps[0])).toFixed(2)
  const rr = (Math.abs(tp1Pct) / Math.abs(lossPct)).toFixed(2)

  const tpMedals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const tpLines = trade.tps
    .map((tp, i) => {
      const pct = Math.abs(calcProfitPct(trade, tp)).toFixed(2)
      return `  ${tpMedals[i]} TP ${i + 1}  ›  ${tp}   (+${pct}%)`
    })
    .join('\n')

  const beLine =
    trade.be && trade.be !== 'None' ? `  🔵 BE     ›  ${trade.be}\n` : ''
  const noteLine = trade.note ? `\n💬 ${trade.note}\n` : ''

  return (
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}\n` +
    `  ${dir}  ${arrow}\n` +
    `╚══════════════════════════╝\n\n` +
    `📋 ${(trade.orderType || 'LIMIT ORDER').toUpperCase()}\n` +
    `🔒 Leverage  :  ${trade.leverage}\n\n` +
    `┌─────────────────────────┐\n` +
    `  📍 Entry  ›  ${trade.entry}\n` +
    `${tpLines}\n` +
    `  🛑 SL     ›  ${trade.sl}   (-${lossPct}%)\n` +
    beLine +
    `└─────────────────────────┘\n\n` +
    `📊 Risk / Reward\n` +
    `  💰 Risk    :  ${trade.riskPct}% of balance\n` +
    `  📈 Reward  :  +${tp1Pct}%  (TP1)\n` +
    `  ⚖️  R : R   :  1 : ${rr}\n` +
    noteLine +
    `\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `🙌 Risk Mgmt  ·  🔰 Powered by\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

// ── TP HIT MESSAGE ────────────────────────────────────
function buildTPHitMessage(trade, tpIndex, hitPrice) {
  const isShort = trade.side.includes('Short') || trade.side.includes('Sell')
  const tag = coinTag(trade)
  const tpNum = tpIndex + 1
  const tpPrice = trade.tps[tpIndex]
  const profitPct = Math.abs(calcProfitPct(trade, tpPrice)).toFixed(2)
  const lossPct = Math.abs(calcLossPct(trade)).toFixed(2)
  const rr = parseFloat(profitPct) / parseFloat(lossPct)
  const rrLabel = getRRLabel(rr)
  const rrEmoji = getRREmoji(rr)
  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const isLast = tpIndex === trade.tps.length - 1
  const moreTPs = !isLast
    ? `\n⏳ Remaining TPs still active — hold or move SL to BE`
    : ''

  return (
    `${rrEmoji} TP ${tpNum} HIT!\n` +
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}  ${isShort ? 'SHORT 🔴' : 'LONG 🟢'}\n` +
    `╚══════════════════════════╝\n\n` +
    `${medals[tpIndex]} TP ${tpNum} reached  ›  ${tpPrice}\n` +
    `📍 Entry was  ›  ${trade.entry}\n\n` +
    `┌─────────────────────────┐\n` +
    `  📈 Profit   :  +${profitPct}%\n` +
    `  ⚖️  R : R    :  ${rrLabel}  ${rrEmoji}\n` +
    `  💰 Risk was :  ${trade.riskPct}% of balance\n` +
    `└─────────────────────────┘\n` +
    moreTPs +
    `\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

// ── FULL WIN/LOSS RESULT MESSAGE ──────────────────────
function buildResultMessage(trade) {
  const isShort = trade.side.includes('Short') || trade.side.includes('Sell')
  const tag = coinTag(trade)
  const isWin = trade.status === 'WIN'
  const profitPct = trade.profit?.toFixed(2) ?? '0'
  const lossPct = Math.abs(calcLossPct(trade)).toFixed(2)
  const rr = Math.abs(trade.profit) / Math.abs(parseFloat(lossPct))
  const rrLabel = getRRLabel(rr)
  const rrEmoji = getRREmoji(rr)

  // TP summary
  const tpMedals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const tpSummary = trade.tps
    .map((tp, i) => {
      const hit = (trade.hitTPs || []).includes(i)
      const pct = Math.abs(calcProfitPct(trade, tp)).toFixed(2)
      return `  ${hit ? tpMedals[i] : '⬜'} TP ${i + 1}  ›  ${tp}  (+${pct}%)  ${hit ? '✔' : '—'}`
    })
    .join('\n')

  const header = isWin ? `🏆 TRADE CLOSED — WIN!\n` : `🛑 TRADE CLOSED — LOSS\n`

  const pnlLine = isWin
    ? `  📈 Profit   :  +${profitPct}%`
    : `  📉 Loss     :  ${profitPct}%`

  const motivation = isWin
    ? `🎉 Well done! Discipline pays off.`
    : `💪 Losses are part of the game.\n   Protect capital. Next trade!`

  return (
    `${header}` +
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}  ${isShort ? 'SHORT 🔴' : 'LONG 🟢'}\n` +
    `╚══════════════════════════╝\n\n` +
    `📍 Entry    ›  ${trade.entry}\n` +
    `🏁 Exit     ›  ${trade.exitPrice}\n\n` +
    `📊 TP Results:\n` +
    `${tpSummary}\n` +
    `  🛑 SL      ›  ${trade.sl}\n\n` +
    `┌─────────────────────────┐\n` +
    `${pnlLine}\n` +
    `  ⚖️  R : R   :  ${rrLabel}  ${rrEmoji}\n` +
    `  💰 Risk was :  ${trade.riskPct}% of balance\n` +
    `  🤖 Trigger  :  ${trade.autoTriggered ? 'Auto ⚡' : 'Manual 🖐'}\n` +
    `└─────────────────────────┘\n\n` +
    `${motivation}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

// ── SIGNAL GENERATOR ─────────────────────────────────
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
    resultMessage: null,
  }
  trades.unshift(trade)
  saveTrades()

  showOutputMessage(buildOpenMessage(trade))
  resetForm()
  updateStats()
  startPriceMonitor()
  toast('✅ Signal saved & monitoring active!', 'success')
}

function showOutputMessage(msg) {
  const output = document.getElementById('output')
  const outputArea = document.getElementById('output-area')
  output.value = msg
  outputArea.style.display = 'block'
  outputArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function resetForm() {
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

// ── PRICE MONITOR ─────────────────────────────────────
function startPriceMonitor() {
  if (priceMonitorInterval) clearInterval(priceMonitorInterval)
  priceMonitorInterval = setInterval(checkOpenTrades, 5000) // every 5 seconds
  checkOpenTrades()
}

async function checkOpenTrades() {
  const openTrades = trades.filter((t) => t.status === 'OPEN')
  if (!openTrades.length) return
  const symbols = [...new Set(openTrades.map((t) => toBinanceSym(t.coin)))]
  try {
    const data = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(symbols)}`,
    ).then((r) => r.json())

    if (Array.isArray(data))
      data.forEach((d) => {
        liveprices[d.symbol] = parseFloat(d.price)
      })
    else if (data.symbol) liveprices[data.symbol] = parseFloat(data.price)

    let changed = false
    openTrades.forEach((trade) => {
      const price = liveprices[toBinanceSym(trade.coin)]
      if (!price) return

      const isShort =
        trade.side.includes('Short') || trade.side.includes('Sell')

      // ── SL check ──
      // LONG:  SL triggers if price has reached OR fallen below SL
      // SHORT: SL triggers if price has reached OR risen above SL
      const slHit = isShort ? price >= trade.sl : price <= trade.sl
      if (slHit) {
        autoCloseTrade(trade, 'LOSS', price)
        changed = true
        return
      }

      // ── TP checks ──
      // LONG:  TP triggers if price has reached OR risen above TP
      // SHORT: TP triggers if price has reached OR fallen below TP
      // This means even if price skips past the TP level, it still counts.
      trade.tps.forEach((tp, i) => {
        if ((trade.hitTPs || []).includes(i)) return
        const tpHit = isShort ? price <= tp : price >= tp
        if (!tpHit) return
        if (!trade.hitTPs) trade.hitTPs = []
        trade.hitTPs.push(i)

        // Generate & store TP hit message
        const tpMsg = buildTPHitMessage(trade, i, price)
        if (!trade.tpMessages) trade.tpMessages = {}
        trade.tpMessages[i] = tpMsg
        changed = true

        showOutputMessage(tpMsg)
        toast(`🎯 ${trade.coin} TP${i + 1} hit @ ${price}!`, 'success', 6000)

        // All TPs hit → close as WIN
        if (trade.hitTPs.length === trade.tps.length) {
          autoCloseTrade(trade, 'WIN', price)
        }
      })

      updateLivePriceDisplay(trade.id, price)
    })

    if (changed) {
      saveTrades()
      renderHistory()
      updateStats()
    }
  } catch (e) {
    console.warn('Monitor error', e)
  }
}

function autoCloseTrade(trade, status, exitPrice) {
  if (trade.status !== 'OPEN') return
  const isShort = trade.side.includes('Short') || trade.side.includes('Sell')
  trade.status = status
  trade.exitDate = new Date().toISOString()
  trade.exitPrice = exitPrice
  trade.autoTriggered = true
  trade.profit =
    parseFloat(
      (isShort
        ? (trade.entry - exitPrice) / trade.entry
        : (exitPrice - trade.entry) / trade.entry) * 100,
    ).toFixed(2) * 1

  // Generate result message and store on trade
  trade.resultMessage = buildResultMessage(trade)

  // Show in output panel
  showOutputMessage(trade.resultMessage)

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

// ── MANUAL CLOSE ─────────────────────────────────────
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
  trade.autoTriggered = false
  trade.profit =
    parseFloat(
      (isShort
        ? (trade.entry - exitPrice) / trade.entry
        : (exitPrice - trade.entry) / trade.entry) * 100,
    ).toFixed(2) * 1

  trade.resultMessage = buildResultMessage(trade)
  showOutputMessage(trade.resultMessage)

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

// ── COPY RESULT FROM HISTORY ──────────────────────────
function copyResultMessage(id) {
  const trade = trades.find((t) => t.id === id)
  if (!trade) return
  const msg = trade.resultMessage || buildResultMessage(trade)
  navigator.clipboard
    .writeText(msg)
    .then(() => toast('📋 Result message copied!', 'info'))
    .catch(() => toast('❌ Copy failed', 'error'))
}

function copyOpenMessage(id) {
  const trade = trades.find((t) => t.id === id)
  if (!trade) return
  const msg = buildOpenMessage(trade)
  navigator.clipboard
    .writeText(msg)
    .then(() => toast('📋 Signal message copied!', 'info'))
    .catch(() => toast('❌ Copy failed', 'error'))
}

function copyTPMessage(id, tpIndex) {
  const trade = trades.find((t) => t.id === id)
  if (!trade) return
  const msg =
    trade.tpMessages?.[tpIndex] ||
    buildTPHitMessage(trade, tpIndex, trade.tps[tpIndex])
  navigator.clipboard
    .writeText(msg)
    .then(() => toast(`📋 TP${tpIndex + 1} message copied!`, 'info'))
    .catch(() => toast('❌ Copy failed', 'error'))
}

function previewMessage(id, type, tpIndex) {
  const trade = trades.find((t) => t.id === id)
  if (!trade) return
  let msg = ''
  if (type === 'open') msg = buildOpenMessage(trade)
  if (type === 'tp')
    msg =
      trade.tpMessages?.[tpIndex] ||
      buildTPHitMessage(trade, tpIndex, trade.tps[tpIndex])
  if (type === 'result') msg = trade.resultMessage || buildResultMessage(trade)

  // Show in output panel and switch to generator tab to see it
  showOutputMessage(msg)
  showSection('generator')
}

// ── HISTORY RENDER ────────────────────────────────────
function renderHistory() {
  const log = document.getElementById('trade-log')
  if (!log) return

  const filter = document.getElementById('history-filter')?.value || 'ALL'
  const filtered =
    filter === 'ALL' ? trades : trades.filter((t) => t.status === filter)
  const sub = document.getElementById('history-subtitle')
  if (sub)
    sub.textContent = `${filtered.length} of ${trades.length} trade${trades.length !== 1 ? 's' : ''}`

  if (!filtered.length) {
    log.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span>
      <p>${!trades.length ? 'No trades yet. Generate your first signal!' : 'No trades match this filter.'}</p></div>`
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

      // Live badge for OPEN
      const liveBadge =
        trade.status === 'OPEN'
          ? `<span class="live-badge" id="live-${trade.id}">● Live</span>`
          : ''
      const autoBadge = trade.autoTriggered
        ? `<span class="badge badge-auto">⚡ AUTO</span>`
        : ''

      // TP status rows
      const tpMedals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
      const tpRows = (trade.tps || [trade.tp])
        .map((tp, i) => {
          const hit = (trade.hitTPs || []).includes(i)
          const pct = Math.abs(calcProfitPct(trade, tp)).toFixed(2)
          const lossPct = Math.abs(calcLossPct(trade))
          const rr = (Math.abs(pct) / lossPct).toFixed(2)
          const rrLabel = getRRLabel(parseFloat(rr))

          return `
        <div class="tp-status-row ${hit ? 'hit' : ''}">
          <span class="tp-status-medal">${hit ? tpMedals[i] : '⬜'}</span>
          <span class="tp-status-label">TP ${i + 1}</span>
          <span class="tp-status-price">${tp}</span>
          <span class="tp-status-pct">+${pct}%</span>
          <span class="tp-status-rr">${rrLabel}</span>
          <span class="tp-status-state ${hit ? 'tp-hit-badge' : 'tp-open-badge'}">${hit ? '✔ HIT' : 'OPEN'}</span>
          ${hit ? `<button class="msg-btn tp-msg-btn" onclick="copyTPMessage(${trade.id},${i})">📋 TP${i + 1} Msg</button>` : ''}
        </div>`
        })
        .join('')

      // P&L + R:R for closed trades
      let pnlHtml = ''
      if (trade.profit !== null) {
        const lossPct = Math.abs(calcLossPct(trade))
        const rr = Math.abs(trade.profit) / lossPct
        const rrLabel = getRRLabel(rr)
        const rrEmoji = getRREmoji(rr)
        pnlHtml = `
        <div class="trade-result-bar ${trade.status === 'WIN' ? 'win-bar' : 'loss-bar'}">
          <div class="result-main">
            <span class="pnl-val ${trade.profit >= 0 ? 'pos' : 'neg'}">${trade.profit >= 0 ? '+' : ''}${trade.profit}%</span>
            <span class="rr-pill">${rrEmoji} ${rrLabel}</span>
            ${trade.autoTriggered ? '<span class="auto-pill">⚡ AUTO</span>' : ''}
          </div>
          <div class="result-sub">
            Exit: <strong>${trade.exitPrice}</strong>
            &nbsp;·&nbsp; ${new Date(trade.exitDate).toLocaleString()}
          </div>
        </div>`
      }

      // Action buttons
      const actionBtns =
        trade.status === 'OPEN'
          ? `
      <div class="trade-actions">
        <button class="trade-btn win"  onclick="updateTradeStatus(${trade.id},'WIN')">✓ WIN</button>
        <button class="trade-btn loss" onclick="updateTradeStatus(${trade.id},'LOSS')">✗ LOSS</button>
        <button class="trade-btn del"  onclick="deleteTrade(${trade.id})">🗑</button>
      </div>`
          : `
      <div class="trade-actions">
        <button class="trade-btn del" onclick="deleteTrade(${trade.id})">🗑 Delete</button>
      </div>`

      // Message buttons panel
      const msgPanel = `
      <div class="msg-panel">
        <span class="msg-panel-label">📤 Telegram Messages</span>
        <div class="msg-btn-row">
          <button class="msg-btn signal-btn" onclick="copyOpenMessage(${trade.id})">📋 Signal</button>
          ${(trade.hitTPs || [])
            .map(
              (i) =>
                `<button class="msg-btn tp-msg-btn" onclick="copyTPMessage(${trade.id},${i})">📋 TP${i + 1}</button>`,
            )
            .join('')}
          ${trade.status !== 'OPEN' ? `<button class="msg-btn result-btn" onclick="copyResultMessage(${trade.id})">📋 Result</button>` : ''}
          <button class="msg-btn preview-btn" onclick="previewMessage(${trade.id},'${trade.status !== 'OPEN' ? 'result' : 'open'}')">👁 Preview</button>
        </div>
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
          <div class="price-item"><span class="price-label">SL</span><span class="price-val sl-val">${trade.sl}</span></div>
          <div class="price-item"><span class="price-label">BE</span><span class="price-val">${trade.be}</span></div>
          <div class="price-item"><span class="price-label">Risk</span><span class="price-val">${trade.riskPct}%</span></div>
        </div>

        <div class="tp-status-section">
          <div class="tp-status-header">
            <span>Target Profits</span>
            <span>${(trade.hitTPs || []).length} / ${(trade.tps || [trade.tp]).length} hit</span>
          </div>
          ${tpRows}
        </div>

        ${trade.note ? `<div class="trade-note">💬 ${trade.note}</div>` : ''}
        ${pnlHtml}
        ${actionBtns}
        ${msgPanel}
      </div>`
    })
    .join('')
}

// ── STATISTICS ────────────────────────────────────────
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

// ── EXPORT / IMPORT ───────────────────────────────────
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
    'R:R',
    'Note',
  ]
  const rows = trades.map((t) => {
    const lossPct = Math.abs(calcLossPct(t))
    const rr = t.profit != null ? getRRLabel(Math.abs(t.profit) / lossPct) : ''
    return [
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
      rr,
      t.note || '',
    ]
  })
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

// ── MARKET TICKER ─────────────────────────────────────
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

// ── COIN SUGGESTIONS ──────────────────────────────────
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

// ── CLOCKS ────────────────────────────────────────────
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

// ── KZ TRACKER ────────────────────────────────────────
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
  const nameEl = document.getElementById('active-kz-name'),
    pctEl = document.getElementById('kz-percent')
  const barEl = document.getElementById('kz-bar'),
    msgEl = document.getElementById('kz-message'),
    cdEl = document.getElementById('kz-countdown')
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
    const waitSecs = minWait * 3600,
      pct = Math.max(
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
