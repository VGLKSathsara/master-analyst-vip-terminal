// ════════════════════════════════════════════════════════════
//  MASTER ANALYST VIP  ·  app.js  v6.1
//
//  KILL ZONES — Correct ICT times in UTC (DST-proof):
//    Asia KZ       01:00–03:00 UTC  (Tokyo open, AUD/NZD/JPY)
//    London KZ     07:00–10:00 UTC  (London open, EUR/GBP/CHF)
//    New York KZ   12:00–15:00 UTC  (NY open + London overlap)
//    London Close  15:00–17:00 UTC  (Position squaring, reversals)
//
//  BUGS FIXED vs v6.0:
//    • isShort() renamed to tradeIsShort() — no variable shadowing
//    • fmt() numeric operations now work correctly (parse before math)
//    • calcRr() now operates on numbers, not strings
//    • removeTP() closure bug fixed — captures final index value
//    • populateKZSchedule() fixed date construction for local times
//    • autoClose() guard against double-close race condition
//    • Manual close now uses tps[0] as WIN exit default (not tp)
//    • updateMonthlyChart() guards against empty data
//    • TP direction validation fixed — uses correct scoped variable
//    • Monitor badge class names corrected
// ════════════════════════════════════════════════════════════

// ── STATE ──────────────────────────────────────────────────
let trades = JSON.parse(localStorage.getItem('ma_trades') || '[]')
let chart = null
let kzInterval = null
let priceMonitorInterval = null
let liveprices = {} // { 'BTCUSDT': 69000 }
let tpCount = 2

// ── KILL ZONE SESSIONS (UTC hours) ─────────────────────────
const KZ_SESSIONS = [
  {
    id: 'asia',
    name: 'ASIA KZ',
    startUTC: 1,
    endUTC: 3,
    icon: '🌏',
    color: '#8b5cf6',
    desc: 'Tokyo open · AUD, NZD, JPY',
    detail: 'Medium volatility',
  },
  {
    id: 'london',
    name: 'LONDON KZ',
    startUTC: 7,
    endUTC: 10,
    icon: '🔥',
    color: '#f97316',
    desc: 'London open · EUR, GBP, CHF',
    detail: 'Highest volume of the day',
  },
  {
    id: 'ny',
    name: 'NEW YORK KZ',
    startUTC: 12,
    endUTC: 15,
    icon: '⚡',
    color: '#ef4444',
    desc: 'NY open + London overlap',
    detail: 'Maximum liquidity — best session',
  },
  {
    id: 'close',
    name: 'LONDON CLOSE',
    startUTC: 15,
    endUTC: 17,
    icon: '🎯',
    color: '#f59e0b',
    desc: 'London close · Position squaring',
    detail: 'Watch for reversals',
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

// ── INIT ────────────────────────────────────────────────────
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

// ── TOAST ───────────────────────────────────────────────────
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

// ── NAVIGATION ──────────────────────────────────────────────
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

// ── QUICK COIN ──────────────────────────────────────────────
function setQuickCoin(coin) {
  document.getElementById('coin').value = coin
  const label = coin.replace('/USDT.P', '').replace('/USDT', '')
  document
    .querySelectorAll('.coin-pill')
    .forEach((p) =>
      p.classList.toggle('active', p.textContent.trim() === label),
    )
  calcRisk()
}

// ── MULTI-TP MANAGEMENT ─────────────────────────────────────
function addTP() {
  if (tpCount >= 6) return toast('Maximum 6 TPs allowed', 'info')
  tpCount++
  const n = tpCount // capture current value — fixes closure bug
  const row = document.createElement('div')
  row.className = 'tp-row'
  row.id = `tp-row-${n}`
  row.innerHTML = `
    <span class="tp-label">TP ${n}</span>
    <input type="number" id="tp${n}" placeholder="0.00000" step="any"/>
    <button class="tp-remove" onclick="removeTP(${n})">✕</button>`
  document.getElementById('tp-inputs').appendChild(row)
}

function removeTP(n) {
  if (n === 1) return
  document.getElementById(`tp-row-${n}`)?.remove()
  // Renumber all remaining rows
  const rows = Array.from(document.querySelectorAll('.tp-row'))
  tpCount = rows.length
  rows.forEach((row, i) => {
    const num = i + 1
    row.id = `tp-row-${num}`
    row.querySelector('.tp-label').textContent = `TP ${num}`
    const inp = row.querySelector('input')
    if (inp) inp.id = `tp${num}`
    const btn = row.querySelector('.tp-remove')
    if (btn) {
      btn.style.visibility = num === 1 ? 'hidden' : 'visible'
      btn.onclick = num === 1 ? null : () => removeTP(num)
    }
  })
}

function getTPValues() {
  return Array.from(document.querySelectorAll('.tp-row'))
    .map((_, i) =>
      parseFloat(document.getElementById(`tp${i + 1}`)?.value || ''),
    )
    .filter((v) => Number.isFinite(v) && v > 0)
}

// ── RISK PREVIEW ────────────────────────────────────────────
function setupRiskPreview() {
  ;['entry', 'sl', 'side'].forEach((id) =>
    document.getElementById(id)?.addEventListener('input', calcRisk),
  )
  document.getElementById('tp-inputs')?.addEventListener('input', calcRisk)
}

function calcRisk() {
  const entry = parseFloat(document.getElementById('entry')?.value || '')
  const tp1 = parseFloat(document.getElementById('tp1')?.value || '')
  const sl = parseFloat(document.getElementById('sl')?.value || '')
  const sideVal = document.getElementById('side')?.value || ''
  const short = sideVal.includes('Short')
  const preview = document.getElementById('risk-preview')
  if (!preview) return

  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(tp1) ||
    !Number.isFinite(sl) ||
    entry <= 0
  ) {
    preview.style.display = 'none'
    return
  }

  const profit = short
    ? ((entry - tp1) / entry) * 100
    : ((tp1 - entry) / entry) * 100
  const loss = short
    ? ((sl - entry) / entry) * 100
    : ((entry - sl) / entry) * 100

  if (profit <= 0 || loss <= 0) {
    preview.style.display = 'none'
    return
  }

  const rr = (profit / loss).toFixed(2)
  document.getElementById('rr-ratio').textContent = `1 : ${rr}`
  document.getElementById('profit-pct').textContent = `+${profit.toFixed(2)}%`
  document.getElementById('loss-pct').textContent = `-${loss.toFixed(2)}%`
  preview.style.display = 'flex'
}

// ── MATH HELPERS ────────────────────────────────────────────
// FIX: renamed to tradeIsShort() to avoid variable shadowing with local 'short' vars
function tradeIsShort(t) {
  return t.side.includes('Short') || t.side.includes('Sell')
}

// Returns profit % of a given exit price vs entry (positive = profit)
function calcProfitPct(t, price) {
  const p = parseFloat(price),
    e = parseFloat(t.entry)
  return tradeIsShort(t) ? ((e - p) / e) * 100 : ((p - e) / e) * 100
}

// Returns loss % (always positive magnitude of the SL hit)
function calcLossPct(t) {
  const e = parseFloat(t.entry),
    sl = parseFloat(t.sl)
  const raw = tradeIsShort(t) ? ((sl - e) / e) * 100 : ((e - sl) / e) * 100
  return Math.abs(raw)
}

// FIX: accepts numbers, not strings — safe division
function calcRR(profitPct, lossPct) {
  const p = Math.abs(parseFloat(profitPct))
  const l = Math.abs(parseFloat(lossPct))
  return l > 0 ? p / l : 0
}

function fmtNum(n, d = 2) {
  return parseFloat(parseFloat(n).toFixed(d))
}

function fmtStr(n, d = 2) {
  return parseFloat(n).toFixed(d)
}

function coinTag(t) {
  return '#' + t.coin.replace('/', '').toUpperCase()
}

function toBinanceSym(coin) {
  return coin.replace('/', '').replace('.P', '').toUpperCase()
}

function getRRLabel(rr) {
  const r = Math.abs(parseFloat(rr))
  if (!isFinite(r) || r <= 0) return '—'
  if (r < 1.0) return `1 : ${r.toFixed(2)}`
  // Show clean integer label for whole numbers, decimal for fractions
  const rounded = Math.round(r * 10) / 10
  const display = Number.isInteger(rounded) ? rounded : rounded.toFixed(1)
  return `1 : ${display}`
}

function getRREmoji(rr) {
  const r = Math.abs(parseFloat(rr))
  if (r < 1) return '⚠️'
  if (r < 2) return '✅'
  if (r < 3) return '🔥'
  if (r < 5) return '🚀'
  return '💎'
}

function getRRNote(mult) {
  if (mult >= 5) return `💎 Exceptional move! Consider securing all profits.`
  if (mult >= 4) return `🚀 Incredible run! Lock in profits or trail your stop.`
  if (mult >= 3) return `🚀 Outstanding! Consider locking in partial profits.`
  if (mult >= 2) return `🔥 Trade running beautifully — protect your position!`
  return `✅ 1:1 achieved — move SL to Break Even to eliminate risk!`
}

// ── COMPUTE ALL R:R MILESTONES FOR A TRADE ──────────────────
// Returns an array of whole-number R:R multiples from 1 up to
// the maximum R:R reachable by the furthest TP.
// e.g. if max TP gives 1:4.7 RR → returns [1, 2, 3, 4]
function getTradeRRMilestones(trade) {
  const lossP = calcLossPct(trade)
  if (!lossP || lossP <= 0) return []

  // Find the highest R:R achievable across all TPs
  const maxRR = Math.max(
    ...trade.tps.map((tp) => calcRR(Math.abs(calcProfitPct(trade, tp)), lossP)),
  )

  if (maxRR <= 0) return []

  // Generate every whole-number milestone from 1 up to floor(maxRR)
  const milestones = []
  for (let n = 1; n <= Math.floor(maxRR); n++) {
    milestones.push(n)
  }
  return milestones
}

// ── MESSAGE BUILDERS ────────────────────────────────────────

function buildOpenMessage(t) {
  const short = tradeIsShort(t)
  const tag = coinTag(t)
  const dir = short ? 'SHORT 🔴' : 'LONG  🟢'
  const arrow = short ? '⬇️' : '⬆️'
  const lossP = fmtStr(calcLossPct(t))
  const tp1Prof = fmtStr(calcProfitPct(t, t.tps[0]))
  const rr = fmtStr(calcRR(tp1Prof, lossP))
  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']

  const tpLines = t.tps
    .map((tp, i) => {
      const p = fmtStr(Math.abs(calcProfitPct(t, tp)))
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
    `  📈 Reward  :  +${tp1Prof}%  (TP1)\n` +
    `  ⚖️  R : R   :  1 : ${rr}\n` +
    noteLine +
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `🙌 Risk Management  ·  🔰 Powered by\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

function buildTPHitMessage(t, idx, hitPrice) {
  const short = tradeIsShort(t)
  const tag = coinTag(t)
  const tp = t.tps[idx]
  const profPct = fmtStr(Math.abs(calcProfitPct(t, tp)))
  const lossP = calcLossPct(t)
  const rr = calcRR(profPct, lossP)
  const rrLabel = getRRLabel(rr)
  const rrEmoji = getRREmoji(rr)
  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const isLast = idx === t.tps.length - 1
  const extra = isLast
    ? `\n🎊 All targets reached — excellent trade!`
    : `\n⏳ Trade still active — remaining TPs in play\n💡 Consider moving SL to Break Even now`

  return (
    `${rrEmoji} TP ${idx + 1} HIT!\n` +
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}  ${short ? 'SHORT 🔴' : 'LONG 🟢'}\n` +
    `╚══════════════════════════╝\n\n` +
    `${medals[idx]} TP ${idx + 1}  ›  ${tp}\n` +
    `📍 Entry was  ›  ${t.entry}\n\n` +
    `┌─────────────────────────┐\n` +
    `  📈 Profit   :  +${profPct}%\n` +
    `  ⚖️  R : R    :  ${rrLabel}\n` +
    `  💰 Risk was :  ${t.riskPct}% of balance\n` +
    `└─────────────────────────┘` +
    extra +
    `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

function buildRRMessage(t, mult) {
  const short = tradeIsShort(t)
  const tag = coinTag(t)
  const lossP = calcLossPct(t)
  const profPct = fmtStr(lossP * mult)
  const rrPrice = short
    ? fmtStr(
        parseFloat(t.entry) - ((parseFloat(t.entry) * lossP) / 100) * mult,
        6,
      )
    : fmtStr(
        parseFloat(t.entry) + ((parseFloat(t.entry) * lossP) / 100) * mult,
        6,
      )
  const emoji = getRREmoji(mult)
  const note = getRRNote(mult)

  return (
    `${emoji} 1:${mult} RR REACHED!\n` +
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}  ${short ? 'SHORT 🔴' : 'LONG 🟢'}\n` +
    `╚══════════════════════════╝\n\n` +
    `📍 Entry          ›  ${t.entry}\n` +
    `⚖️  1:${mult} Level    ›  ~${rrPrice}\n\n` +
    `┌─────────────────────────┐\n` +
    `  📈 Profit   :  +${profPct}%\n` +
    `  ⚖️  R : R    :  1 : ${mult}  ${emoji}\n` +
    `  💰 Risk was :  ${t.riskPct}% of balance\n` +
    `└─────────────────────────┘\n\n` +
    note +
    `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

function buildSLMessage(t) {
  const short = tradeIsShort(t)
  const tag = coinTag(t)
  const lossP = fmtStr(calcLossPct(t))
  const exitP = t.exitPrice ?? t.sl // use actual exit if available

  return (
    `🛑 STOP LOSS HIT\n` +
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}  ${short ? 'SHORT 🔴' : 'LONG 🟢'}\n` +
    `╚══════════════════════════╝\n\n` +
    `📍 Entry   ›  ${t.entry}\n` +
    `🛑 SL Hit  ›  ${exitP}\n\n` +
    `┌─────────────────────────┐\n` +
    `  📉 Loss    :  -${lossP}%\n` +
    `  💰 Risk was :  ${t.riskPct}% of balance\n` +
    `└─────────────────────────┘\n\n` +
    `💪 Losses are part of trading.\n` +
    `   Protect your capital — stay disciplined!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

function buildResultMessage(t) {
  const short = tradeIsShort(t)
  const tag = coinTag(t)
  const isWin = t.status === 'WIN'
  const pnl = fmtStr(t.profit ?? 0)
  const lossP = calcLossPct(t)
  const rr = calcRR(Math.abs(t.profit ?? 0), lossP)
  const rrLabel = getRRLabel(rr)
  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']

  const tpSummary = t.tps
    .map((tp, i) => {
      const hit = (t.hitTPs || []).includes(i)
      const p = fmtStr(Math.abs(calcProfitPct(t, tp)))
      return `  ${hit ? medals[i] : '⬜'} TP ${i + 1}  ›  ${tp}  (+${p}%)  ${hit ? '✔ HIT' : '— missed'}`
    })
    .join('\n')

  const header = isWin ? `🏆 TRADE CLOSED — WIN!\n` : `🛑 TRADE CLOSED — LOSS\n`
  const pnlLine = isWin
    ? `  📈 Profit   :  +${pnl}%`
    : `  📉 Loss     :  ${pnl}%`
  const motive = isWin
    ? `🎉 Excellent execution — discipline pays!`
    : `💪 Losses are part of trading.\n   Protect capital. Next trade!`

  return (
    header +
    `╔══════════════════════════╗\n` +
    `  🀄  ${tag}  ${short ? 'SHORT 🔴' : 'LONG 🟢'}\n` +
    `╚══════════════════════════╝\n\n` +
    `📍 Entry    ›  ${t.entry}\n` +
    `🏁 Exit     ›  ${t.exitPrice}\n\n` +
    `📊 TP Results:\n${tpSummary}\n` +
    `  🛑 SL      ›  ${t.sl}\n\n` +
    `┌─────────────────────────┐\n` +
    `${pnlLine}\n` +
    `  ⚖️  R : R   :  ${rrLabel}\n` +
    `  💰 Risk was :  ${t.riskPct}% of balance\n` +
    `  🤖 Trigger  :  ${t.autoTriggered ? 'Auto ⚡' : 'Manual 🖐'}\n` +
    `└─────────────────────────┘\n\n` +
    motive +
    `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪷 Patient  ·  🌸 Discipline\n` +
    `💸 Master Analysts VIP (crypto) 🔐`
  )
}

// ── POPUP ───────────────────────────────────────────────────
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

// Message router — returns { title, msg } for any message type
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

// ── OUTPUT PANEL ────────────────────────────────────────────
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

// ── SIGNAL GENERATOR ────────────────────────────────────────
function executeSignal() {
  const coin = document.getElementById('coin').value.trim()
  const side = document.getElementById('side').value
  const orderType = document.getElementById('order-type').value
  const entry = parseFloat(document.getElementById('entry').value)
  const be = document.getElementById('be').value.trim()
  const sl = parseFloat(document.getElementById('sl').value)
  const note = document.getElementById('note').value.trim()
  const leverage =
    document.getElementById('leverage').value.trim() || '10x or Max'
  const riskPct = document.getElementById('risk-pct').value || '1'
  const tps = getTPValues()
  const short = side.includes('Short')

  // Validation
  if (!coin) return toast('❌ Asset name required', 'error')
  if (!Number.isFinite(entry) || entry <= 0)
    return toast('❌ Valid entry price required', 'error')
  if (!Number.isFinite(sl) || sl <= 0)
    return toast('❌ Valid stop loss required', 'error')
  if (tps.length === 0) return toast('❌ At least one TP required', 'error')

  // FIX: TP direction validation with correct local variable
  const badTP = tps.some((tp) => (short ? tp >= entry : tp <= entry))
  if (badTP)
    return toast('❌ TP must be beyond entry in the trade direction', 'error')

  // SL direction check
  const badSL = short ? sl <= entry : sl >= entry
  if (badSL) return toast('❌ SL must be on the loss side of entry', 'error')

  const trade = {
    id: Date.now(),
    date: new Date().toISOString(),
    coin: coin.toUpperCase(),
    side,
    orderType,
    entry,
    tps,
    tp: tps[0], // convenience shortcut to first TP
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
    hitRRs: [], // which whole-number R:R milestones have been crossed
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
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  document.querySelectorAll('.tp-row').forEach((row, i) => {
    if (i === 0) {
      const inp = row.querySelector('input')
      if (inp) inp.value = ''
    } else {
      row.remove()
    }
  })
  tpCount = 1
  document
    .querySelectorAll('.coin-pill')
    .forEach((p) => p.classList.remove('active'))
  const pr = document.getElementById('risk-preview')
  if (pr) pr.style.display = 'none'
}

// ── PRICE MONITOR ───────────────────────────────────────────
function startPriceMonitor() {
  if (priceMonitorInterval) clearInterval(priceMonitorInterval)
  priceMonitorInterval = setInterval(checkOpenTrades, 5000)
  checkOpenTrades()
  setMonitorBadge(true)
}

function setMonitorBadge(on) {
  const el = document.getElementById('monitor-status')
  if (!el) return
  el.textContent = on ? '● Monitor' : '○ Monitor'
  el.className = on ? 'sf-item monitor-on' : 'sf-item monitor-off'
}

async function checkOpenTrades() {
  const open = trades.filter((t) => t.status === 'OPEN')
  if (!open.length) {
    setMonitorBadge(false)
    return
  }

  const syms = [...new Set(open.map((t) => toBinanceSym(t.coin)))]

  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(syms)}`
    const data = await fetch(url).then((r) => r.json())

    if (Array.isArray(data)) {
      data.forEach((d) => {
        liveprices[d.symbol] = parseFloat(d.price)
      })
    } else if (data.symbol) {
      liveprices[data.symbol] = parseFloat(data.price)
    }

    let changed = false

    open.forEach((trade) => {
      if (trade.status !== 'OPEN') return

      const price = liveprices[toBinanceSym(trade.coin)]
      if (!price || !Number.isFinite(price)) return

      const short = tradeIsShort(trade)
      const lossP = calcLossPct(trade)

      // ── SL: triggers if price reaches OR passes through SL ──
      const slHit = short ? price >= trade.sl : price <= trade.sl
      if (slHit) {
        autoClose(trade, 'LOSS', price)
        changed = true
        return
      }

      // ── R:R MILESTONE MONITOR ──
      // Track every whole-number R:R the price has crossed while OPEN.
      // If a new milestone is reached, notify. Never notify same milestone twice.
      if (!trade.hitRRs) trade.hitRRs = []
      const currentRR = calcRR(Math.abs(calcProfitPct(trade, price)), lossP)

      if (currentRR > 0) {
        // Find the highest whole-number milestone price has crossed
        const maxMilestone = Math.floor(currentRR)
        for (let n = 1; n <= maxMilestone; n++) {
          if (!trade.hitRRs.includes(n)) {
            trade.hitRRs.push(n)
            changed = true
            // Show RR milestone notification (softer toast — not a full output swap)
            toast(
              `⚖️ ${trade.coin} reached 1:${n} RR @ ${price.toLocaleString()}!`,
              'info',
              5000,
            )
          }
        }
      }

      // ── TP checks: triggers if price reaches OR passes through TP ──
      trade.tps.forEach((tp, i) => {
        if ((trade.hitTPs || []).includes(i)) return
        if (trade.status !== 'OPEN') return

        const tpHit = short ? price <= tp : price >= tp
        if (!tpHit) return

        if (!trade.hitTPs) trade.hitTPs = []
        if (!trade.tpMessages) trade.tpMessages = {}

        trade.hitTPs.push(i)
        trade.tpMessages[i] = buildTPHitMessage(trade, i, price)
        changed = true

        showOutput(trade.tpMessages[i], `🎯 TP${i + 1} Hit — Copy to Telegram`)
        toast(
          `🎯 ${trade.coin} TP${i + 1} hit @ ${price.toLocaleString()}!`,
          'success',
          6000,
        )

        if (trade.hitTPs.length === trade.tps.length) {
          autoClose(trade, 'WIN', price)
        }
      })

      updateLiveBadge(trade.id, price)
    })

    if (changed) {
      saveTrades()
      renderHistory()
      updateStats()
      updateOpenBadge()
    }
    setMonitorBadge(true)
  } catch (e) {
    console.warn('Price monitor error:', e)
    setMonitorBadge(false)
  }
}

function autoClose(trade, status, exitPrice) {
  // FIX: strict guard — only close OPEN trades, prevents double-close
  if (trade.status !== 'OPEN') return

  const short = tradeIsShort(trade)
  trade.status = status
  trade.exitDate = new Date().toISOString()
  trade.exitPrice = exitPrice
  trade.autoTriggered = true

  const raw = short
    ? ((parseFloat(trade.entry) - exitPrice) / parseFloat(trade.entry)) * 100
    : ((exitPrice - parseFloat(trade.entry)) / parseFloat(trade.entry)) * 100
  trade.profit = fmtNum(raw)

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

// ── MANUAL CLOSE ────────────────────────────────────────────
function updateTradeStatus(id, status) {
  const trade = trades.find((t) => t.id === id)
  if (!trade || trade.status !== 'OPEN') return

  // FIX: use tps[0] (first TP) as WIN default, not trade.tp
  const defaultExit = status === 'WIN' ? (trade.tps?.[0] ?? trade.tp) : trade.sl
  const raw = prompt(
    `Exit price for P&L (press Enter for ${defaultExit}):`,
    defaultExit,
  )
  if (raw === null) return // user cancelled

  const exit = parseFloat(raw)
  const exitP = Number.isFinite(exit) && exit > 0 ? exit : defaultExit
  const short = tradeIsShort(trade)

  trade.status = status
  trade.exitDate = new Date().toISOString()
  trade.exitPrice = exitP
  trade.autoTriggered = false

  const profitRaw = short
    ? ((parseFloat(trade.entry) - exitP) / parseFloat(trade.entry)) * 100
    : ((exitP - parseFloat(trade.entry)) / parseFloat(trade.entry)) * 100
  trade.profit = fmtNum(profitRaw)

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

// ── HISTORY RENDER ──────────────────────────────────────────
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
    log.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>${!trades.length ? 'No trades yet. Generate your first signal!' : 'No trades match this filter.'}</p>
      </div>`
    return
  }

  log.innerHTML = filtered
    .map((trade) => {
      const short = tradeIsShort(trade)
      const sideClass = short ? 'badge-short' : 'badge-long'
      const stClass = {
        WIN: 'badge-win',
        LOSS: 'badge-loss',
        OPEN: 'badge-open',
      }[trade.status]
      const itemClass = `status-${trade.status.toLowerCase()}`
      const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']

      const liveBadge =
        trade.status === 'OPEN'
          ? `<span class="live-badge" id="live-${trade.id}">● Live</span>`
          : ''
      const autoBadge = trade.autoTriggered
        ? `<span class="badge badge-auto">⚡ AUTO</span>`
        : ''

      // TP status table
      const tpRows = (trade.tps || [trade.tp])
        .map((tp, i) => {
          const hit = (trade.hitTPs || []).includes(i)
          const profPc = fmtStr(Math.abs(calcProfitPct(trade, tp)))
          const lossP = calcLossPct(trade)
          const rr = calcRR(profPc, lossP)
          const rrLbl = getRRLabel(rr)
          return `
        <div class="tp-status-row ${hit ? 'hit' : ''}">
          <span class="tps-medal">${hit ? medals[i] : '⬜'}</span>
          <span class="tps-label">TP ${i + 1}</span>
          <span class="tps-price">${tp}</span>
          <span class="tps-pct">+${profPc}%</span>
          <span class="tps-rr">${rrLbl}</span>
          <span class="tps-state ${hit ? 'tps-hit-badge' : 'tps-open-badge'}">${hit ? '✔ HIT' : 'OPEN'}</span>
        </div>`
        })
        .join('')

      // P&L result bar (closed trades only)
      let pnlHtml = ''
      if (trade.profit !== null) {
        const lossP = calcLossPct(trade)
        const rr = calcRR(Math.abs(trade.profit), lossP)
        const rrLbl = getRRLabel(rr)
        const rrEmoj = getRREmoji(rr)
        pnlHtml = `
        <div class="trade-result-bar ${trade.status === 'WIN' ? 'win-bar' : 'loss-bar'}">
          <div class="result-main">
            <span class="pnl-val ${trade.profit >= 0 ? 'pos' : 'neg'}">${trade.profit >= 0 ? '+' : ''}${trade.profit}%</span>
            <span class="rr-pill">${rrEmoj} ${rrLbl}</span>
            ${trade.autoTriggered ? '<span class="auto-pill">⚡ AUTO</span>' : ''}
          </div>
          <div class="result-sub">
            Exit: <strong>${trade.exitPrice}</strong>
            &nbsp;·&nbsp; ${new Date(trade.exitDate).toLocaleString()}
          </div>
        </div>`
      }

      // Action buttons
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

      // ── SMART MESSAGE PANEL ──
      // Only shows buttons relevant to what has happened / what can happen.
      // R:R milestones are computed from the trade's actual TPs — not hardcoded.
      const msgBtns = []

      if (trade.status === 'OPEN') {
        // Original signal — always first
        msgBtns.push({ type: 'signal', label: '📊 Signal', cls: 'signal-btn' })

        // R:R milestones: dynamically computed from entry/sl/tps
        // e.g. if furthest TP gives 1:4.7 RR → show 1:1, 1:2, 1:3, 1:4
        const milestones = getTradeRRMilestones(trade)
        milestones.forEach((n) => {
          const alreadyHit = (trade.hitRRs || []).includes(n)
          msgBtns.push({
            type: 'rr',
            label: `${alreadyHit ? '✅' : '⚖️'} 1:${n} RR`,
            cls: alreadyHit ? 'rr-btn rr-hit' : 'rr-btn',
            extra: n,
          })
        })

        // TPs that have already been hit
        ;(trade.hitTPs || []).forEach((i) =>
          msgBtns.push({
            type: 'tp',
            label: `🎯 TP${i + 1}`,
            cls: 'tp-msg-btn',
            extra: i,
          }),
        )
      } else if (trade.status === 'WIN') {
        // After WIN: signal + hit TP messages + final result — NO SL, NO R:R
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
        // After LOSS: signal + SL message + final result — NO TPs, NO R:R
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
                `<button class="msg-btn ${b.cls}" onclick="openMsgPopup(${trade.id},'${b.type}',${b.extra ?? 'null'})">${b.label}</button>`,
            )
            .join('')}
        </div>
      </div>`

      return `
      <div class="trade-item ${itemClass}">
        <div class="trade-header">
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
          <div class="price-item"><span class="price-label">Stop Loss</span><span class="price-val sl-v">${trade.sl}</span></div>
          <div class="price-item"><span class="price-label">Break Even</span><span class="price-val">${trade.be}</span></div>
          <div class="price-item"><span class="price-label">Risk</span><span class="price-val">${trade.riskPct}%</span></div>
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

// ── STATISTICS ──────────────────────────────────────────────
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

  // FIX: guard against empty data before creating chart
  if (!months.length) {
    if (chart) {
      chart.destroy()
      chart = null
    }
    return
  }

  if (chart) chart.destroy()

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Wins',
          data: months.map((m) => md[m].w),
          backgroundColor: 'rgba(31,212,160,.7)',
          borderRadius: 6,
        },
        {
          label: 'Losses',
          data: months.map((m) => md[m].l),
          backgroundColor: 'rgba(244,63,94,.7)',
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
            color: '#6880a4',
            font: { family: 'Space Grotesk', size: 12 },
          },
        },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { ticks: { color: '#6880a4' }, grid: { color: '#1c2d44' } },
        y: {
          ticks: { color: '#6880a4', stepSize: 1 },
          grid: { color: '#1c2d44' },
          beginAtZero: true,
        },
      },
    },
  })
}

// ── EXPORT / IMPORT ─────────────────────────────────────────
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
        if (!Array.isArray(d)) throw new Error('Not an array')
        trades = d
        saveTrades()
        renderHistory()
        updateStats()
        updateOpenBadge()
        toast(
          `✅ Imported ${d.length} trade${d.length !== 1 ? 's' : ''}!`,
          'success',
        )
      } catch (err) {
        toast('❌ Invalid file format', 'error')
      }
    }
    r.readAsText(e.target.files[0])
  }
  inp.click()
}

function downloadCSV() {
  const headers = [
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
    const lossP = calcLossPct(t)
    const rr =
      t.profit != null ? getRRLabel(calcRR(Math.abs(t.profit), lossP)) : ''
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
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${c}"`).join(','))
    .join('\n')
  dlBlob(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
    `mavip_report_${today()}.csv`,
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
  updateOpenBadge()
  const oa = document.getElementById('output-area')
  if (oa) oa.style.display = 'none'
  toast('🗑 Database wiped', 'info')
}

// ── MARKET TICKER ───────────────────────────────────────────
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
        const arrow = parseFloat(change) >= 0 ? '▲' : '▼'
        return `${c.symbol.replace('USDT', '')} $${price} ${arrow} ${change}%`
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
    if (el) el.textContent = '⚠ Market data unavailable — check connection'
    const st = document.getElementById('sidebar-status')
    if (st) {
      st.textContent = 'OFFLINE'
      st.style.color = 'var(--loss)'
    }
  }
}

// ── COIN SUGGESTIONS ────────────────────────────────────────
function loadCoinSuggestions() {
  const dl = document.getElementById('coin-suggestions')
  if (dl) dl.innerHTML = COINS.map((c) => `<option value="${c}">`).join('')
}

function filterQuickSearch() {
  const term = document.getElementById('search-coin').value.toLowerCase().trim()
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

// ── CLOCKS ──────────────────────────────────────────────────
function updateClocks() {
  const now = new Date()
  const fmtTZ = (tz) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now)

  const set = (id, v) => {
    const el = document.getElementById(id)
    if (el) el.textContent = v
  }
  set('time-ny', fmtTZ('America/New_York'))
  set('time-london', fmtTZ('Europe/London'))
  set('time-sl', fmtTZ('Asia/Colombo'))

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

// ── KZ SCHEDULE (local time conversion) ─────────────────────
function populateKZSchedule() {
  // FIX: correct date construction — use UTC hours properly
  KZ_SESSIONS.forEach((s) => {
    const el = document.getElementById(`sch-${s.id}-local`)
    if (!el) return

    // Create a date at today's date but at the session's UTC start hour
    const now = new Date()
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        Math.floor(s.startUTC),
        Math.round((s.startUTC % 1) * 60),
        0,
        0,
      ),
    )

    const local = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)

    el.textContent = local + ' LKT'
  })
}

// ── KZ TRACKER ──────────────────────────────────────────────
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
    document
      .getElementById(`sch-${s.id}`)
      ?.classList.toggle('active-session', active?.sess.id === s.id)
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

    // Find next upcoming session
    let next = null
    let minWait = Infinity
    for (const s of KZ_SESSIONS) {
      const wait =
        utcH < s.startUTC ? s.startUTC - utcH : 24 - utcH + s.startUTC
      if (wait < minWait) {
        minWait = wait
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
      barEl.style.backgroundColor = '#38506e'
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
