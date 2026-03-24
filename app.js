// ════════════════════════════════════════════════════════
//  MASTER ANALYST VIP  ·  app.js  v6.0
//
//  Kill Zone UTC times (correct, DST-proof):
//  Asia KZ       01:00–03:00 UTC  (Tokyo open)
//  London KZ     07:00–10:00 UTC  (London open)
//  New York KZ   12:00–15:00 UTC  (NY open + London overlap)
//  London Close  15:00–17:00 UTC  (position squaring / reversals)
// ════════════════════════════════════════════════════════

// ── STATE ────────────────────────────────────────────────
let trades = JSON.parse(localStorage.getItem('ma_trades') || '[]')
let chart = null
let kzInterval = null
let priceMonitorInterval = null
let liveprices = {}
let tpCount = 2

// ── KILL ZONE SESSIONS (UTC) ─────────────────────────────
const KZ_SESSIONS = [
  {
    id: 'asia',
    name: 'ASIA KZ',
    startUTC: 1,
    endUTC: 3,
    icon: '🌏',
    color: '#8b5cf6',
    desc: 'Tokyo open',
    detail: 'AUD, NZD, JPY pairs · Medium volatility',
  },
  {
    id: 'london',
    name: 'LONDON KZ',
    startUTC: 7,
    endUTC: 10,
    icon: '🔥',
    color: '#f97316',
    desc: 'London open',
    detail: 'EUR, GBP, CHF pairs · Highest volume of the day',
  },
  {
    id: 'ny',
    name: 'NEW YORK KZ',
    startUTC: 12,
    endUTC: 15,
    icon: '⚡',
    color: '#ef4444',
    desc: 'NY open + London overlap',
    detail: 'Maximum liquidity · Best session to trade',
  },
  {
    id: 'close',
    name: 'LONDON CLOSE',
    startUTC: 15,
    endUTC: 17,
    icon: '🎯',
    color: '#f59e0b',
    desc: 'London close',
    detail: 'Position squaring · Watch for reversals',
  },
]

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
  'NEAR/USDT.P',
  'TRX/USDT.P',
  'ARB/USDT.P',
  'OP/USDT.P',
  'APT/USDT.P',
  'INJ/USDT.P',
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'XRP/USDT',
  'DOGE/USDT',
]

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateClocks()
  setInterval(updateClocks, 1000)
  initKZTracker()
  populateKZSchedule()
  fetchMarketData()
  setInterval(fetchMarketData, 15000)
  startPriceMonitor()
  loadCoinSuggestions()
  setupRiskPreview()
  renderHistory()
  updateStats()
  updateOpenBadge()
})

// ── TOAST ────────────────────────────────────────────────
function toast(msg, type = 'success', dur = 3500) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.className = `toast show ${type}`
  clearTimeout(el._t)
  el._t = setTimeout(() => {
    el.className = 'toast'
  }, dur)
}

// ── NAVIGATION ───────────────────────────────────────────
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

function updateOpenBadge() {
  const n = trades.filter((t) => t.status === 'OPEN').length
  const el = document.getElementById('open-count')
  if (!el) return
  el.textContent = n
  el.style.display = n > 0 ? 'inline' : 'none'
}

// ── QUICK COIN ───────────────────────────────────────────
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

// ── MULTI-TP ─────────────────────────────────────────────
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
  tpCount = 0
  document.querySelectorAll('.tp-row').forEach((row, i) => {
    tpCount = i + 1
    row.id = `tp-row-${tpCount}`
    row.querySelector('.tp-label').textContent = `TP ${tpCount}`
    row.querySelector('input').id = `tp${tpCount}`
    const btn = row.querySelector('.tp-remove')
    if (btn) {
      btn.onclick = () => removeTP(tpCount)
      btn.style.visibility = tpCount === 1 ? 'hidden' : 'visible'
    }
  })
}

function getTPValues() {
  return Array.from(document.querySelectorAll('.tp-row'))
    .map((_, i) => parseFloat(document.getElementById(`tp${i + 1}`)?.value))
    .filter((v) => !isNaN(v) && v > 0)
}

// ── RISK PREVIEW ─────────────────────────────────────────
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
  const profit = isShort
    ? ((entry - tp) / entry) * 100
    : ((tp - entry) / entry) * 100
  const loss = isShort
    ? ((sl - entry) / entry) * 100
    : ((entry - sl) / entry) * 100
  const rr = loss > 0 ? (profit / loss).toFixed(2) : '∞'
  document.getElementById('rr-ratio').textContent = `1 : ${rr}`
  document.getElementById('profit-pct').textContent = `+${profit.toFixed(2)}%`
  document.getElementById('loss-pct').textContent =
    `-${Math.abs(loss).toFixed(2)}%`
  preview.style.display = 'flex'
}

// ── MATH HELPERS ─────────────────────────────────────────
const isShort = (t) => t.side.includes('Short') || t.side.includes('Sell')
const profitPct = (t, p) =>
  isShort(t) ? ((t.entry - p) / t.entry) * 100 : ((p - t.entry) / t.entry) * 100
const lossPct = (t) =>
  isShort(t)
    ? ((t.sl - t.entry) / t.entry) * 100
    : ((t.entry - t.sl) / t.entry) * 100
const coinTag = (t) => '#' + t.coin.replace('/', '').toUpperCase()
const toBinanceSym = (c) => c.replace('/', '').replace('.P', '').toUpperCase()
const fmt = (n, d = 2) => parseFloat(n).toFixed(d)

function getRRLabel(rr) {
  const r = Math.abs(rr)
  if (r < 0.5) return `1 : ${r.toFixed(1)}`
  if (r < 1.5) return '1 : 1 ✅'
  if (r < 2.5) return '1 : 2 🔥'
  if (r < 3.5) return '1 : 3 🚀'
  if (r < 4.5) return '1 : 4 💎'
  return `1 : ${Math.floor(r)} 💎`
}
function getRREmoji(rr) {
  if (rr < 1) return '⚠️'
  if (rr < 2) return '✅'
  if (rr < 3) return '🔥'
  return '🚀'
}

// ── MESSAGE BUILDERS ─────────────────────────────────────

function buildOpenMessage(t) {
  const sh = isShort(t)
  const tag = coinTag(t)
  const dir = sh ? 'SHORT 🔴' : 'LONG  🟢'
  const arrow = sh ? '⬇️' : '⬆️'
  const lossP = fmt(Math.abs(lossPct(t)))
  const tp1P = fmt(Math.abs(profitPct(t, t.tps[0])))
  const rr = fmt(Math.abs(tp1P) / Math.abs(lossP))
  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const tpLines = t.tps
    .map((tp, i) => {
      const p = fmt(Math.abs(profitPct(t, tp)))
      return `  ${medals[i]} TP ${i + 1}  ›  ${tp}   (+${p}%)`
    })
    .join('\n')
  const beLine = t.be && t.be !== 'None' ? `  🔵 BE     ›  ${t.be}\n` : ''
  const noteLine = t.note ? `\n💬 ${t.note}\n` : ''

  return (
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}\n` +
    `  ${dir}  ${arrow}\n` +
    `╚══════════════════════════╝\n\n` +
    `📋 ${(t.orderType || 'LIMIT ORDER').toUpperCase()}\n` +
    `🔒 Leverage  :  ${t.leverage}\n\n` +
    `┌─────────────────────────┐\n` +
    `  📍 Entry  ›  ${t.entry}\n` +
    `${tpLines}\n` +
    `  🛑 SL     ›  ${t.sl}   (-${lossP}%)\n` +
    beLine +
    `└─────────────────────────┘\n\n` +
    `📊 Risk / Reward\n` +
    `  💰 Risk    :  ${t.riskPct}% of balance\n` +
    `  📈 Reward  :  +${tp1P}%  (TP1)\n` +
    `  ⚖️  R : R   :  1 : ${rr}\n` +
    noteLine +
    `\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `🙌 Risk Management  ·  🔰 Powered by\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

function buildTPHitMessage(t, idx, hitPrice) {
  const sh = isShort(t)
  const tag = coinTag(t)
  const tp = t.tps[idx]
  const pct = fmt(Math.abs(profitPct(t, tp)))
  const lossP = Math.abs(lossPct(t))
  const rr = parseFloat(pct) / lossP
  const rrLabel = getRRLabel(rr)
  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const isLast = idx === t.tps.length - 1
  const moreLine = !isLast
    ? `\n⏳ Trade still active — remaining TPs in play\n💡 Consider moving SL to Break Even`
    : `\n🎊 All targets reached — excellent trade!`

  return (
    `${getRREmoji(rr)} TP ${idx + 1} HIT!\n` +
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}  ${sh ? 'SHORT 🔴' : 'LONG 🟢'}\n` +
    `╚══════════════════════════╝\n\n` +
    `${medals[idx]} TP ${idx + 1}  ›  ${tp}\n` +
    `📍 Entry was  ›  ${t.entry}\n\n` +
    `┌─────────────────────────┐\n` +
    `  📈 Profit   :  +${pct}%\n` +
    `  ⚖️  R : R    :  ${rrLabel}\n` +
    `  💰 Risk was :  ${t.riskPct}% of balance\n` +
    `└─────────────────────────┘` +
    moreLine +
    `\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

function buildRRMessage(t, mult) {
  const sh = isShort(t)
  const tag = coinTag(t)
  const lossP = Math.abs(lossPct(t))
  const pct = fmt(lossP * mult)
  const rrPrice = sh
    ? fmt(t.entry - ((t.entry * lossP) / 100) * mult, 6)
    : fmt(t.entry + ((t.entry * lossP) / 100) * mult, 6)
  const note =
    mult >= 3
      ? `🚀 Exceptional! Consider locking in profits.`
      : mult >= 2
        ? `🔥 Trade running beautifully — protect your gains!`
        : `✅ 1:1 reached — move SL to Break Even now!`

  return (
    `${getRREmoji(mult)} 1:${mult} RR REACHED!\n` +
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}  ${sh ? 'SHORT 🔴' : 'LONG 🟢'}\n` +
    `╚══════════════════════════╝\n\n` +
    `📍 Entry        ›  ${t.entry}\n` +
    `⚖️  1:${mult} Level  ›  ~${rrPrice}\n\n` +
    `┌─────────────────────────┐\n` +
    `  📈 Profit   :  +${pct}%\n` +
    `  ⚖️  R : R    :  1 : ${mult}  ${getRREmoji(mult)}\n` +
    `  💰 Risk was :  ${t.riskPct}% of balance\n` +
    `└─────────────────────────┘\n\n` +
    `${note}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

function buildSLMessage(t) {
  const sh = isShort(t)
  const tag = coinTag(t)
  const lossP = fmt(Math.abs(lossPct(t)))
  const exitP = t.exitPrice || t.sl

  return (
    `🛑 STOP LOSS HIT\n` +
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}  ${sh ? 'SHORT 🔴' : 'LONG 🟢'}\n` +
    `╚══════════════════════════╝\n\n` +
    `📍 Entry   ›  ${t.entry}\n` +
    `🛑 SL Hit  ›  ${exitP}\n\n` +
    `┌─────────────────────────┐\n` +
    `  📉 Loss    :  -${lossP}%\n` +
    `  💰 Risk was :  ${t.riskPct}% of balance\n` +
    `└─────────────────────────┘\n\n` +
    `💪 Losses are part of trading.\n` +
    `   Protect capital — stay disciplined!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

function buildResultMessage(t) {
  const sh = isShort(t)
  const tag = coinTag(t)
  const isWin = t.status === 'WIN'
  const pnl = fmt(t.profit ?? 0)
  const lossP = Math.abs(lossPct(t))
  const rr = Math.abs(t.profit ?? 0) / lossP
  const rrLabel = getRRLabel(rr)
  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const tpSum = t.tps
    .map((tp, i) => {
      const hit = (t.hitTPs || []).includes(i)
      const p = fmt(Math.abs(profitPct(t, tp)))
      return `  ${hit ? medals[i] : '⬜'} TP ${i + 1}  ›  ${tp}  (+${p}%)  ${hit ? '✔ HIT' : '— missed'}`
    })
    .join('\n')

  const header = isWin ? `🏆 TRADE CLOSED — WIN!\n` : `🛑 TRADE CLOSED — LOSS\n`
  const pnlLine = isWin
    ? `  📈 Profit   :  +${pnl}%`
    : `  📉 Loss     :  ${pnl}%`
  const motive = isWin
    ? `🎉 Excellent execution! Discipline pays.`
    : `💪 Losses are part of trading.\n   Protect capital — next trade!`

  return (
    `${header}` +
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}  ${sh ? 'SHORT 🔴' : 'LONG 🟢'}\n` +
    `╚══════════════════════════╝\n\n` +
    `📍 Entry    ›  ${t.entry}\n` +
    `🏁 Exit     ›  ${t.exitPrice}\n\n` +
    `📊 TP Results:\n${tpSum}\n` +
    `  🛑 SL      ›  ${t.sl}\n\n` +
    `┌─────────────────────────┐\n` +
    `${pnlLine}\n` +
    `  ⚖️  R : R   :  ${rrLabel}\n` +
    `  💰 Risk was :  ${t.riskPct}% of balance\n` +
    `  🤖 Trigger  :  ${t.autoTriggered ? 'Auto ⚡' : 'Manual 🖐'}\n` +
    `└─────────────────────────┘\n\n` +
    `${motive}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

// ── POPUP ────────────────────────────────────────────────
function showMsgPopup(msg, title) {
  document.getElementById('popup-title').textContent = title
  document.getElementById('popup-body').textContent = msg
  document.getElementById('popup-overlay').classList.add('show')
  document.getElementById('popup-copy-btn')._msg = msg
}
function closePopup() {
  document.getElementById('popup-overlay').classList.remove('show')
}
function handleOverlayClick(e) {
  if (e.target.id === 'popup-overlay') closePopup()
}
function copyFromPopup() {
  const msg = document.getElementById('popup-copy-btn')._msg
  if (!msg) return
  navigator.clipboard
    .writeText(msg)
    .then(() => {
      toast('📋 Copied!', 'info')
      closePopup()
    })
    .catch(() => toast('❌ Copy failed', 'error'))
}

// ── MESSAGE ROUTER ───────────────────────────────────────
function getMsg(id, type, extra) {
  const t = trades.find((x) => x.id === id)
  if (!t) return null
  switch (type) {
    case 'signal':
      return { title: '📊 Signal Message', msg: buildOpenMessage(t) }
    case 'rr':
      return { title: `⚖️ 1:${extra} RR Update`, msg: buildRRMessage(t, extra) }
    case 'tp':
      return {
        title: `🎯 TP${extra + 1} Hit`,
        msg: t.tpMessages?.[extra] || buildTPHitMessage(t, extra, t.tps[extra]),
      }
    case 'sl':
      return { title: '🛑 Stop Loss Message', msg: buildSLMessage(t) }
    case 'result':
      return {
        title: '🏁 Final Result',
        msg: t.resultMessage || buildResultMessage(t),
      }
    default:
      return null
  }
}
function openMsgPopup(id, type, extra) {
  const d = getMsg(id, type, extra)
  if (d) showMsgPopup(d.msg, d.title)
}

// ── OUTPUT PANEL ─────────────────────────────────────────
function showOutput(msg, label) {
  const out = document.getElementById('output')
  const area = document.getElementById('output-area')
  const lbl = document.getElementById('output-label')
  if (out) out.value = msg
  if (lbl) lbl.textContent = label || '📤 Ready to Copy'
  if (area) {
    area.style.display = 'block'
    area.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}
function copyOutput() {
  const out = document.getElementById('output')
  if (!out?.value) return toast('Nothing to copy', 'error')
  navigator.clipboard
    .writeText(out.value)
    .then(() => toast('📋 Copied!', 'info'))
    .catch(() => {
      out.select()
      document.execCommand('copy')
      toast('📋 Copied!', 'info')
    })
}

// ── SIGNAL GENERATOR ─────────────────────────────────────
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
  if (!tps.length) return toast('❌ At least one TP required', 'error')

  // Validate TP direction
  const sh = side.includes('Short')
  const invalidTP = tps.some((tp) => (sh ? tp >= entry : tp <= entry))
  if (invalidTP)
    return toast('❌ TP must be in the correct direction from entry', 'error')

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
    tpMessages: {},
    autoTriggered: false,
    resultMessage: null,
  }
  trades.unshift(trade)
  saveTrades()

  showOutput(buildOpenMessage(trade), '📤 Signal — Ready to Copy')
  resetForm()
  updateStats()
  updateOpenBadge()
  startPriceMonitor()
  toast('✅ Signal saved & monitoring active!', 'success')
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
  const pr = document.getElementById('risk-preview')
  if (pr) pr.style.display = 'none'
}

// ── PRICE MONITOR ────────────────────────────────────────
function startPriceMonitor() {
  if (priceMonitorInterval) clearInterval(priceMonitorInterval)
  priceMonitorInterval = setInterval(checkOpenTrades, 5000)
  checkOpenTrades()
  updateMonitorBadge(true)
}

function updateMonitorBadge(on) {
  const el = document.getElementById('monitor-status')
  if (!el) return
  el.textContent = on ? '● Monitor' : '○ Monitor'
  el.className = on ? 'sf-item monitor-badge' : 'sf-item monitor-badge offline'
}

async function checkOpenTrades() {
  const open = trades.filter((t) => t.status === 'OPEN')
  if (!open.length) {
    updateMonitorBadge(false)
    return
  }
  const syms = [...new Set(open.map((t) => toBinanceSym(t.coin)))]
  try {
    const data = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(syms)}`,
    ).then((r) => r.json())

    if (Array.isArray(data))
      data.forEach((d) => {
        liveprices[d.symbol] = parseFloat(d.price)
      })
    else if (data.symbol) liveprices[data.symbol] = parseFloat(data.price)

    let changed = false
    open.forEach((trade) => {
      const price = liveprices[toBinanceSym(trade.coin)]
      if (!price) return
      const sh = isShort(trade)

      // ── SL: price reaches OR passes through SL ──
      const slHit = sh ? price >= trade.sl : price <= trade.sl
      if (slHit) {
        autoClose(trade, 'LOSS', price)
        changed = true
        return
      }

      // ── TPs: price reaches OR passes through each TP ──
      trade.tps.forEach((tp, i) => {
        if ((trade.hitTPs || []).includes(i)) return
        const hit = sh ? price <= tp : price >= tp
        if (!hit) return
        if (!trade.hitTPs) trade.hitTPs = []
        if (!trade.tpMessages) trade.tpMessages = {}
        trade.hitTPs.push(i)
        trade.tpMessages[i] = buildTPHitMessage(trade, i, price)
        changed = true

        // Show TP message in output panel
        showOutput(trade.tpMessages[i], `🎯 TP${i + 1} Hit — Copy to Telegram`)
        toast(
          `🎯 ${trade.coin} TP${i + 1} hit @ ${price.toLocaleString()}!`,
          'success',
          6000,
        )

        if (trade.hitTPs.length === trade.tps.length)
          autoClose(trade, 'WIN', price)
      })

      updateLiveBadge(trade.id, price)
    })

    if (changed) {
      saveTrades()
      renderHistory()
      updateStats()
      updateOpenBadge()
    }
    updateMonitorBadge(true)
  } catch (e) {
    console.warn('Monitor error:', e)
    updateMonitorBadge(false)
  }
}

function autoClose(trade, status, exitPrice) {
  if (trade.status !== 'OPEN') return
  const sh = isShort(trade)
  trade.status = status
  trade.exitDate = new Date().toISOString()
  trade.exitPrice = exitPrice
  trade.autoTriggered = true
  trade.profit = parseFloat(
    fmt(
      sh
        ? ((trade.entry - exitPrice) / trade.entry) * 100
        : ((exitPrice - trade.entry) / trade.entry) * 100,
    ),
  )
  trade.resultMessage = buildResultMessage(trade)
  showOutput(
    trade.resultMessage,
    status === 'WIN'
      ? '🏆 WIN — Copy Result to Telegram'
      : '🛑 LOSS — Copy Result to Telegram',
  )
  const icon = status === 'WIN' ? '✅' : '🛑'
  toast(
    `${icon} ${trade.coin} AUTO-${status} @ ${exitPrice.toLocaleString()}  (${trade.profit >= 0 ? '+' : ''}${trade.profit}%)`,
    status === 'WIN' ? 'success' : 'error',
    7000,
  )
}

function updateLiveBadge(id, price) {
  const el = document.getElementById(`live-${id}`)
  if (el)
    el.textContent = `● $${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
}

// ── MANUAL CLOSE ─────────────────────────────────────────
function updateTradeStatus(id, status) {
  const trade = trades.find((t) => t.id === id)
  if (!trade || trade.status !== 'OPEN') return
  const def = status === 'WIN' ? trade.tp : trade.sl
  const raw = prompt(`Exit price for P&L (default: ${def}):`, def)
  if (raw === null) return
  const exit = parseFloat(raw) || def
  const sh = isShort(trade)
  trade.status = status
  trade.exitDate = new Date().toISOString()
  trade.exitPrice = exit
  trade.autoTriggered = false
  trade.profit = parseFloat(
    fmt(
      sh
        ? ((trade.entry - exit) / trade.entry) * 100
        : ((exit - trade.entry) / trade.entry) * 100,
    ),
  )
  trade.resultMessage = buildResultMessage(trade)
  showOutput(
    trade.resultMessage,
    status === 'WIN' ? '🏆 WIN — Copy Result' : '🛑 LOSS — Copy Result',
  )
  saveTrades()
  renderHistory()
  updateStats()
  updateOpenBadge()
  toast(`Trade marked ${status}`, status === 'WIN' ? 'success' : 'error')
}

function deleteTrade(id) {
  if (!confirm('Delete this trade permanently?')) return
  trades = trades.filter((t) => t.id !== id)
  saveTrades()
  renderHistory()
  updateStats()
  updateOpenBadge()
  toast('🗑 Trade deleted', 'info')
}

function saveTrades() {
  localStorage.setItem('ma_trades', JSON.stringify(trades))
}

// ── HISTORY RENDER ────────────────────────────────────────
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
      const sh = isShort(trade)
      const sideClass = sh ? 'badge-short' : 'badge-long'
      const stClass = {
        WIN: 'badge-win',
        LOSS: 'badge-loss',
        OPEN: 'badge-open',
      }[trade.status]
      const itemClass = `status-${trade.status.toLowerCase()}`

      const liveBadge =
        trade.status === 'OPEN'
          ? `<span class="live-badge" id="live-${trade.id}">● Live</span>`
          : ''
      const autoBadge = trade.autoTriggered
        ? `<span class="badge badge-auto">⚡ AUTO</span>`
        : ''

      // ── TP Status rows ──
      const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
      const tpRows = (trade.tps || [trade.tp])
        .map((tp, i) => {
          const hit = (trade.hitTPs || []).includes(i)
          const p = fmt(Math.abs(profitPct(trade, tp)))
          const lossP = Math.abs(lossPct(trade))
          const rr = parseFloat(p) / lossP
          const rrLbl = getRRLabel(rr)
          return `
        <div class="tp-status-row ${hit ? 'hit' : ''}">
          <span class="tps-medal">${hit ? medals[i] : '⬜'}</span>
          <span class="tps-label">TP ${i + 1}</span>
          <span class="tps-price">${tp}</span>
          <span class="tps-pct">+${p}%</span>
          <span class="tps-rr">${rrLbl}</span>
          <span class="tps-state ${hit ? 'tps-hit-badge' : 'tps-open-badge'}">${hit ? '✔ HIT' : 'OPEN'}</span>
        </div>`
        })
        .join('')

      // ── P&L result bar ──
      let pnlHtml = ''
      if (trade.profit !== null) {
        const lossP = Math.abs(lossPct(trade))
        const rr = Math.abs(trade.profit) / lossP
        pnlHtml = `
        <div class="trade-result-bar ${trade.status === 'WIN' ? 'win-bar' : 'loss-bar'}">
          <div class="result-main">
            <span class="pnl-val ${trade.profit >= 0 ? 'pos' : 'neg'}">${trade.profit >= 0 ? '+' : ''}${trade.profit}%</span>
            <span class="rr-pill">${getRREmoji(rr)} ${getRRLabel(rr)}</span>
            ${trade.autoTriggered ? '<span class="auto-pill">⚡ AUTO</span>' : ''}
          </div>
          <div class="result-sub">
            Exit: <strong>${trade.exitPrice}</strong>
            &nbsp;·&nbsp; ${new Date(trade.exitDate).toLocaleString()}
          </div>
        </div>`
      }

      // ── Action buttons ──
      const actions =
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

      // ── SMART context-aware message panel ──
      // Only show buttons that are relevant to what has happened / can happen
      const msgBtns = []

      if (trade.status === 'OPEN') {
        // Original signal — always available
        msgBtns.push({ type: 'signal', label: '📊 Signal', cls: 'signal-btn' })
        // R:R updates — only while trade is OPEN and running
        msgBtns.push({
          type: 'rr',
          label: '⚖️ 1:1 RR',
          cls: 'rr-btn',
          extra: 1,
        })
        msgBtns.push({
          type: 'rr',
          label: '⚖️ 1:2 RR',
          cls: 'rr-btn',
          extra: 2,
        })
        msgBtns.push({
          type: 'rr',
          label: '⚖️ 1:3 RR',
          cls: 'rr-btn',
          extra: 3,
        })
        // Only show TP buttons for TPs that have already been hit
        ;(trade.hitTPs || []).forEach((i) =>
          msgBtns.push({
            type: 'tp',
            label: `🎯 TP${i + 1}`,
            cls: 'tp-msg-btn',
            extra: i,
          }),
        )
      } else if (trade.status === 'WIN') {
        // Won: signal + hit TP messages + final result. NO SL button.
        msgBtns.push({ type: 'signal', label: '📊 Signal', cls: 'signal-btn' })
        ;(trade.hitTPs || []).forEach((i) =>
          msgBtns.push({
            type: 'tp',
            label: `🎯 TP${i + 1}`,
            cls: 'tp-msg-btn',
            extra: i,
          }),
        )
        msgBtns.push({
          type: 'result',
          label: '🏆 Final Result',
          cls: 'result-btn',
        })
      } else if (trade.status === 'LOSS') {
        // Lost: signal + SL message + final result. NO TP or RR buttons.
        msgBtns.push({ type: 'signal', label: '📊 Signal', cls: 'signal-btn' })
        msgBtns.push({ type: 'sl', label: '🛑 SL Hit', cls: 'sl-btn' })
        msgBtns.push({
          type: 'result',
          label: '📋 Final Result',
          cls: 'result-btn',
        })
      }

      const msgPanel = `
      <div class="msg-panel">
        <div class="msg-panel-header">
          <span class="msg-panel-label">📤 Telegram Messages</span>
          <span class="msg-panel-hint">Click to preview &amp; copy</span>
        </div>
        <div class="msg-btn-row">
          ${msgBtns
            .map(
              (b) =>
                `<button class="msg-btn ${b.cls}"
              onclick="openMsgPopup(${trade.id},'${b.type}',${b.extra ?? 'null'})"
            >${b.label}</button>`,
            )
            .join('')}
        </div>
      </div>`

      return `
      <div class="trade-item ${itemClass}">
        <div class="trade-header">
          <div>
            <div class="trade-name">
              ${trade.coin} ${liveBadge}
            </div>
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
          <div class="price-item">
            <span class="price-label">Entry</span>
            <span class="price-val">${trade.entry}</span>
          </div>
          <div class="price-item">
            <span class="price-label">Stop Loss</span>
            <span class="price-val sl-v">${trade.sl}</span>
          </div>
          <div class="price-item">
            <span class="price-label">Break Even</span>
            <span class="price-val">${trade.be}</span>
          </div>
          <div class="price-item">
            <span class="price-label">Risk</span>
            <span class="price-val">${trade.riskPct}%</span>
          </div>
        </div>

        <div class="tp-status-section">
          <div class="tp-status-head">
            <span>Take Profit Targets</span>
            <span>${(trade.hitTPs || []).length} / ${(trade.tps || [trade.tp]).length} hit</span>
          </div>
          ${tpRows}
        </div>

        ${trade.note ? `<div class="trade-note">💬 ${trade.note}</div>` : ''}
        ${pnlHtml}
        ${actions}
        ${msgPanel}
      </div>`
    })
    .join('')
}

// ── STATISTICS ───────────────────────────────────────────
function updateStats() {
  const closed = trades.filter((t) => t.status !== 'OPEN')
  const wins = closed.filter((t) => t.status === 'WIN').length
  const open = trades.filter((t) => t.status === 'OPEN').length
  const wr = closed.length ? ((wins / closed.length) * 100).toFixed(1) : '0'
  const gP = closed
    .filter((t) => t.profit > 0)
    .reduce((s, t) => s + t.profit, 0)
  const gL = Math.abs(
    closed.filter((t) => t.profit < 0).reduce((s, t) => s + t.profit, 0),
  )
  const pf = gL > 0 ? (gP / gL).toFixed(2) : gP > 0 ? '∞' : '0'
  const pnl = closed.reduce((s, t) => s + (t.profit || 0), 0)

  const set = (id, v) => {
    const e = document.getElementById(id)
    if (e) e.textContent = v
  }
  set('stat-total', trades.length)
  set('stat-closed', closed.length)
  set('stat-open', open)
  set('stat-winrate', wr + '%')
  set('stat-profit-factor', pf)

  const pnlEl = document.getElementById('stat-total-pnl')
  if (pnlEl) {
    pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + '%'
    pnlEl.style.color = pnl >= 0 ? 'var(--win)' : 'var(--loss)'
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
      if (!md[m]) md[m] = { w: 0, l: 0 }
      if (t.status === 'WIN') md[m].w++
      if (t.status === 'LOSS') md[m].l++
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
          data: months.map((m) => md[m].w),
          backgroundColor: 'rgba(31,216,160,.7)',
          borderRadius: 6,
        },
        {
          label: 'Losses',
          data: months.map((m) => md[m].l),
          backgroundColor: 'rgba(244,80,106,.7)',
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
            color: '#6b80a0',
            font: { family: 'Space Grotesk', size: 12 },
          },
        },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { ticks: { color: '#6b80a0' }, grid: { color: '#1e2f48' } },
        y: {
          ticks: { color: '#6b80a0', stepSize: 1 },
          grid: { color: '#1e2f48' },
          beginAtZero: true,
        },
      },
    },
  })
}

// ── EXPORT / IMPORT ──────────────────────────────────────
function exportAllData() {
  dlBlob(
    new Blob([JSON.stringify(trades, null, 2)], { type: 'application/json' }),
    `mavip_backup_${today()}.json`,
  )
  toast('💾 Data exported!', 'success')
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
        updateOpenBadge()
        toast('✅ Data imported!', 'success')
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
    'OrderType',
    'Entry',
    'TPs',
    'SL',
    'BE',
    'Leverage',
    'RiskPct',
    'Status',
    'ExitPrice',
    'PnL%',
    'RR',
    'AutoTriggered',
    'Note',
  ]
  const rows = trades.map((t) => {
    const lossP = Math.abs(lossPct(t))
    const rr = t.profit != null ? getRRLabel(Math.abs(t.profit) / lossP) : ''
    return [
      t.id,
      new Date(t.date).toLocaleString(),
      t.coin,
      t.side,
      t.orderType || '',
      t.entry,
      (t.tps || [t.tp]).join('|'),
      t.sl,
      t.be,
      t.leverage || '',
      t.riskPct || '',
      t.status,
      t.exitPrice || '',
      t.profit ?? '',
      rr,
      t.autoTriggered ? 'Yes' : 'No',
      t.note || '',
    ]
  })
  const csv = [h, ...rows]
    .map((r) => r.map((c) => `"${c}"`).join(','))
    .join('\n')
  dlBlob(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
    `mavip_report_${today()}.csv`,
  )
  toast('📊 CSV exported!', 'success')
}
const dlBlob = (blob, name) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
const today = () => new Date().toISOString().split('T')[0]

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
  updateOpenBadge()
  const oa = document.getElementById('output-area')
  if (oa) oa.style.display = 'none'
  toast('🗑 Database wiped', 'info')
}

// ── MARKET TICKER ────────────────────────────────────────
async function fetchMarketData() {
  try {
    const data = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","LINKUSDT","AVAXUSDT","DOTUSDT"]',
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
    if (el) el.textContent = `⬡ LIVE PRICES   ${text}   ⬡   ${text}`
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

// ── COIN SUGGESTIONS ────────────────────────────────────
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

// ── CLOCKS ───────────────────────────────────────────────
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

  // Highlight clock card during active KZ
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60
  const inKZ = (s) => utcH >= s.startUTC && utcH < s.endUTC
  document
    .getElementById('clock-ny')
    ?.classList.toggle(
      'kz-active',
      KZ_SESSIONS.filter((s) => s.id === 'ny' || s.id === 'close').some(inKZ),
    )
  document
    .getElementById('clock-london')
    ?.classList.toggle(
      'kz-active',
      KZ_SESSIONS.filter(
        (s) => s.id === 'london' || s.id === 'ny' || s.id === 'close',
      ).some(inKZ),
    )
}

// ── KZ SCHEDULE SIDEBAR ──────────────────────────────────
function populateKZSchedule() {
  // Show local time equivalent for each session
  const map = {
    asia: 'sch-asia',
    london: 'sch-london',
    ny: 'sch-ny',
    close: 'sch-close',
  }
  const localLabel = (id, startUTC) => {
    const el = document.getElementById(`${map[id]}-local`)
    if (!el) return
    const d = new Date()
    d.setUTCHours(Math.floor(startUTC), (startUTC % 1) * 60, 0, 0)
    el.textContent =
      new Intl.DateTimeFormat('en-LK', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d) + ' LKT'
  }
  KZ_SESSIONS.forEach((s) => localLabel(s.id, s.startUTC))
}

// ── KZ TRACKER ───────────────────────────────────────────
function initKZTracker() {
  if (kzInterval) clearInterval(kzInterval)
  updateKZTracker()
  kzInterval = setInterval(updateKZTracker, 1000)
}

function updateKZTracker() {
  const now = new Date()
  const utcH =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  let active = null

  for (const s of KZ_SESSIONS) {
    if (utcH >= s.startUTC && utcH < s.endUTC) {
      active = {
        sess: s,
        pct: ((utcH - s.startUTC) / (s.endUTC - s.startUTC)) * 100,
        remaining: (s.endUTC - utcH) * 3600,
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

  // Update schedule row highlights
  KZ_SESSIONS.forEach((s) => {
    const row = document.getElementById(`sch-${s.id}`)
    if (row) row.classList.toggle('active-session', active?.sess.id === s.id)
  })

  if (active) {
    const { sess, pct, remaining } = active
    tracker?.classList.add('active')
    if (nameEl) nameEl.textContent = `${sess.icon} ${sess.name} — ACTIVE`
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`
    if (barEl) {
      barEl.style.width = `${pct}%`
      barEl.style.backgroundColor = sess.color
    }
    if (msgEl) msgEl.textContent = `${sess.desc}  ·  ${sess.detail}`
    if (cdEl) cdEl.textContent = `🔥 Ends in ${fmtTime(remaining)}`
  } else {
    tracker?.classList.remove('active')

    // Find next session
    let next = null,
      minWait = Infinity
    for (const s of KZ_SESSIONS) {
      const w = utcH < s.startUTC ? s.startUTC - utcH : 24 - utcH + s.startUTC
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
      barEl.style.backgroundColor = '#3a4d68'
    }
    if (msgEl)
      msgEl.textContent = next
        ? `${next.icon} ${next.desc}  ·  ${next.detail}`
        : ''
    if (cdEl) cdEl.textContent = next ? `Starts in ${fmtTime(waitSecs)}` : ''
  }
}

function fmtTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0)
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}
