// ═══════════════════════════════════════════════════════════
// CRYPTOSIGNAL PRO v2.0 - Complete Trading Terminal
// Features: Kill Zones, Auto-Monitoring, TP/SL Messages, Analytics
// All data stored in localStorage - No backend required
// ═══════════════════════════════════════════════════════════

// ─── STATE MANAGEMENT ───
const state = {
  trades: JSON.parse(localStorage.getItem('csp_trades') || '[]'),
  currentTPs: 1,
  prices: {},
  kzInterval: null,
  priceMonitorInterval: null,
  chart: null,
}

// ─── CONSTANTS ───
const KZ_SESSIONS = [
  {
    id: 'asia',
    name: 'ASIA KZ',
    startUTC: 1,
    endUTC: 3,
    icon: '🌏',
    color: '#8b5cf6',
    desc: 'Tokyo open · AUD, NZD, JPY',
  },
  {
    id: 'london',
    name: 'LONDON KZ',
    startUTC: 7,
    endUTC: 10,
    icon: '🔥',
    color: '#f97316',
    desc: 'Highest volume · EUR, GBP, CHF',
  },
  {
    id: 'ny',
    name: 'NEW YORK KZ',
    startUTC: 12,
    endUTC: 15,
    icon: '⚡',
    color: '#ef4444',
    desc: 'NY + London overlap · Max liquidity',
  },
  {
    id: 'close',
    name: 'LONDON CLOSE',
    startUTC: 15,
    endUTC: 17,
    icon: '🎯',
    color: '#f59e0b',
    desc: 'Position squaring · Watch reversals',
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

// ─── INITIALIZATION ───
document.addEventListener('DOMContentLoaded', () => {
  initCoinGrid()
  initCoinSuggestions()
  initKillZones()
  loadMarketData()
  renderHistory()
  updateAnalytics()
  updateQuickStats()

  // Start intervals
  setInterval(loadMarketData, 30000)
  setInterval(updateKillZones, 1000)
  startPriceMonitor()

  // Input listeners
  ;['entry-price', 'stop-loss', 'side-select'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', calculateRisk)
  })
  document
    .getElementById('tp-container')
    ?.addEventListener('input', calculateRisk)

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const signalsSection = document.getElementById('signals')
      if (signalsSection && isInViewport(signalsSection)) {
        e.preventDefault()
        generateSignal()
      }
    }
    if (e.key === 'Escape') closeModal()
  })
})

// ─── NAVIGATION ───
function showSection(sectionId) {
  const element = document.getElementById(sectionId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }

  // Update active nav
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle(
      'active',
      link.getAttribute('href') === `#${sectionId}`,
    )
  })

  // Close mobile menu
  document.getElementById('nav-links')?.classList.remove('show')

  // Refresh data
  if (sectionId === 'history') renderHistory()
  if (sectionId === 'analytics') updateAnalytics()
}

function toggleMobileMenu() {
  document.getElementById('nav-links')?.classList.toggle('show')
}

function isInViewport(el) {
  const rect = el.getBoundingClientRect()
  return rect.top < window.innerHeight && rect.bottom > 0
}

// ─── KILL ZONES ───
function initKillZones() {
  updateKillZones()
  // Set local times
  KZ_SESSIONS.forEach((s) => {
    const el = document.getElementById(`local-${s.id}`)
    if (el) {
      const time = formatLocalTime(s.startUTC)
      el.textContent = `${time} LKT`
    }
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

  // Update hero card
  const dot = document.getElementById('kz-dot')
  const name = document.getElementById('kz-name')
  const timer = document.getElementById('kz-timer')
  const progress = document.getElementById('kz-progress')

  if (active) {
    dot?.classList.add('active')
    if (name)
      name.textContent = `${active.session.icon} ${active.session.name} ACTIVE`
    if (timer) timer.textContent = formatDuration(active.remaining)
    if (progress) {
      progress.style.width = `${active.progress}%`
      progress.style.background = active.session.color
    }
  } else {
    dot?.classList.remove('active')
    // Find next session
    let next = null,
      minWait = Infinity
    for (const s of KZ_SESSIONS) {
      const wait =
        utcH < s.startUTC ? s.startUTC - utcH : 24 - utcH + s.startUTC
      if (wait < minWait) {
        minWait = wait
        next = s
      }
    }
    if (name) name.textContent = `⏰ Next: ${next?.name || '---'}`
    if (timer) timer.textContent = `in ${formatDuration(minWait * 3600)}`
    if (progress) {
      progress.style.width = '0%'
      progress.style.background = 'var(--text-muted)'
    }
  }

  // Update session cards
  KZ_SESSIONS.forEach((s) => {
    const isActive = active && active.session.id === s.id
    const card = document.getElementById(`kz-card-${s.id}`)
    const status = document.getElementById(`status-${s.id}`)
    const tag = document.getElementById(`tag-${s.id}`)

    card?.classList.toggle('active', isActive)
    if (status) {
      status.textContent = isActive ? '🔥 ACTIVE NOW' : 'Inactive'
      status.classList.toggle('active', isActive)
    }
    tag?.classList.toggle('active', isActive)
  })

  // Update clocks
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

  document.getElementById('time-ny').textContent = fmt('America/New_York')
  document.getElementById('time-london').textContent = fmt('Europe/London')
  document.getElementById('time-utc').textContent = fmt('UTC')
  document.getElementById('time-local').textContent =
    now.toLocaleTimeString('en-GB')

  // Highlight active clocks
  const utcH = now.getUTCHours()
  document.getElementById('clock-ny')?.classList.toggle(
    'active',
    KZ_SESSIONS.filter((s) => s.id === 'ny' || s.id === 'close').some(
      (s) => utcH >= s.startUTC && utcH < s.endUTC,
    ),
  )
  document.getElementById('clock-london')?.classList.toggle(
    'active',
    KZ_SESSIONS.filter(
      (s) => s.id === 'london' || s.id === 'ny' || s.id === 'close',
    ).some((s) => utcH >= s.startUTC && utcH < s.endUTC),
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
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

// ─── COIN SELECTION ───
function initCoinGrid() {
  const grid = document.getElementById('coin-grid')
  if (!grid) return

  grid.innerHTML = COINS.slice(0, 8)
    .map(
      (coin) => `
        <button class="coin-btn" onclick="selectCoin('${coin.symbol}')" data-symbol="${coin.symbol}">
            ${coin.icon} ${coin.symbol.split('/')[0]}
        </button>
    `,
    )
    .join('')
}

function initCoinSuggestions() {
  const datalist = document.getElementById('coin-list')
  if (!datalist) return

  datalist.innerHTML = COINS.map(
    (coin) => `<option value="${coin.symbol}">${coin.name}</option>`,
  ).join('')
}

function selectCoin(symbol) {
  document.getElementById('coin-input').value = symbol

  document.querySelectorAll('.coin-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.symbol === symbol)
  })

  // Fetch price for entry suggestion
  fetchPrice(symbol).then((price) => {
    if (price) {
      document.getElementById('entry-price').value = price.toFixed(
        price < 10 ? 4 : 2,
      )
      calculateRisk()
    }
  })
}

// ─── TP MANAGEMENT ───
function addTP() {
  if (state.currentTPs >= 6) {
    showToast('Maximum 6 TPs allowed', 'info')
    return
  }

  state.currentTPs++
  const container = document.getElementById('tp-container')

  const row = document.createElement('div')
  row.className = 'tp-row'
  row.innerHTML = `
        <span class="tp-num">TP${state.currentTPs}</span>
        <input type="number" class="tp-input" placeholder="0.00000" step="any">
        <button class="tp-remove" onclick="removeTP(this)">
            <i class="fas fa-times"></i>
        </button>
    `

  container.appendChild(row)
  calculateRisk()
}

function removeTP(btn) {
  if (state.currentTPs <= 1) return

  btn.closest('.tp-row').remove()
  state.currentTPs--

  // Renumber
  document.querySelectorAll('.tp-row').forEach((row, idx) => {
    row.querySelector('.tp-num').textContent = `TP${idx + 1}`
  })

  calculateRisk()
}

function getTPValues() {
  return Array.from(document.querySelectorAll('.tp-input'))
    .map((input) => parseFloat(input.value))
    .filter((v) => !isNaN(v) && v > 0)
}

// ─── RISK CALCULATION ───
function calculateRisk() {
  const entry = parseFloat(document.getElementById('entry-price')?.value)
  const sl = parseFloat(document.getElementById('stop-loss')?.value)
  const side = document.getElementById('side-select')?.value
  const tps = getTPValues()
  const card = document.getElementById('risk-card')

  if (!entry || !sl || !side || tps.length === 0) {
    card.style.display = 'none'
    return
  }

  const isShort = side === 'short'

  // Validation
  const validSL = isShort ? sl > entry : sl < entry
  const validTP = isShort ? tps[0] < entry : tps[0] > entry

  if (!validSL || !validTP) {
    card.style.display = 'none'
    return
  }

  const lossPct = isShort
    ? ((sl - entry) / entry) * 100
    : ((entry - sl) / entry) * 100
  const profitPct = isShort
    ? ((entry - tps[0]) / entry) * 100
    : ((tps[0] - entry) / entry) * 100
  const rr = profitPct / lossPct

  document.getElementById('preview-rr').textContent = `1:${rr.toFixed(2)}`
  document.getElementById('preview-profit').textContent =
    `+${profitPct.toFixed(2)}%`
  document.getElementById('preview-loss').textContent =
    `-${lossPct.toFixed(2)}%`

  const riskScore = Math.min((lossPct / 2) * 100, 100)
  document.getElementById('risk-progress').style.width = `${riskScore}%`

  card.style.display = 'block'
}

// ─── SIGNAL GENERATION ───
function generateSignal() {
  const coin = document.getElementById('coin-input').value.trim()
  const side = document.getElementById('side-select').value
  const orderType = document.getElementById('order-type').value
  const entry = parseFloat(document.getElementById('entry-price').value)
  const sl = parseFloat(document.getElementById('stop-loss').value)
  const be = document.getElementById('break-even').value
  const leverage = document.getElementById('leverage').value || '10x'
  const riskPct = document.getElementById('risk-pct').value || '1'
  const note = document.getElementById('signal-note').value
  const manualMode = document.getElementById('manual-mode').checked
  const tps = getTPValues()

  // Validation
  if (!coin) return showToast('Please enter a trading pair', 'error')
  if (!entry || entry <= 0)
    return showToast('Valid entry price required', 'error')
  if (!sl || sl <= 0) return showToast('Valid stop loss required', 'error')
  if (tps.length === 0) return showToast('At least one TP required', 'error')

  const isShort = side === 'short'

  // Direction validation
  if (isShort) {
    if (sl <= entry)
      return showToast('For SHORT, SL must be above entry', 'error')
    if (tps.some((tp) => tp >= entry))
      return showToast('For SHORT, TPs must be below entry', 'error')
  } else {
    if (sl >= entry)
      return showToast('For LONG, SL must be below entry', 'error')
    if (tps.some((tp) => tp <= entry))
      return showToast('For LONG, TPs must be above entry', 'error')
  }

  // Validate TP order
  for (let i = 1; i < tps.length; i++) {
    if (isShort && tps[i] >= tps[i - 1]) {
      return showToast(
        `TP${i + 1} must be lower than TP${i} for SHORT`,
        'error',
      )
    }
    if (!isShort && tps[i] <= tps[i - 1]) {
      return showToast(
        `TP${i + 1} must be higher than TP${i} for LONG`,
        'error',
      )
    }
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
    manualMode,
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

  // Show output
  const message = buildOpenMessage(trade)
  document.getElementById('signal-output').value = message
  document.getElementById('output-card').style.display = 'block'

  // Reset form
  resetForm()

  // Update displays
  renderHistory()
  updateAnalytics()
  updateQuickStats()

  showToast(
    manualMode ? 'Signal saved (Manual Mode)' : 'Signal saved & monitoring!',
    'success',
  )
}

function resetForm() {
  document.getElementById('entry-price').value = ''
  document.getElementById('stop-loss').value = ''
  document.getElementById('break-even').value = ''
  document.getElementById('signal-note').value = ''
  document.getElementById('manual-mode').checked = false

  // Reset TPs
  document.querySelectorAll('.tp-input').forEach((input, idx) => {
    if (idx === 0) input.value = ''
  })

  while (state.currentTPs > 1) {
    const removeBtn = document.querySelector('.tp-remove')
    if (removeBtn && removeBtn.style.opacity !== '0') {
      removeTP(removeBtn)
    } else {
      break
    }
  }

  state.currentTPs = 1
  document.getElementById('risk-card').style.display = 'none'
}

function saveTrades() {
  localStorage.setItem('csp_trades', JSON.stringify(state.trades))
}

// ─── MESSAGE BUILDERS ───
function buildOpenMessage(t) {
  const isShort = t.side === 'SHORT'
  const dir = isShort ? 'SHORT 🔴' : 'LONG 🟢'
  const arrow = isShort ? '⬇️' : '⬆️'
  const tag = '#' + t.coin.replace('/', '').replace('.P', '')

  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100).toFixed(2)
  const tp1Pct = Math.abs(((t.tps[0] - t.entry) / t.entry) * 100).toFixed(2)
  const rr = (tp1Pct / lossPct).toFixed(2)

  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const tpLines = t.tps
    .map((tp, i) => {
      const pct = Math.abs(((tp - t.entry) / t.entry) * 100).toFixed(2)
      return `  ${medals[i]} TP${i + 1}  ›  ${tp}  (+${pct}%)`
    })
    .join('\n')

  const beLine = t.be !== 'None' ? `\n  🔵 BE     ›  ${t.be}` : ''
  const noteLine = t.note ? `\n💬 ${t.note}` : ''
  const manualLine = t.manualMode
    ? '\n📝 MANUAL MODE: Limit order - monitor manually'
    : ''

  return `╔══════════════════════════╗
  🀄  ${tag}
  ${dir}  ${arrow}
╚══════════════════════════╝

📋 ${t.orderType.toUpperCase()}
🔒 Leverage: ${t.leverage}${manualLine}

┌─────────────────────────┐
  📍 Entry  ›  ${t.entry}
${tpLines}
  🛑 SL     ›  ${t.sl}  (-${lossPct}%)${beLine}
└─────────────────────────┘

📊 Risk Analysis:
  💰 Risk: ${t.riskPct}% of balance
  📈 Reward: +${tp1Pct}% (TP1)
  ⚖️  R:R   ›  1:${rr}${noteLine}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🪷 Patience · 🌸 Discipline
🔐 CryptoSignal PRO`
}

function buildTPHitMessage(t, idx, hitPrice) {
  const isShort = t.side === 'SHORT'
  const tag = '#' + t.coin.replace('/', '').replace('.P', '')
  const tp = t.tps[idx]
  const profPct = Math.abs(((tp - t.entry) / t.entry) * 100).toFixed(2)
  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100)
  const rr = (profPct / lossPct).toFixed(2)
  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const isLast = idx === t.tps.length - 1

  let extra = ''
  if (isLast) {
    extra = `\n🎊 All targets reached! Excellent trade!`
  } else {
    extra = `\n⏳ Remaining TPs in play\n💡 Consider moving SL to BE`
  }

  let rrEmoji = '✅'
  if (rr >= 2) rrEmoji = '🔥'
  if (rr >= 3) rrEmoji = '🚀'
  if (rr >= 5) rrEmoji = '💎'

  return `${rrEmoji} TP${idx + 1} HIT!

╔══════════════════════════╗
  🀄  ${tag}  ${isShort ? 'SHORT 🔴' : 'LONG 🟢'}
╚══════════════════════════╝

${medals[idx]} TP${idx + 1}  ›  ${tp}
📍 Entry was  ›  ${t.entry}

┌─────────────────────────┐
  📈 Profit: +${profPct}%
  ⚖️  R:R   ›  1:${rr}
  💰 Risk: ${t.riskPct}% of balance
└─────────────────────────┘${extra}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 CryptoSignal PRO`
}

function buildRRMessage(t, mult) {
  const isShort = t.side === 'SHORT'
  const tag = '#' + t.coin.replace('/', '').replace('.P', '')
  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100)
  const profPct = (lossPct * mult).toFixed(2)
  const rrPrice = isShort
    ? (t.entry - ((t.entry * lossPct) / 100) * mult).toFixed(6)
    : (t.entry + ((t.entry * lossPct) / 100) * mult).toFixed(6)

  let emoji = '✅',
    note = 'Move SL to Break Even!'
  if (mult >= 2) {
    emoji = '🔥'
    note = 'Trade running beautifully!'
  }
  if (mult >= 3) {
    emoji = '🚀'
    note = 'Consider locking profits!'
  }
  if (mult >= 4) {
    emoji = '💎'
    note = 'Exceptional move! Secure profits!'
  }

  return `${emoji} 1:${mult} RR REACHED!

╔══════════════════════════╗
  🀄  ${tag}  ${isShort ? 'SHORT 🔴' : 'LONG 🟢'}
╚══════════════════════════╝

📍 Entry: ${t.entry}
⚖️  1:${mult} Level: ~${rrPrice}

┌─────────────────────────┐
  📈 Profit: +${profPct}%
  ⚖️  R:R   ›  1:${mult}
  💰 Risk: ${t.riskPct}% of balance
└─────────────────────────┘

💡 ${note}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 CryptoSignal PRO`
}

function buildSLMessage(t) {
  const isShort = t.side === 'SHORT'
  const tag = '#' + t.coin.replace('/', '').replace('.P', '')
  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100).toFixed(2)

  return `🛑 STOP LOSS HIT

╔══════════════════════════╗
  🀄  ${tag}  ${isShort ? 'SHORT 🔴' : 'LONG 🟢'}
╚══════════════════════════╝

📍 Entry: ${t.entry}
🛑 SL Hit: ${t.exitPrice || t.sl}

┌─────────────────────────┐
  📉 Loss: -${lossPct}%
  💰 Risk: ${t.riskPct}% of balance
└─────────────────────────┘

💪 Losses are part of trading.
   Stay disciplined. Next trade!

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 CryptoSignal PRO`
}

function buildResultMessage(t) {
  const isShort = t.side === 'SHORT'
  const tag = '#' + t.coin.replace('/', '').replace('.P', '')
  const isWin = t.status === 'WIN'
  const pnl = t.profit?.toFixed(2) || '0.00'
  const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100)
  const rr = t.profit ? (Math.abs(t.profit) / lossPct).toFixed(2) : '0'

  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']
  const tpSummary = t.tps
    .map((tp, i) => {
      const hit = (t.hitTPs || []).includes(i)
      const pct = Math.abs(((tp - t.entry) / t.entry) * 100).toFixed(2)
      return `  ${hit ? medals[i] : '⬜'} TP${i + 1} › ${tp} (+${pct}%) ${hit ? '✓' : '—'}`
    })
    .join('\n')

  const header = isWin ? `🏆 TRADE CLOSED - WIN!` : `🛑 TRADE CLOSED - LOSS`
  const motive = isWin
    ? `🎉 Excellent execution!`
    : `💪 Losses happen. Protect capital.`

  return `${header}

╔══════════════════════════╗
  🀄  ${tag}  ${isShort ? 'SHORT 🔴' : 'LONG 🟢'}
╚══════════════════════════╝

📍 Entry: ${t.entry}
🏁 Exit: ${t.exitPrice}

TP Results:
${tpSummary}
  🛑 SL › ${t.sl}

┌─────────────────────────┐
  ${isWin ? '📈 Profit' : '📉 Loss'}: ${pnl}%
  ⚖️  R:R   ›  1:${rr}
  💰 Risk: ${t.riskPct}% of balance
  🤖 ${t.autoTriggered ? '⚡ Auto' : '🖐 Manual'}
└─────────────────────────┘

${motive}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 CryptoSignal PRO`
}

// ─── COPY & SHARE ───
function copySignal() {
  const output = document.getElementById('signal-output')
  if (!output?.value) return

  navigator.clipboard
    .writeText(output.value)
    .then(() => {
      showToast('Signal copied!', 'success')
    })
    .catch(() => {
      output.select()
      document.execCommand('copy')
      showToast('Signal copied!', 'success')
    })
}

function shareTelegram() {
  const text = document.getElementById('signal-output')?.value
  if (!text) return

  const url = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}

// ─── PRICE MONITORING ───
function startPriceMonitor() {
  if (state.priceMonitorInterval) clearInterval(state.priceMonitorInterval)
  state.priceMonitorInterval = setInterval(checkPrices, 5000)
  checkPrices()
}

async function checkPrices() {
  const openTrades = state.trades.filter(
    (t) => t.status === 'OPEN' && !t.manualMode,
  )
  if (openTrades.length === 0) return

  const symbols = [...new Set(openTrades.map((t) => toBinanceSymbol(t.coin)))]

  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(symbols)}`
    const response = await fetch(url)
    const data = await response.json()

    const prices = {}
    if (Array.isArray(data)) {
      data.forEach((d) => (prices[d.symbol] = parseFloat(d.price)))
    }

    let changed = false

    openTrades.forEach((trade) => {
      const price = prices[toBinanceSymbol(trade.coin)]
      if (!price) return

      const isShort = trade.side === 'SHORT'

      // Check SL
      const slHit = isShort ? price >= trade.sl : price <= trade.sl
      if (slHit) {
        closeTrade(trade, 'LOSS', price)
        changed = true
        return
      }

      // Check R:R milestones
      const lossPct = Math.abs(((trade.sl - trade.entry) / trade.entry) * 100)
      const currentProfPct = Math.abs(
        ((price - trade.entry) / trade.entry) * 100,
      )
      const currentRR = currentProfPct / lossPct

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

      // Check TPs
      trade.tps.forEach((tp, idx) => {
        if ((trade.hitTPs || []).includes(idx)) return

        const tpHit = isShort ? price <= tp : price >= tp
        if (!tpHit) return

        if (!trade.hitTPs) trade.hitTPs = []
        if (!trade.tpMessages) trade.tpMessages = {}

        trade.hitTPs.push(idx)
        trade.tpMessages[idx] = buildTPHitMessage(trade, idx, price)
        changed = true

        showToast(`🎯 ${trade.coin} TP${idx + 1} hit!`, 'success', 5000)

        // Auto-close if all TPs hit
        if (trade.hitTPs.length === trade.tps.length) {
          closeTrade(trade, 'WIN', price)
        }
      })

      // Update live price display
      updateLivePrice(trade.id, price)
    })

    if (changed) {
      saveTrades()
      renderHistory()
      updateAnalytics()
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
  const rawProfit = isShort
    ? ((trade.entry - exitPrice) / trade.entry) * 100
    : ((exitPrice - trade.entry) / trade.entry) * 100

  trade.profit = parseFloat(rawProfit.toFixed(2))
  trade.resultMessage = buildResultMessage(trade)

  const msg =
    status === 'WIN'
      ? `🏆 ${trade.coin} WIN! +${trade.profit}%`
      : `🛑 ${trade.coin} SL hit ${trade.profit}%`

  showToast(msg, status === 'WIN' ? 'success' : 'error', 7000)
}

function toBinanceSymbol(coin) {
  return coin.replace('/USDT.P', 'USDT').replace('/USDT', 'USDT').toUpperCase()
}

function updateLivePrice(id, price) {
  const el = document.getElementById(`live-${id}`)
  if (el)
    el.textContent = `$${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
}

// ─── TRADE HISTORY ───
function renderHistory() {
  const container = document.getElementById('history-list')
  if (!container) return

  const filter = document.getElementById('history-filter')?.value || 'all'
  const search =
    document.getElementById('history-search')?.value.toLowerCase() || ''

  let filtered = state.trades
  if (filter !== 'all')
    filtered = filtered.filter((t) => t.status.toLowerCase() === filter)
  if (search)
    filtered = filtered.filter(
      (t) =>
        t.coin.toLowerCase().includes(search) ||
        (t.note && t.note.toLowerCase().includes(search)),
    )

  if (filtered.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <p>${state.trades.length === 0 ? 'No trades yet. Generate your first signal!' : 'No trades match your filter.'}</p>
            </div>`
    return
  }

  container.innerHTML = filtered
    .map((trade) => {
      const isShort = trade.side === 'SHORT'
      const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅']

      // TP status rows
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

          return `
                <div class="tp-row-status">
                    <span class="tp-medal">${hit ? medals[i] : '⬜'}</span>
                    <span class="tp-label">TP${i + 1}</span>
                    <span class="tp-price">${tp}</span>
                    <span class="tp-pct">+${pct}%</span>
                    <span class="tp-rr">1:${rr}</span>
                    <span class="tp-state ${hit ? 'hit' : 'pending'}">${hit ? '✓ HIT' : 'Pending'}</span>
                </div>
            `
        })
        .join('')

      // Result bar
      let resultBar = ''
      if (trade.profit !== null) {
        const isWin = trade.profit >= 0
        resultBar = `
                <div class="result-bar ${isWin ? 'win' : 'loss'}">
                    <span class="result-pnl ${isWin ? 'pos' : 'neg'}">${isWin ? '+' : ''}${trade.profit}%</span>
                    <div class="result-details">
                        <span class="rr-pill">1:${(Math.abs(trade.profit) / Math.abs(((trade.sl - trade.entry) / trade.entry) * 100)).toFixed(1)}</span>
                        ${trade.autoTriggered ? '<span class="badge badge-auto">⚡ AUTO</span>' : ''}
                    </div>
                </div>
            `
      }

      // Action buttons
      let actions = ''
      if (trade.status === 'OPEN') {
        actions = `
                <div class="trade-actions">
                    <button class="btn-trade win" onclick="manualClose(${trade.id}, 'WIN')">
                        <i class="fas fa-check"></i> Mark Win
                    </button>
                    <button class="btn-trade loss" onclick="manualClose(${trade.id}, 'LOSS')">
                        <i class="fas fa-times"></i> Mark Loss
                    </button>
                    <button class="btn-trade edit" onclick="editTrade(${trade.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-trade edit" onclick="deleteTrade(${trade.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `
      } else {
        actions = `
                <div class="trade-actions">
                    <button class="btn-trade edit" onclick="deleteTrade(${trade.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `
      }

      // Message buttons
      const msgButtons = []
      if (trade.status === 'OPEN') {
        msgButtons.push({ type: 'signal', label: '📊 Signal', class: 'signal' })

        // R:R milestones
        const milestones = getMilestones(trade)
        milestones.forEach((m) => {
          const hit = (trade.hitRRs || []).includes(m)
          msgButtons.push({
            type: 'rr',
            label: `${hit ? '✅' : '⚖️'} 1:${m}`,
            class: hit ? 'rr hit' : 'rr',
            data: m,
          })
        })

        // Hit TPs
        ;(trade.hitTPs || []).forEach((idx) => {
          msgButtons.push({
            type: 'tp',
            label: `🎯 TP${idx + 1}`,
            class: 'tp',
            data: idx,
          })
        })
      } else {
        msgButtons.push({
          type: 'signal',
          label: '📊 Original',
          class: 'signal',
        })
        if (trade.status === 'LOSS') {
          msgButtons.push({ type: 'sl', label: '🛑 SL Message', class: 'sl' })
        }
        msgButtons.push({ type: 'result', label: '🏁 Result', class: 'result' })
      }

      const msgRow =
        msgButtons.length > 0
          ? `
            <div class="msg-row">
                ${msgButtons
                  .map(
                    (btn) => `
                    <button class="btn-msg ${btn.class}" onclick="showMessage(${trade.id}, '${btn.type}', ${btn.data !== undefined ? btn.data : 'null'})">
                        ${btn.label}
                    </button>
                `,
                  )
                  .join('')}
            </div>
        `
          : ''

      return `
            <div class="trade-card status-${trade.status.toLowerCase()}" id="trade-${trade.id}">
                <div class="trade-header">
                    <div class="trade-info">
                        <h4>
                            ${trade.coin}
                            ${trade.status === 'OPEN' ? `<span class="live-price" id="live-${trade.id}">● Live</span>` : ''}
                        </h4>
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
                    <div class="level-item">
                        <span class="level-label">Entry</span>
                        <span class="level-value">${trade.entry}</span>
                    </div>
                    <div class="level-item">
                        <span class="level-label">Stop Loss</span>
                        <span class="level-value sl">${trade.sl}</span>
                    </div>
                    <div class="level-item">
                        <span class="level-label">Risk</span>
                        <span class="level-value">${trade.riskPct}%</span>
                    </div>
                </div>
                
                <div class="tp-status">
                    <div class="tp-status-header">
                        <span>Take Profits</span>
                        <span>${(trade.hitTPs || []).length}/${trade.tps.length} Hit</span>
                    </div>
                    ${tpRows}
                </div>
                
                ${trade.note ? `<div style="padding: 12px 20px; font-size: 13px; color: var(--text-secondary); border-bottom: 1px solid var(--border-color);">💬 ${trade.note}</div>` : ''}
                
                ${resultBar}
                ${actions}
                ${msgRow}
            </div>
        `
    })
    .join('')
}

function getMilestones(trade) {
  const lossPct = Math.abs(((trade.sl - trade.entry) / trade.entry) * 100)
  const maxTpPct = Math.max(
    ...trade.tps.map((tp) =>
      Math.abs(((tp - trade.entry) / trade.entry) * 100),
    ),
  )
  const maxRR = Math.floor(maxTpPct / lossPct)

  const milestones = []
  for (let i = 1; i <= Math.min(maxRR, 5); i++) milestones.push(i)
  return milestones
}

function manualClose(id, status) {
  const trade = state.trades.find((t) => t.id === id)
  if (!trade || trade.status !== 'OPEN') return

  const defaultPrice =
    status === 'WIN' ? trade.tps[trade.tps.length - 1] : trade.sl
  const input = prompt(`Exit price (default: ${defaultPrice}):`, defaultPrice)
  if (input === null) return

  const exitPrice = parseFloat(input) || defaultPrice
  closeTrade(trade, status, exitPrice)
  saveTrades()
  renderHistory()
  updateAnalytics()
  updateQuickStats()
}

function editTrade(id) {
  const trade = state.trades.find((t) => t.id === id)
  if (!trade || trade.status !== 'OPEN') return

  // Load into form
  document.getElementById('coin-input').value = trade.coin
  document.getElementById('side-select').value = trade.side.toLowerCase()
  document.getElementById('order-type').value =
    trade.orderType === 'Limit Order' ? 'limit' : 'market'
  document.getElementById('entry-price').value = trade.entry
  document.getElementById('stop-loss').value = trade.sl
  document.getElementById('break-even').value =
    trade.be !== 'None' ? trade.be : ''
  document.getElementById('leverage').value = trade.leverage
  document.getElementById('risk-pct').value = trade.riskPct
  document.getElementById('signal-note').value = trade.note || ''
  document.getElementById('manual-mode').checked = trade.manualMode

  // Set TPs
  while (state.currentTPs > 1) removeTP(document.querySelector('.tp-remove'))
  document.querySelector('.tp-input').value = trade.tps[0]

  for (let i = 1; i < trade.tps.length; i++) {
    addTP()
    document.querySelectorAll('.tp-input')[i].value = trade.tps[i]
  }

  // Remove old trade
  state.trades = state.trades.filter((t) => t.id !== id)
  saveTrades()

  showSection('signals')
  calculateRisk()
  showToast('Trade loaded for editing', 'info')
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

  let title, content

  switch (type) {
    case 'signal':
      title = '📊 Original Signal'
      content = buildOpenMessage(trade)
      break
    case 'tp':
      title = `🎯 TP${data + 1} Hit Message`
      content =
        trade.tpMessages?.[data] ||
        buildTPHitMessage(trade, data, trade.tps[data])
      break
    case 'rr':
      title = `⚖️ 1:${data} RR Update`
      content = buildRRMessage(trade, data)
      break
    case 'sl':
      title = '🛑 Stop Loss Message'
      content = buildSLMessage(trade)
      break
    case 'result':
      title = '🏁 Final Result'
      content = trade.resultMessage || buildResultMessage(trade)
      break
  }

  document.getElementById('msg-modal-title').textContent = title
  document.getElementById('msg-modal-content').value = content
  document.getElementById('msg-modal').classList.add('show')
}

function closeModal() {
  document.getElementById('msg-modal')?.classList.remove('show')
}

function copyFromModal() {
  const content = document.getElementById('msg-modal-content')
  navigator.clipboard.writeText(content.value).then(() => {
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

  const grossProfit = wins.reduce((sum, t) => sum + (t.profit || 0), 0)
  const grossLoss = Math.abs(
    closed
      .filter((t) => t.status === 'LOSS')
      .reduce((sum, t) => sum + (t.profit || 0), 0),
  )
  const profitFactor =
    grossLoss > 0
      ? (grossProfit / grossLoss).toFixed(2)
      : grossProfit > 0
        ? '∞'
        : '0'

  const totalPnL = closed.reduce((sum, t) => sum + (t.profit || 0), 0)

  document.getElementById('analytic-total').textContent = state.trades.length
  document.getElementById('analytic-winrate').textContent = winRate + '%'
  document.getElementById('analytic-pf').textContent = profitFactor
  document.getElementById('analytic-pnl').textContent =
    (totalPnL >= 0 ? '+' : '') + totalPnL.toFixed(2) + '%'
  document.getElementById('analytic-pnl').className =
    'analytic-value ' + (totalPnL >= 0 ? 'win' : 'loss')
  document.getElementById('analytic-open').textContent = state.trades.filter(
    (t) => t.status === 'OPEN',
  ).length
  document.getElementById('analytic-closed').textContent = closed.length

  // Update chart
  updateChart()

  // Update R:R distribution
  updateRRDistribution(closed)
}

function updateQuickStats() {
  const closed = state.trades.filter((t) => t.status !== 'OPEN')
  const wins = closed.filter((t) => t.status === 'WIN')
  const winRate = closed.length
    ? ((wins.length / closed.length) * 100).toFixed(0)
    : 0
  const totalPnL = closed.reduce((sum, t) => sum + (t.profit || 0), 0)

  document.getElementById('stat-open').textContent = state.trades.filter(
    (t) => t.status === 'OPEN',
  ).length
  document.getElementById('stat-winrate').textContent = winRate + '%'
  document.getElementById('stat-pnl').textContent =
    (totalPnL >= 0 ? '+' : '') + totalPnL.toFixed(1) + '%'
  document.getElementById('stat-pnl').className =
    'stat-value ' + (totalPnL >= 0 ? 'win' : 'loss')
  document.getElementById('nav-open-count').textContent = state.trades.filter(
    (t) => t.status === 'OPEN',
  ).length
}

function updateChart() {
  const ctx = document.getElementById('performance-chart')
  if (!ctx) return

  // Group by month
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
  if (labels.length === 0) {
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
          backgroundColor: 'rgba(0, 212, 170, 0.8)',
          borderRadius: 6,
        },
        {
          label: 'Losses',
          data: labels.map((m) => monthly[m].losses),
          backgroundColor: 'rgba(255, 71, 87, 0.8)',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter' } },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b' },
          grid: { color: '#2d3748' },
        },
        y: {
          ticks: { color: '#64748b', stepSize: 1 },
          grid: { color: '#2d3748' },
        },
      },
    },
  })
}

function updateRRDistribution(closed) {
  const ranges = { r1: 0, r2: 0, r3: 0 } // 1-2, 2-3, 3+

  closed.forEach((t) => {
    const lossPct = Math.abs(((t.sl - t.entry) / t.entry) * 100)
    const profitPct = Math.abs(t.profit)
    const rr = profitPct / lossPct

    if (rr < 2) ranges.r1++
    else if (rr < 3) ranges.r2++
    else ranges.r3++
  })

  const total = closed.length || 1
  document.getElementById('rr-bar-1').style.width =
    `${(ranges.r1 / total) * 100}%`
  document.getElementById('rr-count-1').textContent = ranges.r1
  document.getElementById('rr-bar-2').style.width =
    `${(ranges.r2 / total) * 100}%`
  document.getElementById('rr-count-2').textContent = ranges.r2
  document.getElementById('rr-bar-3').style.width =
    `${(ranges.r3 / total) * 100}%`
  document.getElementById('rr-count-3').textContent = ranges.r3
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
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`,
    )
    const data = await response.json()

    // Update market grid
    const grid = document.getElementById('market-grid')
    if (grid) {
      grid.innerHTML = data
        .map((item) => {
          const price = parseFloat(item.lastPrice)
          const change = parseFloat(item.priceChangePercent)
          const isUp = change >= 0
          const symbol = item.symbol.replace('USDT', '')
          const coin = COINS.find((c) => c.symbol.includes(symbol)) || {}

          state.prices[symbol] = price

          return `
                    <div class="market-card">
                        <div class="market-header">
                            <div class="market-icon" style="background: ${coin.color}20; color: ${coin.color}">
                                ${coin.icon || symbol[0]}
                            </div>
                            <div class="market-info">
                                <h4>${symbol}</h4>
                                <span>${coin.name || symbol}</span>
                            </div>
                        </div>
                        <div class="market-price">$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <span class="market-change ${isUp ? 'up' : 'down'}">
                            <i class="fas fa-arrow-${isUp ? 'up' : 'down'}"></i>
                            ${Math.abs(change).toFixed(2)}%
                        </span>
                    </div>
                `
        })
        .join('')
    }

    // Update ticker
    const tickerText = data
      .map((item) => {
        const symbol = item.symbol.replace('USDT', '')
        const price = parseFloat(item.lastPrice).toFixed(
          item.symbol.includes('BTC') ? 0 : 2,
        )
        return `${symbol} $${price}`
      })
      .join('   ·   ')

    document.getElementById('ticker-prices').textContent =
      tickerText + '   ·   ' + tickerText
  } catch (err) {
    console.error('Market data error:', err)
  }
}

async function fetchPrice(symbol) {
  try {
    const clean = toBinanceSymbol(symbol)
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${clean}`,
    )
    const data = await response.json()
    return parseFloat(data.price)
  } catch (err) {
    return null
  }
}

// ─── POSITION CALCULATOR ───
function calculatePosition() {
  const balance =
    parseFloat(document.getElementById('calc-balance')?.value) || 0
  const risk = parseFloat(document.getElementById('calc-risk')?.value) || 0
  const entry = parseFloat(document.getElementById('calc-entry')?.value) || 0
  const sl = parseFloat(document.getElementById('calc-sl')?.value) || 0

  if (!balance || !risk || !entry || !sl) {
    showToast('Please fill all fields', 'error')
    return
  }

  const riskAmount = balance * (risk / 100)
  const priceDiff = Math.abs(entry - sl)
  const positionSize = riskAmount / (priceDiff / entry)
  const coins = positionSize / entry

  document.getElementById('res-risk').textContent = '$' + riskAmount.toFixed(2)
  document.getElementById('res-size').textContent =
    '$' + positionSize.toFixed(2)
  document.getElementById('res-coins').textContent = coins.toFixed(4)
}

// ─── EXPORT/IMPORT ───
function exportData() {
  const data = JSON.stringify(state.trades, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
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
      if (Array.isArray(data)) {
        state.trades = data
        saveTrades()
        renderHistory()
        updateAnalytics()
        updateQuickStats()
        showToast(`Imported ${data.length} trades!`, 'success')
      } else {
        throw new Error('Invalid format')
      }
    } catch (err) {
      showToast('Invalid file format', 'error')
    }
  }
  reader.readAsText(file)
}

function clearAllData() {
  if (!confirm('⚠️ DELETE ALL TRADES? This cannot be undone!')) return
  if (prompt('Type DELETE to confirm:') !== 'DELETE') {
    showToast('Cancelled', 'info')
    return
  }

  state.trades = []
  localStorage.removeItem('csp_trades')
  renderHistory()
  updateAnalytics()
  updateQuickStats()
  showToast('All data cleared', 'info')
}

// ─── UTILITIES ───
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast')
  if (!toast) return

  toast.textContent = message
  toast.className = `toast ${type} show`

  setTimeout(() => toast.classList.remove('show'), duration)
}
