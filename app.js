// ═══════════════════════════════════════════════════════════
// CRYPTOSIGNAL PRO v3.1 - Complete Trading Terminal
// FIXED: All bugs resolved, all features implemented
// ═══════════════════════════════════════════════════════════

const state = {
  trades: JSON.parse(localStorage.getItem('csp_trades_v3') || '[]'),
  currentTPs: 1,
  prices: {},
  chart: null,
}

const KZ_SESSIONS = [
  {
    id: 'asia',
    name: 'ASIA KZ',
    startUTC: 1,
    endUTC: 3,
    icon: '🌏',
    color: '#8b5cf6',
    region: 'asia',
    cities: ['Tokyo', 'Sydney', 'Singapore'],
  },
  {
    id: 'london',
    name: 'LONDON KZ',
    startUTC: 7,
    endUTC: 10,
    icon: '🔥',
    color: '#f97316',
    region: 'europe',
    cities: ['London', 'Frankfurt', 'Paris'],
  },
  {
    id: 'ny',
    name: 'NEW YORK KZ',
    startUTC: 12,
    endUTC: 15,
    icon: '⚡',
    color: '#ef4444',
    region: 'americas',
    cities: ['New York', 'Chicago', 'Toronto'],
  },
  {
    id: 'close',
    name: 'LONDON CLOSE',
    startUTC: 15,
    endUTC: 17,
    icon: '🎯',
    color: '#f59e0b',
    region: 'europe',
    cities: ['London'],
  },
]

const COINS = [
  { symbol: 'BTC/USDT.P', name: 'Bitcoin', icon: '₿', color: '#f7931a' },
  { symbol: 'ETH/USDT.P', name: 'Ethereum', icon: 'Ξ', color: '#627eea' },
  { symbol: 'SOL/USDT.P', name: 'Solana', icon: '◎', color: '#00ffa3' },
  { symbol: 'BNB/USDT.P', name: 'BNB', icon: 'B', color: '#f3ba2f' },
  { symbol: 'XRP/USDT.P', name: 'Ripple', icon: 'X', color: '#23292f' },
  { symbol: 'ADA/USDT.P', name: 'Cardano', icon: 'A', color: '#0033ad' },
  { symbol: 'DOGE/USDT.P', name: 'Dogecoin', icon: 'D', color: '#c2a633' },
  { symbol: 'AVAX/USDT.P', name: 'Avalanche', icon: 'A', color: '#e84142' },
  { symbol: 'LINK/USDT.P', name: 'Chainlink', icon: 'L', color: '#2a5ada' },
  { symbol: 'DOT/USDT.P', name: 'Polkadot', icon: 'P', color: '#e6007a' },
  { symbol: 'MATIC/USDT.P', name: 'Polygon', icon: 'M', color: '#8247e5' },
  { symbol: 'NEAR/USDT.P', name: 'NEAR', icon: 'N', color: '#00c08b' },
]

// ── helpers ──
const $ = (id) => document.getElementById(id)
const setEl = (id, val) => {
  const e = $(id)
  if (e) e.textContent = val
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  initCoinGrid()
  initCoinSuggestions()
  initKillZones()
  initWorldMap()
  loadMarketData()
  loadFearGreed()
  renderHistory()
  updateAnalytics()
  updateQuickStats()

  // FIX: set correct nav active state based on URL hash
  const hash = window.location.hash.replace('#', '')
  if (hash) {
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${hash}`)
    })
  }

  setInterval(loadMarketData, 30000)
  setInterval(loadFearGreed, 300000)
  setInterval(updateKillZones, 1000)
  setInterval(updateWorldMap, 1000)
  startPriceMonitor()
  ;['entry-price', 'stop-loss', 'side-select'].forEach((id) => {
    $(id)?.addEventListener('input', calculateRisk)
  })
  $('tp-container')?.addEventListener('input', calculateRisk)

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const sig = $('signals')
      if (sig && isInViewport(sig)) {
        e.preventDefault()
        generateSignal()
      }
    }
    if (e.key === 'Escape') closeModal()
  })
})

// ─── FEAR & GREED ───
async function loadFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    const data = await res.json()
    if (data?.data?.[0]) {
      const { value, value_classification } = data.data[0]
      const el = $('hero-fear')
      if (el) {
        el.textContent = `${value} (${value_classification})`
        el.style.color =
          value < 30 ? '#ef4444' : value > 60 ? '#00d4aa' : '#f59e0b'
      }
    }
  } catch {
    setEl('hero-fear', 'N/A')
  }
}

// ─── WORLD MAP ───
function initWorldMap() {
  updateWorldMap()
}

function updateWorldMap() {
  const now = new Date()
  const utcH =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  const mapUtcEl = $('map-utc')
  if (mapUtcEl) mapUtcEl.textContent = `UTC: ${now.toISOString().substr(11, 8)}`

  let activeSession = null,
    nextSession = null,
    minWait = Infinity

  KZ_SESSIONS.forEach((session) => {
    const isActive = utcH >= session.startUTC && utcH < session.endUTC
    const regionEl = $(`region-${session.region}`)
    const statusEl = $(`status-${session.region}`)
    const timeEl = $(`time-${session.region}`)

    if (timeEl) timeEl.textContent = getRegionTime(session.region)

    if (isActive) {
      activeSession = session
      regionEl?.classList.add('active')
      if (statusEl) {
        statusEl.textContent = 'ACTIVE'
        statusEl.style.color = 'var(--accent)'
      }
      if (session.region === 'europe') {
        $('line-asia-europe')?.classList.add('active')
        $('line-europe-americas')?.classList.add('active')
      }
    } else {
      regionEl?.classList.remove('active')
      if (statusEl) {
        statusEl.textContent = 'Closed'
        statusEl.style.color = 'var(--text-muted)'
      }
      let wait = session.startUTC - utcH
      if (wait < 0) wait += 24
      if (wait < minWait) {
        minWait = wait
        nextSession = session
      }
    }
  })

  const banner = $('active-session-banner')
  const iconEl = $('session-icon')
  const nameEl = $('session-name')
  const countdownEl = $('session-countdown')
  const timelinePrg = $('timeline-progress')

  if (activeSession) {
    banner?.classList.remove('inactive')
    if (iconEl) iconEl.textContent = activeSession.icon
    if (nameEl) {
      nameEl.textContent = `${activeSession.name} ACTIVE`
      nameEl.style.color = activeSession.color
    }
    const progress =
      ((utcH - activeSession.startUTC) /
        (activeSession.endUTC - activeSession.startUTC)) *
      100
    const remaining = (activeSession.endUTC - utcH) * 3600
    if (countdownEl) countdownEl.textContent = formatDuration(remaining)
    if (timelinePrg) timelinePrg.style.width = `${Math.min(progress, 100)}%`
  } else {
    banner?.classList.add('inactive')
    if (iconEl) iconEl.textContent = '⏰'
    if (nameEl) {
      nameEl.textContent = nextSession
        ? `Next: ${nextSession.name}`
        : 'No Session'
      nameEl.style.color = 'var(--text-muted)'
    }
    if (countdownEl && nextSession)
      countdownEl.textContent = `in ${formatDuration(minWait * 3600)}`
    if (timelinePrg) timelinePrg.style.width = '0%'
  }
}

// FIX: London = UTC+0 winter, UTC+1 BST summer. New York DST properly handled.
function getRegionTime(region) {
  const now = new Date()
  let offset = 0
  switch (region) {
    case 'asia':
      offset = 9
      break
    case 'europe': {
      const y = now.getUTCFullYear()
      const lastMarSun = new Date(Date.UTC(y, 2, 31))
      lastMarSun.setUTCDate(31 - lastMarSun.getUTCDay())
      const lastOctSun = new Date(Date.UTC(y, 9, 31))
      lastOctSun.setUTCDate(31 - lastOctSun.getUTCDay())
      offset = now >= lastMarSun && now < lastOctSun ? 1 : 0
      break
    }
    case 'americas':
      offset = isDST_NY(now) ? -4 : -5
      break
  }
  return new Date(now.getTime() + offset * 3600000).toISOString().substr(11, 5)
}

function isDST_NY(date) {
  const y = date.getUTCFullYear()
  const secondSunMar = new Date(Date.UTC(y, 2, 1))
  secondSunMar.setUTCDate(1 + ((7 - secondSunMar.getUTCDay()) % 7) + 7)
  const firstSunNov = new Date(Date.UTC(y, 10, 1))
  firstSunNov.setUTCDate(1 + ((7 - firstSunNov.getUTCDay()) % 7))
  return date >= secondSunMar && date < firstSunNov
}

// ─── KILL ZONES ───
function initKillZones() {
  updateKillZones()
  KZ_SESSIONS.forEach((s) => {
    const el = $(`local-${s.id}`)
    if (el) el.textContent = `${formatLocalTime(s.startUTC)} Local`
  })
}

function updateKillZones() {
  const now = new Date()
  const utcH =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  let active = null
  for (const s of KZ_SESSIONS) {
    if (utcH >= s.startUTC && utcH < s.endUTC) {
      active = {
        session: s,
        progress: ((utcH - s.startUTC) / (s.endUTC - s.startUTC)) * 100,
        remaining: (s.endUTC - utcH) * 3600,
      }
      break
    }
  }
  KZ_SESSIONS.forEach((s) => {
    const isActive = active && active.session.id === s.id
    $(`kz-card-${s.id}`)?.classList.toggle('active', isActive)
    const status = $(`status-${s.id}-detail`)
    if (status) {
      status.textContent = isActive ? '🔥 ACTIVE NOW' : 'Inactive'
      status.classList.toggle('active', isActive)
    }
  })
  updateClocks()
}

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

  setEl('time-ny-detail', fmt('America/New_York'))
  setEl('time-london-detail', fmt('Europe/London'))
  setEl('time-utc-detail', fmt('UTC'))
  setEl('time-local-detail', now.toLocaleTimeString('en-GB'))
  setEl('time-ny', fmt('America/New_York'))
  setEl('time-london', fmt('Europe/London'))
  setEl('time-utc', fmt('UTC'))
  setEl('time-local', now.toLocaleTimeString('en-GB'))

  const utcH = now.getUTCHours()
  $('clock-ny')?.classList.toggle(
    'active',
    KZ_SESSIONS.filter((s) => s.id === 'ny' || s.id === 'close').some(
      (s) => utcH >= s.startUTC && utcH < s.endUTC,
    ),
  )
  $('clock-london')?.classList.toggle(
    'active',
    KZ_SESSIONS.filter((s) => ['london', 'ny', 'close'].includes(s.id)).some(
      (s) => utcH >= s.startUTC && utcH < s.endUTC,
    ),
  )
}

function formatLocalTime(utcHour) {
  const d = new Date()
  d.setUTCHours(Math.floor(utcHour), (utcHour % 1) * 60, 0, 0)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = Math.floor(seconds % 60)
  if (h > 0)
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

// ─── COIN GRID ───
function initCoinGrid() {
  const grid = $('coin-grid')
  if (!grid) return
  grid.innerHTML = COINS.slice(0, 8)
    .map(
      (c) =>
        `<button class="coin-btn" onclick="selectCoin('${c.symbol}')" data-symbol="${c.symbol}">${c.icon} ${c.symbol.split('/')[0]}</button>`,
    )
    .join('')
}

function initCoinSuggestions() {
  const dl = $('coin-list')
  if (!dl) return
  dl.innerHTML = COINS.map(
    (c) => `<option value="${c.symbol}">${c.name}</option>`,
  ).join('')
}

function selectCoin(symbol) {
  $('coin-input').value = symbol
  document
    .querySelectorAll('.coin-btn')
    .forEach((btn) =>
      btn.classList.toggle('active', btn.dataset.symbol === symbol),
    )
  fetchPrice(symbol).then((price) => {
    if (price) {
      $('entry-price').value = price.toFixed(price < 10 ? 4 : 2)
      calculateRisk()
    }
  })
}

// ─── TPs ───
function addTP() {
  if (state.currentTPs >= 6) {
    showToast('Maximum 6 TPs allowed', 'info')
    return
  }
  state.currentTPs++
  const row = document.createElement('div')
  row.className = 'tp-row'
  row.innerHTML = `<span class="tp-num">TP${state.currentTPs}</span><input type="number" class="tp-input" placeholder="0.00000" step="any"><button class="tp-remove" onclick="removeTP(this)"><i class="fas fa-times"></i></button>`
  $('tp-container').appendChild(row)
  calculateRisk()
}

function removeTP(btn) {
  if (state.currentTPs <= 1) return
  btn.closest('.tp-row').remove()
  state.currentTPs--
  document.querySelectorAll('.tp-row').forEach((r, i) => {
    r.querySelector('.tp-num').textContent = `TP${i + 1}`
  })
  calculateRisk()
}

function getTPValues() {
  return Array.from(document.querySelectorAll('.tp-input'))
    .map((i) => parseFloat(i.value))
    .filter((v) => !isNaN(v) && v > 0)
}

// ─── RISK CALC ───
function calculateRisk() {
  const entry = parseFloat($('entry-price')?.value)
  const sl = parseFloat($('stop-loss')?.value)
  const side = $('side-select')?.value
  const tps = getTPValues()
  const card = $('risk-card')
  if (!entry || !sl || !side || !tps.length) {
    if (card) card.style.display = 'none'
    return
  }

  const isShort = side === 'short'
  if (
    isShort ? sl <= entry || tps[0] >= entry : sl >= entry || tps[0] <= entry
  ) {
    if (card) card.style.display = 'none'
    return
  }

  const lossPct = isShort
    ? ((sl - entry) / entry) * 100
    : ((entry - sl) / entry) * 100
  const profitPct = isShort
    ? ((entry - tps[0]) / entry) * 100
    : ((tps[0] - entry) / entry) * 100
  const rr = profitPct / lossPct

  setEl('preview-rr', `1:${rr.toFixed(2)}`)
  setEl('preview-profit', `+${profitPct.toFixed(2)}%`)
  setEl('preview-loss', `-${lossPct.toFixed(2)}%`)
  $('risk-progress').style.width = `${Math.min((lossPct / 2) * 100, 100)}%`
  if (card) card.style.display = 'block'
}

// ─── SIGNAL GENERATION ───
function generateSignal() {
  const coin = $('coin-input').value.trim()
  const side = $('side-select').value
  const orderType = $('order-type').value
  const entry = parseFloat($('entry-price').value)
  const sl = parseFloat($('stop-loss').value)
  const be = $('break-even').value
  const leverage = $('leverage').value || '10x'
  const riskPct = $('risk-pct').value || '1'
  const note = $('signal-note').value
  const manual = $('manual-mode').checked
  const tps = getTPValues()

  if (!coin) return showToast('Please enter a trading pair', 'error')
  if (!entry || entry <= 0)
    return showToast('Valid entry price required', 'error')
  if (!sl || sl <= 0) return showToast('Valid stop loss required', 'error')
  if (!tps.length) return showToast('At least one TP required', 'error')

  const isShort = side === 'short'
  if (isShort) {
    if (sl <= entry)
      return showToast('For SHORT: SL must be above entry', 'error')
    if (tps.some((tp) => tp >= entry))
      return showToast('For SHORT: TPs must be below entry', 'error')
  } else {
    if (sl >= entry)
      return showToast('For LONG: SL must be below entry', 'error')
    if (tps.some((tp) => tp <= entry))
      return showToast('For LONG: TPs must be above entry', 'error')
  }
  for (let i = 1; i < tps.length; i++) {
    if (isShort && tps[i] >= tps[i - 1])
      return showToast(
        `TP${i + 1} must be lower than TP${i} for SHORT`,
        'error',
      )
    if (!isShort && tps[i] <= tps[i - 1])
      return showToast(
        `TP${i + 1} must be higher than TP${i} for LONG`,
        'error',
      )
  }

  const trade = {
    id: Date.now(),
    date: new Date().toISOString(),
    coin: coin.toUpperCase(),
    side: isShort ? 'SHORT' : 'LONG',
    orderType: orderType === 'limit' ? 'Limit Order' : 'Market Order',
    entry,
    tps,
    sl,
    be: be || 'None',
    leverage,
    riskPct,
    note,
    manualMode: manual,
    status: 'OPEN',
    exitPrice: null,
    exitDate: null,
    profit: null,
    hitTPs: [],
    tpMessages: {},
    hitRRs: [],
    autoTriggered: false,
    resultMessage: null,
  }

  state.trades.unshift(trade)
  saveTrades()
  $('signal-output').value = buildOpenMessage(trade)
  $('output-card').style.display = 'block'
  resetForm()
  renderHistory()
  updateAnalytics()
  updateQuickStats()
  showToast(
    manual ? 'Signal saved (Manual Mode)' : 'Signal saved & monitoring!',
    'success',
  )
}

// FIX: resetForm — no infinite loop, clean and safe
function resetForm() {
  ;['entry-price', 'stop-loss', 'break-even', 'signal-note'].forEach((id) => {
    const e = $(id)
    if (e) e.value = ''
  })
  const manEl = $('manual-mode')
  if (manEl) manEl.checked = false
  const container = $('tp-container')
  container.querySelectorAll('.tp-row').forEach((row, idx) => {
    if (idx === 0) row.querySelector('.tp-input').value = ''
    else row.remove()
  })
  state.currentTPs = 1
  const card = $('risk-card')
  if (card) card.style.display = 'none'
}

function saveTrades() {
  localStorage.setItem('csp_trades_v3', JSON.stringify(state.trades))
}

// ─── RISK LEVEL HELPER ───
function getRiskLevel(t) {
  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100)
  const riskNum = parseFloat(t.riskPct) || 1
  if (lossPct > 3 || riskNum >= 3) return 'High  Risky'
  if (lossPct > 1.5 || riskNum >= 2) return 'Medium Risk'
  return 'Low Risk'
}

function fmtPrice(price) {
  // Smart decimal formatting
  if (price >= 1000) return price.toFixed(1)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

function getRR(t) {
  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100)
  const tp1Pct = Math.abs(((t.tps[0] - t.entry) / t.entry) * 100)
  return lossPct > 0 ? (tp1Pct / lossPct).toFixed(1) : '0'
}

// ─── MESSAGE BUILDERS (Clean Telegram Format) ───

function buildOpenMessage(t) {
  const isShort = t.side === 'SHORT'
  const dirEmoji = isShort ? '🟥' : '🟩'
  const dirText = isShort ? 'SELL' : 'BUY'
  const riskLevel = getRiskLevel(t)
  const riskLine = riskLevel !== 'Low Risk' ? ` | ${riskLevel}` : ''

  // Header line
  let msg = `${dirEmoji} ${t.coin} | ${dirText}${riskLine}\n`

  // SL line
  msg += `SL ${fmtPrice(t.sl)}\n`

  // TP lines
  t.tps.forEach((tp, i) => {
    msg += `TP${t.tps.length > 1 ? i + 1 : ''} ${fmtPrice(tp)}\n`
  })

  // BE line if set
  if (t.be && t.be !== 'None') {
    msg += `BE ${fmtPrice(parseFloat(t.be))}\n`
  }

  // RR line
  msg += `\nRR 1:${getRR(t)}`

  // Note if any
  if (t.note) msg += `\n\n💬 ${t.note}`

  // Manual mode note
  if (t.manualMode) msg += `\n📝 Limit Order — monitor manually`

  return msg
}

function buildTPHitMessage(t, idx, hitPrice) {
  const isShort = t.side === 'SHORT'
  const dirEmoji = isShort ? '🟥' : '🟩'
  const tp = t.tps[idx]
  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100)
  const profPct = Math.abs(((tp - t.entry) / t.entry) * 100)
  const rr = lossPct > 0 ? (profPct / lossPct).toFixed(1) : '0'
  const isLast = idx === t.tps.length - 1

  let msg = `🎯 TP${idx + 1} HIT!\n\n`
  msg += `${dirEmoji} ${t.coin} | ${isShort ? 'SELL' : 'BUY'}\n`
  msg += `Entry ${fmtPrice(t.entry)}\n`
  msg += `TP${idx + 1} ${fmtPrice(tp)}\n`
  msg += `SL ${fmtPrice(t.sl)}\n`
  msg += `\nRR 1:${rr}`
  if (isLast) {
    msg += `\n\n🎊 All targets reached!`
  } else {
    msg += `\n\n⏳ Move SL to BE — remaining TPs in play`
  }
  return msg
}

function buildBEMessage(t) {
  const isShort = t.side === 'SHORT'
  const dirEmoji = isShort ? '🟥' : '🟩'
  const be = t.be && t.be !== 'None' ? parseFloat(t.be) : t.entry

  let msg = `🔵 MOVE TO BREAK EVEN\n\n`
  msg += `${dirEmoji} ${t.coin} | ${isShort ? 'SELL' : 'BUY'}\n`
  msg += `BE ${fmtPrice(be)}\n`
  msg += `SL → ${fmtPrice(be)} (Break Even)\n`
  msg += `\n✅ Risk-free trade — let it run!`
  return msg
}

function buildRRMessage(t, mult) {
  const isShort = t.side === 'SHORT'
  const dirEmoji = isShort ? '🟥' : '🟩'
  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100)
  const rrPrice = isShort
    ? t.entry - ((t.entry * lossPct) / 100) * mult
    : t.entry + ((t.entry * lossPct) / 100) * mult
  const profPct = (lossPct * mult).toFixed(2)

  const advice =
    mult >= 4
      ? '💎 Exceptional! Secure your profits!'
      : mult >= 3
        ? '🚀 Consider locking profits!'
        : mult >= 2
          ? '🔥 Trade running well!'
          : '✅ Move SL to Break Even!'

  let msg = `⚖️ 1:${mult} RR REACHED\n\n`
  msg += `${dirEmoji} ${t.coin} | ${isShort ? 'SELL' : 'BUY'}\n`
  msg += `Entry ${fmtPrice(t.entry)}\n`
  msg += `1:${mult} Level ~${fmtPrice(rrPrice)}\n`
  msg += `SL ${fmtPrice(t.sl)}\n`
  msg += `\n${advice}`
  return msg
}

function buildSLMessage(t) {
  const isShort = t.side === 'SHORT'
  const dirEmoji = isShort ? '🟥' : '🟩'
  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100).toFixed(2)

  let msg = `🛑 STOP LOSS HIT\n\n`
  msg += `${dirEmoji} ${t.coin} | ${isShort ? 'SELL' : 'BUY'}\n`
  msg += `Entry ${fmtPrice(t.entry)}\n`
  msg += `SL ${fmtPrice(t.exitPrice || t.sl)}\n`
  msg += `\nLoss -${lossPct}%\n`
  msg += `\n💪 Stay disciplined. Next trade!`
  return msg
}

function buildResultMessage(t) {
  const isShort = t.side === 'SHORT'
  const dirEmoji = isShort ? '🟥' : '🟩'
  const isWin = t.status === 'WIN'
  const pnl = t.profit?.toFixed(2) || '0.00'
  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100)
  const rr = t.profit ? (Math.abs(t.profit) / lossPct).toFixed(1) : '0'

  let msg = isWin ? `🏆 TRADE CLOSED — WIN\n\n` : `🛑 TRADE CLOSED — LOSS\n\n`
  msg += `${dirEmoji} ${t.coin} | ${isShort ? 'SELL' : 'BUY'}\n`
  msg += `Entry ${fmtPrice(t.entry)}\n`
  msg += `Exit ${fmtPrice(t.exitPrice)}\n`

  // TP summary
  const hitCount = (t.hitTPs || []).length
  if (t.tps.length > 0) {
    msg += `TPs ${hitCount}/${t.tps.length} Hit\n`
  }

  msg += `SL ${fmtPrice(t.sl)}\n`
  msg += `\n${isWin ? 'Profit' : 'Loss'} ${isWin ? '+' : ''}${pnl}%\n`
  msg += `RR 1:${rr}`
  msg += `\n\n${isWin ? '🎉 Excellent execution!' : '💪 Losses happen. Protect capital.'}`
  return msg
}

// ─── COPY & SHARE ───
function copySignal() {
  const out = $('signal-output')
  if (!out?.value) return
  navigator.clipboard
    .writeText(out.value)
    .then(() => showToast('Signal copied!', 'success'))
    .catch(() => {
      out.select()
      document.execCommand('copy')
      showToast('Signal copied!', 'success')
    })
}

// FIX: Removed empty url= parameter
function shareTelegram() {
  const text = $('signal-output')?.value
  if (!text) return
  window.open(
    `https://t.me/share/url?text=${encodeURIComponent(text)}`,
    '_blank',
  )
}

// ─── PRICE MONITORING ───
function startPriceMonitor() {
  setInterval(checkPrices, 5000)
  checkPrices()
}

async function checkPrices() {
  const openTrades = state.trades.filter(
    (t) => t.status === 'OPEN' && !t.manualMode,
  )
  if (!openTrades.length) return

  const symbols = [...new Set(openTrades.map((t) => toBinanceSymbol(t.coin)))]
  try {
    const data = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(symbols)}`,
    ).then((r) => r.json())
    const prices = {}
    if (Array.isArray(data))
      data.forEach((d) => (prices[d.symbol] = parseFloat(d.price)))

    let changed = false
    openTrades.forEach((trade) => {
      const price = prices[toBinanceSymbol(trade.coin)]
      if (!price) return

      const isShort = trade.side === 'SHORT'
      const slHit = isShort ? price >= trade.sl : price <= trade.sl
      if (slHit) {
        closeTrade(trade, 'LOSS', price)
        changed = true
        return
      }

      // FIX: only count R:R milestones when price is moving in profit direction
      const inProfit = isShort ? price < trade.entry : price > trade.entry
      if (inProfit) {
        const lossPct = Math.abs(((trade.sl - trade.entry) / trade.entry) * 100)
        const currentRR =
          Math.abs(((price - trade.entry) / trade.entry) * 100) / lossPct
        if (!trade.hitRRs) trade.hitRRs = []
        const milestone = Math.floor(currentRR)
        if (
          milestone > 0 &&
          !trade.hitRRs.includes(milestone) &&
          milestone <= 10
        ) {
          trade.hitRRs.push(milestone)
          changed = true
          showToast(`${trade.coin} reached 1:${milestone} RR!`, 'info')
        }
      }

      trade.tps.forEach((tp, idx) => {
        if ((trade.hitTPs || []).includes(idx)) return
        if (!(isShort ? price <= tp : price >= tp)) return
        if (!trade.hitTPs) trade.hitTPs = []
        if (!trade.tpMessages) trade.tpMessages = {}
        trade.hitTPs.push(idx)
        trade.tpMessages[idx] = buildTPHitMessage(trade, idx, price)
        changed = true
        showToast(`🎯 ${trade.coin} TP${idx + 1} hit!`, 'success', 5000)
        if (trade.hitTPs.length === trade.tps.length)
          closeTrade(trade, 'WIN', price)
      })

      const liveEl = $(`live-${trade.id}`)
      if (liveEl)
        liveEl.textContent = `$${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
    })

    if (changed) {
      saveTrades()
      renderHistory()
      updateAnalytics()
      updateQuickStats()
    }
  } catch (err) {
    console.error('Price check error:', err)
  }
}

function closeTrade(trade, status, exitPrice) {
  trade.status = status
  trade.exitDate = new Date().toISOString()
  trade.exitPrice = exitPrice
  trade.autoTriggered = true
  const isShort = trade.side === 'SHORT'
  trade.profit = parseFloat(
    (isShort
      ? ((trade.entry - exitPrice) / trade.entry) * 100
      : ((exitPrice - trade.entry) / trade.entry) * 100
    ).toFixed(2),
  )
  trade.resultMessage = buildResultMessage(trade)
  showToast(
    status === 'WIN'
      ? `🏆 ${trade.coin} WIN! +${trade.profit}%`
      : `🛑 ${trade.coin} SL hit ${trade.profit}%`,
    status === 'WIN' ? 'success' : 'error',
    7000,
  )
}

function toBinanceSymbol(coin) {
  return coin.replace('/USDT.P', 'USDT').replace('/USDT', 'USDT').toUpperCase()
}

// ─── NAVIGATION ───
function showSection(sectionId) {
  $(sectionId)?.scrollIntoView({ behavior: 'smooth' })
  document
    .querySelectorAll('.nav-link')
    .forEach((l) =>
      l.classList.toggle('active', l.getAttribute('href') === `#${sectionId}`),
    )
  $('nav-links')?.classList.remove('show')
  if (sectionId === 'history') renderHistory()
  if (sectionId === 'analytics') updateAnalytics()
}

function toggleMobileMenu() {
  $('nav-links')?.classList.toggle('show')
}
function isInViewport(el) {
  const r = el.getBoundingClientRect()
  return r.top < window.innerHeight && r.bottom > 0
}

// ─── TRADE HISTORY ───
function renderHistory() {
  const container = $('history-list')
  if (!container) return

  const filter = $('history-filter')?.value || 'all'
  const search = $('history-search')?.value.toLowerCase() || ''
  let filtered = state.trades
  if (filter !== 'all')
    filtered = filtered.filter((t) => t.status.toLowerCase() === filter)
  if (search)
    filtered = filtered.filter(
      (t) =>
        t.coin.toLowerCase().includes(search) ||
        (t.note && t.note.toLowerCase().includes(search)),
    )

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-chart-line"></i><p>${!state.trades.length ? 'No trades yet. Generate your first signal!' : 'No trades match your filter.'}</p></div>`
    return
  }

  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']

  container.innerHTML = filtered
    .map((trade) => {
      const isShort = trade.side === 'SHORT'
      const tpRows = trade.tps
        .map((tp, i) => {
          const hit = (trade.hitTPs || []).includes(i)
          const pct = Math.abs(
            ((tp - trade.entry) / trade.entry) * 100,
          ).toFixed(2)
          const lossPct = Math.abs(
            ((trade.sl - trade.entry) / trade.entry) * 100,
          )
          const rr = (pct / lossPct).toFixed(1)
          return `<div class="tp-row-status"><span class="tp-medal">${hit ? medals[i] : '⬜'}</span><span class="tp-label">TP${i + 1}</span><span class="tp-price">${tp}</span><span class="tp-pct">+${pct}%</span><span class="tp-rr">1:${rr}</span><span class="tp-state ${hit ? 'hit' : 'pending'}">${hit ? '✓ HIT' : 'Pending'}</span></div>`
        })
        .join('')

      let resultBar = ''
      if (trade.profit !== null) {
        const isWin = trade.profit >= 0
        const rrVal = (
          Math.abs(trade.profit) /
          Math.abs(((trade.sl - trade.entry) / trade.entry) * 100)
        ).toFixed(1)
        resultBar = `<div class="result-bar ${isWin ? 'win' : 'loss'}"><span class="result-pnl ${isWin ? 'pos' : 'neg'}">${isWin ? '+' : ''}${trade.profit}%</span><div class="result-details"><span class="rr-pill">1:${rrVal}</span>${trade.autoTriggered ? '<span class="badge badge-auto">⚡ AUTO</span>' : ''}</div></div>`
      }

      const actions =
        trade.status === 'OPEN'
          ? `<div class="trade-actions"><button class="btn-trade win" onclick="manualClose(${trade.id},'WIN')"><i class="fas fa-check"></i> Mark Win</button><button class="btn-trade loss" onclick="manualClose(${trade.id},'LOSS')"><i class="fas fa-times"></i> Mark Loss</button><button class="btn-trade edit" onclick="editTrade(${trade.id})"><i class="fas fa-edit"></i> Edit</button><button class="btn-trade edit" onclick="deleteTrade(${trade.id})"><i class="fas fa-trash"></i> Delete</button></div>`
          : `<div class="trade-actions"><button class="btn-trade edit" onclick="deleteTrade(${trade.id})"><i class="fas fa-trash"></i> Delete</button></div>`

      const milestones = getMilestones(trade)
      const msgButtons = []
      if (trade.status === 'OPEN') {
        msgButtons.push({ type: 'signal', label: '📊 Signal', cls: 'signal' })
        if (trade.be && trade.be !== 'None') {
          msgButtons.push({ type: 'be', label: '🔵 BE', cls: 'rr' })
        }
        milestones.forEach((m) => {
          const hit = (trade.hitRRs || []).includes(m)
          msgButtons.push({
            type: 'rr',
            label: `${hit ? '✅' : '⚖️'} 1:${m}`,
            cls: hit ? 'rr hit' : 'rr',
            data: m,
          })
        })
        ;(trade.hitTPs || []).forEach((idx) =>
          msgButtons.push({
            type: 'tp',
            label: `🎯 TP${idx + 1}`,
            cls: 'tp',
            data: idx,
          }),
        )
      } else {
        msgButtons.push({ type: 'signal', label: '📊 Original', cls: 'signal' })
        if (trade.status === 'LOSS')
          msgButtons.push({ type: 'sl', label: '🛑 SL Message', cls: 'sl' })
        msgButtons.push({ type: 'result', label: '🏁 Result', cls: 'result' })
      }

      const msgRow = msgButtons.length
        ? `<div class="msg-row">${msgButtons.map((btn) => `<button class="btn-msg ${btn.cls}" onclick="showMessage(${trade.id},'${btn.type}',${btn.data !== undefined ? btn.data : 'null'})">${btn.label}</button>`).join('')}</div>`
        : ''

      return `
      <div class="trade-card status-${trade.status.toLowerCase()}" id="trade-${trade.id}">
        <div class="trade-header">
          <div class="trade-info">
            <h4>${trade.coin}${trade.status === 'OPEN' ? `<span class="live-price" id="live-${trade.id}">● Live</span>` : ''}</h4>
            <div class="trade-badges">
              <span class="badge badge-${isShort ? 'short' : 'long'}">${trade.side}</span>
              <span class="badge badge-${trade.status.toLowerCase()}">${trade.status}</span>
              ${trade.manualMode ? '<span class="badge badge-manual">📝 MANUAL</span>' : ''}
              <span class="badge badge-open">${trade.leverage}</span>
            </div>
          </div>
          <div class="trade-date">${new Date(trade.date).toLocaleString()}</div>
        </div>
        <div class="trade-levels">
          <div class="level-item"><span class="level-label">Entry</span><span class="level-value">${trade.entry}</span></div>
          <div class="level-item"><span class="level-label">Stop Loss</span><span class="level-value sl">${trade.sl}</span></div>
          <div class="level-item"><span class="level-label">Risk</span><span class="level-value">${trade.riskPct}%</span></div>
        </div>
        <div class="tp-status">
          <div class="tp-status-header"><span>Take Profits</span><span>${(trade.hitTPs || []).length}/${trade.tps.length} Hit</span></div>
          ${tpRows}
        </div>
        ${trade.note ? `<div style="padding:12px 20px;font-size:13px;color:var(--text-secondary);border-bottom:1px solid var(--border-color)">💬 ${trade.note}</div>` : ''}
        ${resultBar}${actions}${msgRow}
      </div>`
    })
    .join('')
}

// ─── MISSING FUNCTIONS (now implemented) ───

function getMilestones(trade) {
  const lossPct = Math.abs(((trade.sl - trade.entry) / trade.entry) * 100)
  if (!lossPct) return []
  const maxTpPct = Math.max(
    ...trade.tps.map((tp) =>
      Math.abs(((tp - trade.entry) / trade.entry) * 100),
    ),
  )
  const maxRR = Math.floor(maxTpPct / lossPct)
  return Array.from({ length: Math.min(maxRR, 5) }, (_, i) => i + 1)
}

// FIX: manualClose — previously missing, now works
function manualClose(id, status) {
  const trade = state.trades.find((t) => t.id === id)
  if (!trade || trade.status !== 'OPEN') return
  const defaultPrice =
    status === 'WIN' ? trade.tps[trade.tps.length - 1] : trade.sl
  const input = prompt(`Exit price (default: ${defaultPrice}):`, defaultPrice)
  if (input === null) return
  const exitPrice = parseFloat(input) || defaultPrice
  trade.autoTriggered = false
  closeTrade(trade, status, exitPrice)
  saveTrades()
  renderHistory()
  updateAnalytics()
  updateQuickStats()
}

// FIX: editTrade — previously missing, now works
function editTrade(id) {
  const trade = state.trades.find((t) => t.id === id)
  if (!trade || trade.status !== 'OPEN') return
  ;[
    ['coin-input', trade.coin],
    ['side-select', trade.side.toLowerCase()],
    ['order-type', trade.orderType === 'Limit Order' ? 'limit' : 'market'],
    ['entry-price', trade.entry],
    ['stop-loss', trade.sl],
    ['break-even', trade.be !== 'None' ? trade.be : ''],
    ['leverage', trade.leverage],
    ['risk-pct', trade.riskPct],
    ['signal-note', trade.note || ''],
  ].forEach(([id, val]) => {
    const e = $(id)
    if (e) e.value = val
  })

  const manEl = $('manual-mode')
  if (manEl) manEl.checked = trade.manualMode

  // Reset TPs to first only, then re-populate
  const container = $('tp-container')
  container.querySelectorAll('.tp-row').forEach((row, idx) => {
    if (idx === 0) row.querySelector('.tp-input').value = trade.tps[0] || ''
    else row.remove()
  })
  state.currentTPs = 1
  for (let i = 1; i < trade.tps.length; i++) {
    addTP()
    const inputs = document.querySelectorAll('.tp-input')
    if (inputs[i]) inputs[i].value = trade.tps[i]
  }

  state.trades = state.trades.filter((t) => t.id !== id)
  saveTrades()
  showSection('signals')
  calculateRisk()
  showToast('Trade loaded — update fields and re-generate', 'info')
}

function deleteTrade(id) {
  if (!confirm('Delete this trade permanently?')) return
  state.trades = state.trades.filter((t) => t.id !== id)
  saveTrades()
  renderHistory()
  updateAnalytics()
  updateQuickStats()
  showToast('Trade deleted', 'info')
}

// ─── MESSAGE MODAL ───
function showMessage(id, type, data) {
  const trade = state.trades.find((t) => t.id === id)
  if (!trade) return
  const map = {
    signal: ['📊 Original Signal', () => buildOpenMessage(trade)],
    tp: [
      `🎯 TP${data + 1} Hit`,
      () =>
        trade.tpMessages?.[data] ||
        buildTPHitMessage(trade, data, trade.tps[data]),
    ],
    rr: [`⚖️ 1:${data} RR Update`, () => buildRRMessage(trade, data)],
    be: ['🔵 Break Even Message', () => buildBEMessage(trade)],
    sl: ['🛑 Stop Loss Message', () => buildSLMessage(trade)],
    result: [
      '🏁 Final Result',
      () => trade.resultMessage || buildResultMessage(trade),
    ],
  }
  if (!map[type]) return
  const [title, getContent] = map[type]
  $('msg-modal-title').textContent = title
  $('msg-modal-content').value = getContent()
  $('msg-modal').classList.add('show')
}

function closeModal() {
  $('msg-modal')?.classList.remove('show')
}

// ─── WEEKLY REPORT — Opens print-ready PDF page in new window ───
function exportExcel() {
  if (!state.trades.length) {
    showToast('No trades to export', 'error')
    return
  }

  const trades = [...state.trades].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  )
  const now = new Date()
  const monthName = now.toLocaleString('default', { month: 'long' })
  const year = now.getFullYear()

  // Stats for summary section
  const closed = trades.filter((t) => t.status !== 'OPEN')
  const wins = trades.filter((t) => t.status === 'WIN').length
  const losses = trades.filter((t) => t.status === 'LOSS').length
  const open = trades.filter((t) => t.status === 'OPEN').length
  const winRate = closed.length ? ((wins / closed.length) * 100).toFixed(0) : 0
  const totalPnl = closed.reduce((s, t) => s + (t.profit || 0), 0)

  const rows = trades
    .map((t, idx) => {
      const isShort = t.side === 'SHORT'
      const sideColor = isShort ? '#dc2626' : '#16a34a'
      const sideBg = isShort ? '#fef2f2' : '#f0fdf4'
      let tpslText, tpslColor, tpslBg
      if (t.status === 'WIN') {
        tpslText = 'Tp'
        tpslColor = '#15803d'
        tpslBg = '#16a34a'
      } else if (t.status === 'LOSS') {
        tpslText = 'Sl'
        tpslColor = '#fff'
        tpslBg = '#dc2626'
      } else if (t.be && t.be !== 'None') {
        tpslText = 'Be'
        tpslColor = '#fff'
        tpslBg = '#d97706'
      } else {
        tpslText = 'Open'
        tpslColor = '#fff'
        tpslBg = '#6b7280'
      }
      const rr = getRR(t)
      const dateStr = new Date(t.date).toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      })
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      return `<tr style="background:${rowBg}">
      <td class="tc">${idx + 1}</td>
      <td class="tc">${dateStr}</td>
      <td class="tc fw6">${t.coin}</td>
      <td class="tc" style="background:${sideColor};color:#fff;font-weight:700">${isShort ? 'Sell' : 'Buy'}</td>
      <td class="tc" style="background:${tpslBg};color:#fff;font-weight:700">${tpslText}</td>
      <td class="tc fw6">1:${rr}</td>
    </tr>`
    })
    .join('')

  const pnlSign = totalPnl >= 0 ? '+' : ''
  const pnlColor = totalPnl >= 0 ? '#15803d' : '#dc2626'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MASTER ANALYST CRYPTO VIP — ${monthName} ${year}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #e8edf5;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 30px 16px 60px;
  }

  /* ── TOP ACTION BAR (hidden when printing) ── */
  .action-bar {
    width: 100%;
    max-width: 780px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .action-bar h2 {
    font-size: 15px;
    color: #475569;
    font-weight: 500;
  }
  .action-bar h2 span { color: #1e3a8a; font-weight: 700; }
  .btn-pdf {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 28px;
    background: linear-gradient(135deg, #1e3a8a, #2563eb);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(37,99,235,0.4);
    letter-spacing: 0.3px;
    transition: all 0.2s;
  }
  .btn-pdf:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(37,99,235,0.5);
  }
  .btn-pdf svg { width:18px; height:18px; }

  /* ── SHEET ── */
  .sheet {
    background: #fff;
    width: 100%;
    max-width: 780px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 4px 32px rgba(0,0,0,0.12);
    border: 1px solid #cbd5e1;
  }

  /* top meta row */
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 20px;
    background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
    font-size: 12px;
    color: #64748b;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  /* title */
  .title-row {
    background: linear-gradient(90deg, #dbeafe 0%, #eff6ff 50%, #dbeafe 100%);
    text-align: center;
    padding: 18px 20px;
    border-bottom: 2px solid #93c5fd;
  }
  .title-row h1 {
    font-size: 22px;
    font-weight: 900;
    color: #1e3a8a;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .title-row p {
    font-size: 11px;
    color: #64748b;
    margin-top: 4px;
    letter-spacing: 1px;
  }

  /* table */
  table { width:100%; border-collapse:collapse; }
  thead tr { background: #f1f5f9; }
  thead th {
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 700;
    color: #374151;
    text-align: center;
    border: 1px solid #e2e8f0;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  tbody td {
    padding: 9px 12px;
    font-size: 13px;
    border: 1px solid #e2e8f0;
    color: #1e293b;
  }
  .tc { text-align:center; }
  .fw6 { font-weight:600; }
  tbody tr:hover { filter: brightness(0.97); }

  /* summary strip */
  .summary-strip {
    display: flex;
    border-top: 2px solid #e2e8f0;
    background: #f8fafc;
  }
  .sum-item {
    flex: 1;
    text-align: center;
    padding: 14px 8px;
    border-right: 1px solid #e2e8f0;
  }
  .sum-item:last-child { border-right: none; }
  .sum-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #94a3b8;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .sum-value {
    font-size: 18px;
    font-weight: 800;
    color: #1e293b;
  }
  .sum-value.green { color: #16a34a; }
  .sum-value.red   { color: #dc2626; }
  .sum-value.blue  { color: #2563eb; }

  /* legend */
  .legend {
    display: flex;
    gap: 18px;
    padding: 12px 20px;
    border-top: 1px solid #e2e8f0;
    background: #fff;
    flex-wrap: wrap;
  }
  .leg { display:flex; align-items:center; gap:6px; font-size:11px; color:#64748b; }
  .leg-dot {
    width:12px; height:12px; border-radius:3px; display:inline-block;
  }

  /* footer */
  .footer {
    text-align: center;
    padding: 10px 20px;
    font-size: 11px;
    color: #94a3b8;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
    letter-spacing: 0.5px;
  }

  /* ── PRINT STYLES ── */
  @media print {
    body { background:#fff; padding:0; }
    .action-bar { display:none !important; }
    .sheet {
      box-shadow: none;
      border: none;
      border-radius: 0;
      width: 100%;
      max-width: 100%;
    }
    @page { margin: 10mm 12mm; size: A4 portrait; }
  }
</style>
</head>
<body>

<!-- Action Bar -->
<div class="action-bar">
  <h2>Preview — <span>${monthName} ${year} Weekly Report</span></h2>
  <button class="btn-pdf" onclick="window.print()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9V2h12v7"/><rect x="6" y="17" width="12" height="5"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    </svg>
    Download PDF
  </button>
</div>

<!-- Sheet -->
<div class="sheet">

  <!-- Meta row -->
  <div class="meta-row">
    <span>${monthName} ${year}</span>
    <span>Weekly Report</span>
    <span>Generated ${now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
  </div>

  <!-- Title -->
  <div class="title-row">
    <h1>Master Analyst Crypto VIP</h1>
    <p>Professional Trading Signal Record</p>
  </div>

  <!-- Table -->
  <table>
    <thead>
      <tr>
        <th style="width:48px">Tno.</th>
        <th>Date</th>
        <th>Pair</th>
        <th>Buy / Sell</th>
        <th>Tp / Sl</th>
        <th>RR</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <!-- Summary strip -->
  <div class="summary-strip">
    <div class="sum-item">
      <div class="sum-label">Total Trades</div>
      <div class="sum-value blue">${trades.length}</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">Wins</div>
      <div class="sum-value green">${wins}</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">Losses</div>
      <div class="sum-value red">${losses}</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">Open</div>
      <div class="sum-value">${open}</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">Win Rate</div>
      <div class="sum-value ${winRate >= 50 ? 'green' : 'red'}">${winRate}%</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">Total P&amp;L</div>
      <div class="sum-value ${totalPnl >= 0 ? 'green' : 'red'}">${pnlSign}${totalPnl.toFixed(1)}%</div>
    </div>
  </div>

  <!-- Legend -->
  <div class="legend">
    <div class="leg"><span class="leg-dot" style="background:#16a34a"></span> Tp — Take Profit Hit</div>
    <div class="leg"><span class="leg-dot" style="background:#dc2626"></span> Sl — Stop Loss Hit</div>
    <div class="leg"><span class="leg-dot" style="background:#d97706"></span> Be — Break Even</div>
    <div class="leg"><span class="leg-dot" style="background:#6b7280"></span> Open — Trade Active</div>
  </div>

  <!-- Footer -->
  <div class="footer">CryptoSignal PRO &nbsp;·&nbsp; Master Analyst Crypto VIP &nbsp;·&nbsp; ${monthName} ${year}</div>

</div>

</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    showToast('Pop-up blocked! Please allow pop-ups for this site.', 'error')
    return
  }
  win.document.write(html)
  win.document.close()
  showToast('Report opened — click Download PDF!', 'success')
}

// FIX: copyFromModal — previously missing, now works
function copyFromModal() {
  const content = $('msg-modal-content')
  if (!content?.value) return
  navigator.clipboard
    .writeText(content.value)
    .then(() => {
      showToast('Copied!', 'success')
      closeModal()
    })
    .catch(() => {
      content.select()
      document.execCommand('copy')
      showToast('Copied!', 'success')
      closeModal()
    })
}

// ─── ANALYTICS ───
function updateAnalytics() {
  const closed = state.trades.filter((t) => t.status !== 'OPEN')
  const wins = closed.filter((t) => t.status === 'WIN')
  const winRate = closed.length
    ? ((wins.length / closed.length) * 100).toFixed(1)
    : 0
  const grossProfit = wins.reduce((s, t) => s + (t.profit || 0), 0)
  const grossLoss = Math.abs(
    closed
      .filter((t) => t.status === 'LOSS')
      .reduce((s, t) => s + (t.profit || 0), 0),
  )
  const pf =
    grossLoss > 0
      ? (grossProfit / grossLoss).toFixed(2)
      : grossProfit > 0
        ? '∞'
        : '0'
  const pnl = closed.reduce((s, t) => s + (t.profit || 0), 0)
  const openCount = state.trades.filter((t) => t.status === 'OPEN').length

  setEl('analytic-total', state.trades.length)
  setEl('analytic-winrate', winRate + '%')
  setEl('analytic-pf', pf)
  setEl('analytic-open', openCount)
  setEl('analytic-closed', closed.length)

  const pnlEl = $('analytic-pnl')
  if (pnlEl) {
    pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + '%'
    pnlEl.className = 'analytic-value ' + (pnl >= 0 ? 'win' : 'loss')
  }

  updateChart()
  updateRRDistribution(closed)
}

function updateQuickStats() {
  const closed = state.trades.filter((t) => t.status !== 'OPEN')
  const wins = closed.filter((t) => t.status === 'WIN')
  const winRate = closed.length
    ? ((wins.length / closed.length) * 100).toFixed(0)
    : 0
  const pnl = closed.reduce((s, t) => s + (t.profit || 0), 0)
  const openCount = state.trades.filter((t) => t.status === 'OPEN').length

  setEl('stat-open', openCount)
  setEl('stat-winrate', winRate + '%')
  setEl('nav-open-count', openCount) // FIX: nav badge now updates

  const pnlEl = $('stat-pnl')
  if (pnlEl) {
    pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(1) + '%'
    pnlEl.className = 'stat-value ' + (pnl >= 0 ? 'win' : 'loss')
  }
}

function updateChart() {
  const ctx = $('performance-chart')
  if (!ctx) return
  const monthly = {}
  state.trades
    .filter((t) => t.status !== 'OPEN')
    .forEach((t) => {
      const month = new Date(t.date).toLocaleString('default', {
        month: 'short',
        year: '2-digit',
      })
      if (!monthly[month]) monthly[month] = { wins: 0, losses: 0 }
      if (t.status === 'WIN') monthly[month].wins++
      else monthly[month].losses++
    })
  const labels = Object.keys(monthly)
  if (!labels.length) {
    if (state.chart) state.chart.destroy()
    return
  }
  if (state.chart) state.chart.destroy()
  state.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Wins',
          data: labels.map((m) => monthly[m].wins),
          backgroundColor: 'rgba(0,212,170,0.8)',
          borderRadius: 6,
        },
        {
          label: 'Losses',
          data: labels.map((m) => monthly[m].losses),
          backgroundColor: 'rgba(255,71,87,0.8)',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#94a3b8', font: { family: 'Inter' } },
        },
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#2d3748' } },
        y: {
          ticks: { color: '#64748b', stepSize: 1 },
          grid: { color: '#2d3748' },
        },
      },
    },
  })
}

function updateRRDistribution(closed) {
  const ranges = { r1: 0, r2: 0, r3: 0 }
  closed.forEach((t) => {
    const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100)
    const rr = lossPct > 0 ? Math.abs(t.profit) / lossPct : 0
    if (rr < 2) ranges.r1++
    else if (rr < 3) ranges.r2++
    else ranges.r3++
  })
  const total = closed.length || 1
  ;[
    ['rr-bar-1', 'rr-count-1', ranges.r1],
    ['rr-bar-2', 'rr-count-2', ranges.r2],
    ['rr-bar-3', 'rr-count-3', ranges.r3],
  ].forEach(([barId, cntId, val]) => {
    const bar = $(barId)
    if (bar) bar.style.width = `${(val / total) * 100}%`
    setEl(cntId, val)
  })
}

// ─── MARKET DATA ───
async function loadMarketData() {
  try {
    const symbols = [
      'BTCUSDT',
      'ETHUSDT',
      'SOLUSDT',
      'BNBUSDT',
      'XRPUSDT',
      'ADAUSDT',
      'DOGEUSDT',
      'AVAXUSDT',
    ]
    const data = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`,
    ).then((r) => r.json())

    const grid = $('market-grid')
    if (grid) {
      grid.innerHTML = data
        .map((item) => {
          const price = parseFloat(item.lastPrice),
            change = parseFloat(item.priceChangePercent),
            isUp = change >= 0
          const symbol = item.symbol.replace('USDT', ''),
            coin = COINS.find((c) => c.symbol.includes(symbol)) || {}
          state.prices[symbol] = price
          return `<div class="market-card"><div class="market-header"><div class="market-icon" style="background:${coin.color}20;color:${coin.color}">${coin.icon || symbol[0]}</div><div class="market-info"><h4>${symbol}</h4><span>${coin.name || symbol}</span></div></div><div class="market-price">$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><span class="market-change ${isUp ? 'up' : 'down'}"><i class="fas fa-arrow-${isUp ? 'up' : 'down'}"></i>${Math.abs(change).toFixed(2)}%</span></div>`
        })
        .join('')
    }

    const btc = data.find((d) => d.symbol === 'BTCUSDT'),
      eth = data.find((d) => d.symbol === 'ETHUSDT')
    if (btc)
      setEl(
        'hero-btc',
        '$' +
          parseFloat(btc.lastPrice).toLocaleString(undefined, {
            maximumFractionDigits: 0,
          }),
      )
    if (eth)
      setEl(
        'hero-eth',
        '$' +
          parseFloat(eth.lastPrice).toLocaleString(undefined, {
            maximumFractionDigits: 0,
          }),
      )

    const tickerText = data
      .map(
        (item) =>
          `${item.symbol.replace('USDT', '')} $${parseFloat(item.lastPrice).toFixed(item.symbol.includes('BTC') ? 0 : 2)}`,
      )
      .join('   ·   ')
    const tickerEl = $('ticker-prices')
    if (tickerEl) tickerEl.textContent = tickerText + '   ·   ' + tickerText
  } catch (err) {
    console.error('Market data error:', err)
    const tickerEl = $('ticker-prices')
    if (tickerEl)
      tickerEl.textContent =
        '⚠️ Market data unavailable — open via localhost, not file://'
  }
}

async function fetchPrice(symbol) {
  try {
    const data = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${toBinanceSymbol(symbol)}`,
    ).then((r) => r.json())
    return parseFloat(data.price)
  } catch {
    return null
  }
}

// ─── POSITION CALCULATOR ───
function calculatePosition() {
  const balance = parseFloat($('calc-balance')?.value) || 0
  const risk = parseFloat($('calc-risk')?.value) || 0
  const entry = parseFloat($('calc-entry')?.value) || 0
  const sl = parseFloat($('calc-sl')?.value) || 0

  if (!balance || !risk || !entry || !sl) {
    showToast('Please fill all fields', 'error')
    return
  }
  const priceDiff = Math.abs(entry - sl)
  if (!priceDiff) {
    showToast('Entry and SL cannot be the same', 'error')
    return
  }

  const riskAmount = balance * (risk / 100)
  const positionSize = riskAmount / (priceDiff / entry)
  const coins = positionSize / entry

  setEl('res-risk', '$' + riskAmount.toFixed(2))
  setEl('res-size', '$' + positionSize.toFixed(2))
  setEl('res-coins', coins.toFixed(4))
}

// ─── EXPORT / IMPORT ───
function exportData() {
  const blob = new Blob([JSON.stringify(state.trades, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cryptosignal_backup_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  showToast('Data exported!', 'success')
}

function importData(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      if (!Array.isArray(data)) throw new Error()
      state.trades = data
      saveTrades()
      renderHistory()
      updateAnalytics()
      updateQuickStats()
      showToast(`Imported ${data.length} trades!`, 'success')
    } catch {
      showToast('Invalid file format', 'error')
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

function clearAllData() {
  if (!confirm('⚠️ DELETE ALL TRADES? This cannot be undone!')) return
  if (prompt('Type DELETE to confirm:') !== 'DELETE') {
    showToast('Cancelled', 'info')
    return
  }
  state.trades = []
  localStorage.removeItem('csp_trades_v3')
  renderHistory()
  updateAnalytics()
  updateQuickStats()
  showToast('All data cleared', 'info')
}

// ─── TOAST ───
function showToast(message, type = 'info', duration = 3000) {
  const toast = $('toast')
  if (!toast) return
  toast.textContent = message
  toast.className = `toast ${type} show`
  setTimeout(() => toast.classList.remove('show'), duration)
}
