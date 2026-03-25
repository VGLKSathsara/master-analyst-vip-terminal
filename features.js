// ════════════════════════════════════════════════════════════
//  MASTER ANALYST VIP  ·  features.js  v1.0
//
//  NEW FEATURES:
//    1. Trailing Stop Loss Tracker
//    2. Partial TP Close Calculator
//    3. Trade Journal (mood + confluence tags)
//    4. Binance PnL Sync (read-only API key)
//
//  HOW TO ADD TO YOUR APP:
//    • Add <script src="features.js"></script> after app.js in index.html
//    • Paste the HTML snippets (below each section) into index.html
//    • Paste the CSS block at the bottom into style.css
// ════════════════════════════════════════════════════════════

// ── SHARED HELPERS (safe if app.js already loaded) ──────────
const _fmt = (n, d = 4) => parseFloat(parseFloat(n).toFixed(d))
const _fmtStr = (n, d = 2) => parseFloat(n).toFixed(d)

// ════════════════════════════════════════════════════════════
//  FEATURE 1 — TRAILING STOP LOSS TRACKER
//
//  Tracks an ATR-based or fixed-% trailing SL for any open trade.
//  As price moves in your favour, the trailing SL steps up/down
//  automatically and shows the current recommended SL price.
//
//  State is stored in localStorage under 'ma_trailing'
// ════════════════════════════════════════════════════════════

let trailingData = JSON.parse(localStorage.getItem('ma_trailing') || '{}')
// Shape: { [tradeId]: { mode:'pct'|'atr', value: number, peakPrice: number, currentSL: number } }

function saveTrailing() {
  localStorage.setItem('ma_trailing', JSON.stringify(trailingData))
}

// Called when user enables trailing SL for a trade
function enableTrailingSL(tradeId) {
  const trade = trades.find((t) => t.id === tradeId)
  if (!trade || trade.status !== 'OPEN') return

  const mode = document.getElementById(`trail-mode-${tradeId}`)?.value || 'pct'
  const val = parseFloat(
    document.getElementById(`trail-val-${tradeId}`)?.value || '',
  )

  if (!Number.isFinite(val) || val <= 0) {
    toast('❌ Enter a valid trailing value', 'error')
    return
  }

  const price = liveprices[toBinanceSym(trade.coin)] || parseFloat(trade.entry)
  const short = tradeIsShort(trade)

  // initialSL = current SL; peakPrice = best price seen so far
  trailingData[tradeId] = {
    mode,
    value: val,
    peakPrice: price,
    currentSL: calculateTrailingSL(trade, price, price, mode, val),
    enabled: true,
    short,
  }

  saveTrailing()
  renderTrailingSLBadge(tradeId)
  toast(
    `✅ Trailing SL activated — ${mode === 'pct' ? val + '%' : val + ' pts'} trail`,
    'success',
  )
}

function disableTrailingSL(tradeId) {
  delete trailingData[tradeId]
  saveTrailing()
  renderTrailingSLBadge(tradeId)
  toast('Trailing SL removed', 'info')
}

// Core trailing SL calculation
function calculateTrailingSL(trade, currentPrice, peakPrice, mode, value) {
  const short = tradeIsShort(trade)
  if (mode === 'pct') {
    // Trail by % distance from peak
    const mult = value / 100
    return short
      ? _fmt(peakPrice * (1 + mult)) // short: SL above peak (best = lowest)
      : _fmt(peakPrice * (1 - mult)) // long:  SL below peak (best = highest)
  } else {
    // Trail by fixed price points
    return short ? _fmt(peakPrice + value) : _fmt(peakPrice - value)
  }
}

// Called every price-monitor tick to update trailing SL
function updateTrailingSLs(openTrades) {
  let changed = false
  openTrades.forEach((trade) => {
    const td = trailingData[trade.id]
    if (!td || !td.enabled) return

    const price = liveprices[toBinanceSym(trade.coin)]
    if (!price || !Number.isFinite(price)) return

    const short = tradeIsShort(trade)
    let updated = false

    // Update peak price if price has moved in our favour
    if (short ? price < td.peakPrice : price > td.peakPrice) {
      td.peakPrice = price
      updated = true
    }

    if (updated) {
      const newSL = calculateTrailingSL(
        trade,
        price,
        td.peakPrice,
        td.mode,
        td.value,
      )
      // Only move SL in profit direction, never backwards
      const slImproved = short ? newSL < td.currentSL : newSL > td.currentSL
      if (slImproved) {
        td.currentSL = newSL
        changed = true
        renderTrailingSLBadge(trade.id)
      }
    }

    // Check if trailing SL got hit
    const slHit = short ? price >= td.currentSL : price <= td.currentSL
    if (slHit) {
      toast(
        `🔔 Trailing SL hit for ${trade.coin} @ ${price.toLocaleString()}!`,
        'error',
        7000,
      )
      // Don't auto-close here — surface only; trader decides
    }
  })

  if (changed) saveTrailing()
}

function renderTrailingSLBadge(tradeId) {
  const el = document.getElementById(`trail-badge-${tradeId}`)
  if (!el) return
  const td = trailingData[tradeId]
  if (!td) {
    el.innerHTML = ''
    return
  }
  el.innerHTML = `
    <div class="trail-active-badge">
      <span class="trail-icon">⟳</span>
      <span class="trail-label">Trail SL</span>
      <span class="trail-sl-price">${td.currentSL}</span>
      <span class="trail-peak">Peak: ${td.peakPrice}</span>
      <button class="trail-off-btn" onclick="disableTrailingSL(${tradeId})">✕ Off</button>
    </div>`
}

// Returns the HTML panel to inject into each OPEN trade card
function buildTrailingSLPanel(tradeId) {
  const td = trailingData[tradeId]
  const hasTrail = td && td.enabled

  return `
  <div class="trail-panel" id="trail-panel-${tradeId}">
    <div class="trail-header">
      <span class="trail-title">⟳ Trailing Stop Loss</span>
    </div>
    <div id="trail-badge-${tradeId}">${
      hasTrail
        ? (() => {
            renderTrailingSLBadge(tradeId)
            return ''
          })()
        : ''
    }</div>
    ${
      hasTrail
        ? ''
        : `
    <div class="trail-setup">
      <select id="trail-mode-${tradeId}" class="trail-select">
        <option value="pct">% Distance</option>
        <option value="pts">Fixed Points</option>
      </select>
      <input id="trail-val-${tradeId}" type="number" step="any" placeholder="e.g. 1.5" class="trail-input"/>
      <button class="trail-enable-btn" onclick="enableTrailingSL(${tradeId})">Activate</button>
    </div>`
    }
  </div>`
}

// ════════════════════════════════════════════════════════════
//  FEATURE 2 — PARTIAL TP CLOSE CALCULATOR
//
//  For each TP level the user can define what % of position
//  to close. Shows remaining position size and average exit
//  price across all partial closes.
// ════════════════════════════════════════════════════════════

// partialData shape: { [tradeId]: { allocations: [30, 40, 30], posSize: 100 } }
let partialData = JSON.parse(localStorage.getItem('ma_partial') || '{}')

function savePartial() {
  localStorage.setItem('ma_partial', JSON.stringify(partialData))
}

function openPartialModal(tradeId) {
  const trade = trades.find((t) => t.id === tradeId)
  if (!trade) return

  const existing = partialData[tradeId] || {
    allocations: trade.tps.map(() => Math.floor(100 / trade.tps.length)),
    posSize: 100,
  }
  partialData[tradeId] = existing

  const tpRows = trade.tps
    .map((tp, i) => {
      const profPct = _fmtStr(Math.abs(calcProfitPct(trade, tp)))
      const alloc = existing.allocations[i] || 0
      return `
    <div class="partial-row">
      <span class="partial-tp-label">TP ${i + 1} — ${tp} (+${profPct}%)</span>
      <div class="partial-input-wrap">
        <input type="number" id="partial-alloc-${tradeId}-${i}" value="${alloc}" min="0" max="100" step="1"
          oninput="updatePartialSummary(${tradeId})" class="partial-input"/>
        <span class="partial-pct">%</span>
      </div>
    </div>`
    })
    .join('')

  const modal = document.getElementById('partial-modal')
  document.getElementById('partial-modal-title').textContent =
    `Partial Close — ${trade.coin}`
  document.getElementById('partial-modal-body').innerHTML = `
    <div class="partial-pos-row">
      <label class="partial-pos-label">Position Size ($)</label>
      <input type="number" id="partial-pos-${tradeId}" value="${existing.posSize}" min="1" step="any"
        oninput="updatePartialSummary(${tradeId})" class="partial-input" style="width:120px"/>
    </div>
    <div class="partial-tp-list">${tpRows}</div>
    <div id="partial-summary-${tradeId}" class="partial-summary"></div>
    <div class="partial-actions">
      <button class="btn-partial-save" onclick="savePartialAlloc(${tradeId})">💾 Save</button>
      <button class="btn-partial-cancel" onclick="closePartialModal()">Cancel</button>
    </div>`

  modal.classList.add('show')
  modal._tradeId = tradeId
  updatePartialSummary(tradeId)
}

function closePartialModal() {
  document.getElementById('partial-modal')?.classList.remove('show')
}

function updatePartialSummary(tradeId) {
  const trade = trades.find((t) => t.id === tradeId)
  if (!trade) return

  const posSize = parseFloat(
    document.getElementById(`partial-pos-${tradeId}`)?.value || '100',
  )
  const allocs = trade.tps.map((_, i) =>
    parseFloat(
      document.getElementById(`partial-alloc-${tradeId}-${i}`)?.value || '0',
    ),
  )
  const totalAlloc = allocs.reduce((a, b) => a + b, 0)
  const remaining = Math.max(0, 100 - totalAlloc)

  // Weighted average exit price
  let weightedSum = 0
  let weightedTotal = 0
  allocs.forEach((alloc, i) => {
    if (alloc > 0) {
      weightedSum += parseFloat(trade.tps[i]) * alloc
      weightedTotal += alloc
    }
  })
  const avgExit = weightedTotal > 0 ? _fmt(weightedSum / weightedTotal) : '—'

  // Weighted avg profit %
  const short = tradeIsShort(trade)
  let totalProfit = 0
  allocs.forEach((alloc, i) => {
    if (alloc > 0) {
      const p = Math.abs(calcProfitPct(trade, trade.tps[i]))
      totalProfit += p * (alloc / 100)
    }
  })

  const el = document.getElementById(`partial-summary-${tradeId}`)
  if (!el) return

  const warn =
    totalAlloc > 100
      ? `<div class="partial-warn">⚠️ Total exceeds 100% — reduce allocations</div>`
      : ''

  el.innerHTML = `
    ${warn}
    <div class="partial-stat-grid">
      <div class="partial-stat">
        <span class="partial-stat-label">Total Closed</span>
        <span class="partial-stat-val ${totalAlloc > 100 ? 'over' : ''}">${totalAlloc.toFixed(0)}%</span>
      </div>
      <div class="partial-stat">
        <span class="partial-stat-label">Remaining</span>
        <span class="partial-stat-val">${remaining.toFixed(0)}%</span>
      </div>
      <div class="partial-stat">
        <span class="partial-stat-label">Avg Exit Price</span>
        <span class="partial-stat-val">${avgExit}</span>
      </div>
      <div class="partial-stat">
        <span class="partial-stat-label">Blended Profit</span>
        <span class="partial-stat-val pos">+${totalProfit.toFixed(2)}%</span>
      </div>
    </div>
    ${allocs
      .map((a, i) => {
        const closeUSD = ((a / 100) * posSize).toFixed(2)
        return a > 0
          ? `<div class="partial-breakdown">TP${i + 1}: Close $${closeUSD} (${a}%)</div>`
          : ''
      })
      .join('')}`
}

function savePartialAlloc(tradeId) {
  const trade = trades.find((t) => t.id === tradeId)
  if (!trade) return
  const allocs = trade.tps.map((_, i) =>
    parseFloat(
      document.getElementById(`partial-alloc-${tradeId}-${i}`)?.value || '0',
    ),
  )
  const posSize = parseFloat(
    document.getElementById(`partial-pos-${tradeId}`)?.value || '100',
  )
  const total = allocs.reduce((a, b) => a + b, 0)
  if (total > 100) {
    toast('❌ Total allocation exceeds 100%', 'error')
    return
  }
  partialData[tradeId] = { allocations: allocs, posSize }
  savePartial()
  closePartialModal()
  toast('✅ Partial TP plan saved', 'success')
}

// ════════════════════════════════════════════════════════════
//  FEATURE 3 — TRADE JOURNAL
//
//  Attach per-trade journal entries with:
//    • Mood (confident / neutral / anxious / FOMO / disciplined)
//    • ICT Confluence tags (OB, FVG, BOS, CHoCH, MSS, Liquidity, etc.)
//    • Free-text reasoning / lesson
//    • Post-trade reflection (after close)
//
//  Stored under 'ma_journal' in localStorage
// ════════════════════════════════════════════════════════════

const JOURNAL_MOODS = [
  '😤 Confident',
  '😐 Neutral',
  '😰 Anxious',
  '🤑 FOMO',
  '🧘 Disciplined',
  '😤 Revenge',
]
const JOURNAL_TAGS = [
  'Order Block',
  'FVG',
  'BOS',
  'CHoCH',
  'MSS',
  'Liquidity Sweep',
  'Equal Highs',
  'Equal Lows',
  'NWOG',
  'NDOG',
  'Breaker Block',
  'Mitigation',
  'Imbalance',
  'Premium',
  'Discount',
  'KZ Alignment',
  'HTF Bias',
  'Session Open',
  'News Avoidance',
]

let journalData = JSON.parse(localStorage.getItem('ma_journal') || '{}')
// Shape: { [tradeId]: { mood, tags:[], reasoning, reflection, ts } }

function saveJournal() {
  localStorage.setItem('ma_journal', JSON.stringify(journalData))
}

function openJournalModal(tradeId) {
  const trade = trades.find((t) => t.id === tradeId)
  if (!trade) return
  const j = journalData[tradeId] || {
    mood: '',
    tags: [],
    reasoning: '',
    reflection: '',
  }

  const moodBtns = JOURNAL_MOODS.map((m) => {
    const active = j.mood === m ? 'active' : ''
    return `<button class="mood-btn ${active}" onclick="selectMood(${tradeId},'${m}')" id="mood-${tradeId}-${m.replace(/[^a-z]/gi, '')}">${m}</button>`
  }).join('')

  const tagBtns = JOURNAL_TAGS.map((tag) => {
    const active = (j.tags || []).includes(tag) ? 'active' : ''
    const safe = tag.replace(/\s+/g, '-')
    return `<button class="jtag-btn ${active}" onclick="toggleJTag(${tradeId},'${tag}')" id="jtag-${tradeId}-${safe}">${tag}</button>`
  }).join('')

  const isOpen = trade.status === 'OPEN'

  document.getElementById('journal-modal-title').textContent =
    `📓 Journal — ${trade.coin}`
  document.getElementById('journal-modal-body').innerHTML = `
    <div class="journal-section">
      <div class="journal-section-label">Mindset at entry</div>
      <div class="mood-grid">${moodBtns}</div>
    </div>
    <div class="journal-section">
      <div class="journal-section-label">ICT Confluence</div>
      <div class="jtag-grid">${tagBtns}</div>
    </div>
    <div class="journal-section">
      <div class="journal-section-label">Pre-trade reasoning</div>
      <textarea id="journal-reason-${tradeId}" class="journal-textarea" placeholder="Why did you take this trade? What was your bias?">${j.reasoning || ''}</textarea>
    </div>
    ${
      !isOpen
        ? `
    <div class="journal-section">
      <div class="journal-section-label">Post-trade reflection</div>
      <textarea id="journal-reflect-${tradeId}" class="journal-textarea" placeholder="What went well? What would you do differently?">${j.reflection || ''}</textarea>
    </div>`
        : ''
    }
    <div class="journal-actions">
      <button class="btn-journal-save" onclick="saveJournalEntry(${tradeId}, ${!isOpen})">💾 Save Entry</button>
      <button class="btn-journal-cancel" onclick="closeJournalModal()">Cancel</button>
    </div>`

  document.getElementById('journal-modal').classList.add('show')
  document.getElementById('journal-modal')._tradeId = tradeId
}

function closeJournalModal() {
  document.getElementById('journal-modal')?.classList.remove('show')
}

function selectMood(tradeId, mood) {
  const j = journalData[tradeId] || {
    mood: '',
    tags: [],
    reasoning: '',
    reflection: '',
  }
  j.mood = mood
  journalData[tradeId] = j
  // Update button styles
  JOURNAL_MOODS.forEach((m) => {
    const btn = document.getElementById(
      `mood-${tradeId}-${m.replace(/[^a-z]/gi, '')}`,
    )
    if (btn) btn.classList.toggle('active', m === mood)
  })
}

function toggleJTag(tradeId, tag) {
  if (!journalData[tradeId])
    journalData[tradeId] = { mood: '', tags: [], reasoning: '', reflection: '' }
  const j = journalData[tradeId]
  if (!j.tags) j.tags = []
  const idx = j.tags.indexOf(tag)
  if (idx > -1) j.tags.splice(idx, 1)
  else j.tags.push(tag)
  const safe = tag.replace(/\s+/g, '-')
  const btn = document.getElementById(`jtag-${tradeId}-${safe}`)
  if (btn) btn.classList.toggle('active', j.tags.includes(tag))
}

function saveJournalEntry(tradeId, includeReflection) {
  if (!journalData[tradeId])
    journalData[tradeId] = { mood: '', tags: [], reasoning: '', reflection: '' }
  const j = journalData[tradeId]
  j.reasoning =
    document.getElementById(`journal-reason-${tradeId}`)?.value.trim() || ''
  if (includeReflection) {
    j.reflection =
      document.getElementById(`journal-reflect-${tradeId}`)?.value.trim() || ''
  }
  j.ts = new Date().toISOString()
  saveJournal()
  closeJournalModal()
  renderHistory()
  toast('📓 Journal saved', 'success')
}

function getJournalBadge(tradeId) {
  const j = journalData[tradeId]
  if (!j || (!j.mood && !j.tags?.length && !j.reasoning)) return ''
  const tags = (j.tags || []).slice(0, 3).join(' · ')
  return `
  <div class="journal-badge">
    <span class="journal-badge-mood">${j.mood || '—'}</span>
    ${tags ? `<span class="journal-badge-tags">${tags}${j.tags.length > 3 ? ` +${j.tags.length - 3}` : ''}</span>` : ''}
    ${j.reasoning ? `<span class="journal-badge-text">"${j.reasoning.slice(0, 60)}${j.reasoning.length > 60 ? '…' : ''}"</span>` : ''}
  </div>`
}

// ════════════════════════════════════════════════════════════
//  FEATURE 4 — BINANCE PNL SYNC (read-only API key)
//
//  Uses the Binance /fapi/v2/account endpoint (futures)
//  to pull realised PnL for closed positions and match them
//  to trades in our local database by coin symbol.
//
//  Security: keys are stored in localStorage and used only
//  for GET requests. No trading permissions needed.
//  NEVER enable Spot/Margin trading permissions on this key.
// ════════════════════════════════════════════════════════════

let binanceCreds = JSON.parse(localStorage.getItem('ma_binance_creds') || '{}')
// { apiKey, apiSecret }  — apiSecret used only client-side for HMAC

async function openBinanceSyncPanel() {
  const panel = document.getElementById('binance-sync-panel')
  panel.classList.toggle('show')
  if (panel.classList.contains('show')) {
    document.getElementById('bs-apikey').value = binanceCreds.apiKey || ''
    document.getElementById('bs-apisecret').value = binanceCreds.apiSecret || ''
  }
}

async function saveBinanceCreds() {
  const key = document.getElementById('bs-apikey').value.trim()
  const secret = document.getElementById('bs-apisecret').value.trim()
  if (!key || !secret) {
    toast('❌ Both API Key and Secret required', 'error')
    return
  }
  binanceCreds = { apiKey: key, apiSecret: secret }
  localStorage.setItem('ma_binance_creds', JSON.stringify(binanceCreds))
  toast('🔑 Credentials saved (local only)', 'success')
}

// HMAC-SHA256 using WebCrypto API (no external library needed)
async function hmacSHA256(secret, message) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function syncBinancePnL() {
  if (!binanceCreds.apiKey || !binanceCreds.apiSecret) {
    toast('❌ Set your Binance API credentials first', 'error')
    return
  }

  const statusEl = document.getElementById('bs-status')
  if (statusEl) statusEl.textContent = '⟳ Syncing...'

  try {
    const ts = Date.now()
    const qString = `timestamp=${ts}&limit=500`
    const signature = await hmacSHA256(binanceCreds.apiSecret, qString)
    const url = `https://fapi.binance.com/fapi/v1/userTrades?${qString}&signature=${signature}`

    const resp = await fetch(url, {
      headers: { 'X-MBX-APIKEY': binanceCreds.apiKey },
    })

    if (!resp.ok) {
      const err = await resp.json()
      throw new Error(err.msg || `HTTP ${resp.status}`)
    }

    const binanceTrades = await resp.json()
    // binanceTrades = array of { symbol, realizedPnl, time, side, qty, price, ... }

    let matched = 0
    let results = []

    // Try to match each binance trade to our local trade records
    const open = trades.filter((t) => t.status === 'OPEN')
    open.forEach((trade) => {
      const sym = toBinanceSym(trade.coin)
      const related = binanceTrades.filter(
        (b) => b.symbol === sym && b.time >= new Date(trade.date).getTime(),
      )
      if (!related.length) return

      const totalPnl = related.reduce(
        (sum, b) => sum + parseFloat(b.realizedPnl),
        0,
      )
      const totalQty = related.reduce((sum, b) => sum + parseFloat(b.qty), 0)
      const avgExit =
        related.reduce(
          (sum, b) => sum + parseFloat(b.price) * parseFloat(b.qty),
          0,
        ) / totalQty

      results.push({ trade, totalPnl, avgExit, count: related.length })
      matched++
    })

    renderSyncResults(results, binanceTrades.length)
    if (statusEl)
      statusEl.textContent = `✅ Synced — ${matched} matches from ${binanceTrades.length} fills`
    toast(`✅ Binance sync: ${matched} trade matches found`, 'success')
  } catch (e) {
    if (statusEl) statusEl.textContent = `❌ Error: ${e.message}`
    toast(`❌ Binance sync failed: ${e.message}`, 'error', 7000)
  }
}

function renderSyncResults(results, totalFills) {
  const el = document.getElementById('bs-results')
  if (!el) return
  if (!results.length) {
    el.innerHTML = `<div class="bs-empty">No matching open trades found in recent Binance fills.</div>`
    return
  }
  el.innerHTML = results
    .map(({ trade, totalPnl, avgExit, count }) => {
      const pnlColor = totalPnl >= 0 ? 'pos' : 'neg'
      return `
    <div class="bs-result-row">
      <div class="bs-result-coin">${trade.coin}</div>
      <div class="bs-result-data">
        <span class="bs-fill-count">${count} fill${count !== 1 ? 's' : ''}</span>
        <span class="bs-avg-exit">Avg exit: ${_fmt(avgExit)}</span>
        <span class="bs-pnl ${pnlColor}">${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USDT</span>
      </div>
      <button class="bs-apply-btn" onclick="applyBinancePnL(${trade.id}, ${_fmt(avgExit)}, ${totalPnl})">Apply</button>
    </div>`
    })
    .join('')
}

function applyBinancePnL(tradeId, exitPrice, usdtPnl) {
  const trade = trades.find((t) => t.id === tradeId)
  if (!trade || trade.status !== 'OPEN') return
  const status = usdtPnl >= 0 ? 'WIN' : 'LOSS'
  const profitPct =
    ((exitPrice - parseFloat(trade.entry)) / parseFloat(trade.entry)) *
    100 *
    (tradeIsShort(trade) ? -1 : 1)

  trade.status = status
  trade.exitPrice = exitPrice
  trade.exitDate = new Date().toISOString()
  trade.profit = _fmtStr(profitPct)
  trade.autoTriggered = false
  trade.resultMessage = buildResultMessage(trade)

  saveTrades()
  renderHistory()
  updateStats()
  updateOpenBadge()
  toast(
    `✅ Applied Binance PnL to ${trade.coin} — ${status}`,
    status === 'WIN' ? 'success' : 'error',
  )
}

// ── HOOK INTO EXISTING PRICE MONITOR ─────────────────────────
// Patch checkOpenTrades to also update trailing SLs
const _origCheckOpenTrades =
  typeof checkOpenTrades !== 'undefined' ? checkOpenTrades : null
if (_origCheckOpenTrades) {
  // We wrap after the original function runs via the existing interval
  const _origInterval = setInterval(() => {
    const open = trades.filter((t) => t.status === 'OPEN')
    updateTrailingSLs(open)
  }, 5000)
}

// ── PATCH renderHistory to inject feature UI ─────────────────
// We extend the existing renderHistory function to add new panels
const _origRenderHistory =
  typeof renderHistory !== 'undefined' ? renderHistory : null

function renderFeaturesForTrade(trade) {
  if (trade.status !== 'OPEN') {
    // Closed trade: show journal badge only
    return `
    <div class="features-row closed-features">
      ${getJournalBadge(trade.id)}
      <button class="feat-btn journal-btn" onclick="openJournalModal(${trade.id})">📓 Journal</button>
    </div>`
  }

  const hasPartial = !!partialData[trade.id]
  const hasJournal = !!(
    journalData[trade.id]?.mood ||
    journalData[trade.id]?.tags?.length ||
    journalData[trade.id]?.reasoning
  )

  return `
  <div class="features-row open-features">
    ${getJournalBadge(trade.id)}
    <div class="feat-btn-row">
      <button class="feat-btn trail-btn" onclick="toggleTrailPanel(${trade.id})">⟳ Trail SL</button>
      <button class="feat-btn partial-btn ${hasPartial ? 'active' : ''}" onclick="openPartialModal(${trade.id})">⚡ Partial TP${hasPartial ? ' ✓' : ''}</button>
      <button class="feat-btn journal-btn ${hasJournal ? 'active' : ''}" onclick="openJournalModal(${trade.id})">📓 Journal${hasJournal ? ' ✓' : ''}</button>
    </div>
    <div class="trail-panel-wrap" id="trail-wrap-${trade.id}" style="display:none">
      ${buildTrailingSLPanel(trade.id)}
    </div>
  </div>`
}

function toggleTrailPanel(tradeId) {
  const el = document.getElementById(`trail-wrap-${tradeId}`)
  if (!el) return
  el.style.display = el.style.display === 'none' ? 'block' : 'none'
}

// ── INITIALISE MODALS ON DOM READY ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  injectFeatureModalsAndPanels()
})

// Fallback if DOMContentLoaded already fired
if (
  document.readyState === 'complete' ||
  document.readyState === 'interactive'
) {
  setTimeout(injectFeatureModalsAndPanels, 0)
}

function injectFeatureModalsAndPanels() {
  // Only inject once
  if (document.getElementById('partial-modal')) return

  document.body.insertAdjacentHTML(
    'beforeend',
    `

  <!-- ── PARTIAL TP MODAL ── -->
  <div id="partial-modal" class="feat-modal-overlay" onclick="if(event.target===this)closePartialModal()">
    <div class="feat-modal-box">
      <div class="feat-modal-header">
        <span id="partial-modal-title" class="feat-modal-title">Partial Close Calculator</span>
        <button class="feat-modal-close" onclick="closePartialModal()">✕</button>
      </div>
      <div id="partial-modal-body" class="feat-modal-body"></div>
    </div>
  </div>

  <!-- ── JOURNAL MODAL ── -->
  <div id="journal-modal" class="feat-modal-overlay" onclick="if(event.target===this)closeJournalModal()">
    <div class="feat-modal-box journal-modal-box">
      <div class="feat-modal-header">
        <span id="journal-modal-title" class="feat-modal-title">Trade Journal</span>
        <button class="feat-modal-close" onclick="closeJournalModal()">✕</button>
      </div>
      <div id="journal-modal-body" class="feat-modal-body"></div>
    </div>
  </div>

  <!-- ── BINANCE SYNC PANEL (injected into Stats page) ── -->
  <div id="binance-sync-panel" class="bs-panel">
    <div class="bs-panel-header">
      <span class="bs-panel-title">🔗 Binance PnL Sync</span>
      <span id="bs-status" class="bs-status">Not synced</span>
    </div>
    <div class="bs-warn">⚠️ Use a READ-ONLY API key. Never enable trading permissions.</div>
    <div class="bs-cred-row">
      <input id="bs-apikey" type="text" placeholder="API Key" class="bs-input" autocomplete="off"/>
      <input id="bs-apisecret" type="password" placeholder="API Secret" class="bs-input" autocomplete="off"/>
      <button class="bs-save-btn" onclick="saveBinanceCreds()">Save</button>
    </div>
    <button class="bs-sync-btn" onclick="syncBinancePnL()">⟳ Sync Now</button>
    <div id="bs-results" class="bs-results"></div>
  </div>
  `,
  )

  // Inject Binance Sync button into Stats section
  const dangerZone = document.querySelector('.danger-zone')
  if (dangerZone) {
    dangerZone.insertAdjacentHTML(
      'beforebegin',
      `
    <div style="margin-bottom:16px">
      <button class="mini-btn" onclick="openBinanceSyncPanel()" style="color:#f5c518;border-color:rgba(245,197,24,.3);background:rgba(245,197,24,.06)">
        🔗 Binance PnL Sync
      </button>
    </div>`,
    )
    // Move panel into stats section
    document
      .getElementById('stats')
      ?.insertBefore(document.getElementById('binance-sync-panel'), dangerZone)
  }

  // Patch renderHistory to add feature rows
  patchRenderHistory()
}

function patchRenderHistory() {
  const origRender = window.renderHistory
  if (!origRender || origRender._patched) return

  window.renderHistory = function () {
    origRender()
    // After the original renders, inject feature rows into each trade card
    document.querySelectorAll('.trade-item').forEach((card) => {
      const actions = card.querySelector('.trade-actions')
      if (!actions) return
      const idMatch = actions
        .querySelector('[onclick]')
        ?.getAttribute('onclick')
        ?.match(/\d+/)
      if (!idMatch) return
      const tradeId = parseInt(idMatch[0])
      const trade = trades.find((t) => t.id === tradeId)
      if (!trade) return

      // Only inject if not already injected
      if (card.querySelector('.features-row')) return

      const featDiv = document.createElement('div')
      featDiv.innerHTML = renderFeaturesForTrade(trade)
      // Insert before trade-actions
      card.insertBefore(featDiv.firstElementChild, actions)

      // Re-render trailing badge if active
      if (trailingData[tradeId]) renderTrailingSLBadge(tradeId)
    })
  }
  window.renderHistory._patched = true

  // Trigger initial render
  window.renderHistory()
}
