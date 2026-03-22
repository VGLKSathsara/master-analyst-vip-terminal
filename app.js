// ============ DATA MANAGEMENT ============
let trades = JSON.parse(localStorage.getItem('ma_trades')) || []
let chart = null
let kzInterval = null

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
  updateClocks()
  setInterval(updateClocks, 1000)
  initKZTracker()
  fetchMarketData()
  setInterval(fetchMarketData, 30000)
  loadCoinSuggestions()
  if (trades.length > 0) {
    updateStats()
    renderHistory()
  }
})

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

// ============ TRADE MANAGEMENT ============
function executeSignal() {
  const coin = document.getElementById('coin').value.trim()
  const side = document.getElementById('side').value
  const entry = parseFloat(document.getElementById('entry').value)
  const tp = parseFloat(document.getElementById('tp').value)
  const be = document.getElementById('be').value
  const sl = parseFloat(document.getElementById('sl').value)
  const note = document.getElementById('note').value

  // Validation
  if (!coin) return alert('❌ Asset name required')
  if (isNaN(entry) || entry <= 0) return alert('❌ Valid entry price required')
  if (isNaN(sl) || sl <= 0) return alert('❌ Valid stop loss required')
  if (isNaN(tp) || tp <= 0) return alert('❌ Valid target profit required')

  const trade = {
    id: Date.now(),
    date: new Date().toISOString(),
    coin: coin.toUpperCase(),
    side: side,
    entry: entry,
    tp: tp,
    be: be || 'None',
    sl: sl,
    note: note,
    status: 'OPEN',
    exitPrice: null,
    exitDate: null,
    profit: null,
  }

  trades.unshift(trade)
  localStorage.setItem('ma_trades', JSON.stringify(trades))

  // Generate Telegram message
  const message =
    `✅ NEW SIGNAL: ${trade.coin}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔹 Side: ${trade.side}\n` +
    `🔹 Entry: ${trade.entry}\n` +
    `🔹 TP: ${trade.tp}\n` +
    `🔹 SL: ${trade.sl}\n` +
    `${trade.be !== 'None' ? `🔹 BE: ${trade.be}\n` : ''}` +
    `${trade.note ? `📝 Note: ${trade.note}\n` : ''}` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚀 Master Analyst VIP - Trade with Confidence!`

  document.getElementById('output').value = message

  // Clear form
  document.getElementById('entry').value = ''
  document.getElementById('tp').value = ''
  document.getElementById('sl').value = ''
  document.getElementById('note').value = ''

  alert('✅ Signal saved successfully!')
  updateStats()
}

function copyOutput() {
  const output = document.getElementById('output')
  output.select()
  document.execCommand('copy')
  alert('📋 Copied to clipboard! Ready for Telegram.')
}

function updateTradeStatus(id, status, exitPrice = null) {
  const trade = trades.find((t) => t.id === id)
  if (trade && trade.status === 'OPEN') {
    trade.status = status
    trade.exitDate = new Date().toISOString()

    if (exitPrice && !isNaN(parseFloat(exitPrice))) {
      trade.exitPrice = parseFloat(exitPrice)
      if (trade.side.includes('LONG')) {
        trade.profit = ((trade.exitPrice - trade.entry) / trade.entry) * 100
      } else {
        trade.profit = ((trade.entry - trade.exitPrice) / trade.entry) * 100
      }
      trade.profit = parseFloat(trade.profit.toFixed(2))
    }

    localStorage.setItem('ma_trades', JSON.stringify(trades))
    renderHistory()
    updateStats()

    alert(`✅ Trade marked as ${status}`)
  }
}

function deleteTrade(id) {
  if (confirm('Are you sure you want to delete this trade?')) {
    trades = trades.filter((t) => t.id !== id)
    localStorage.setItem('ma_trades', JSON.stringify(trades))
    renderHistory()
    updateStats()
    alert('🗑️ Trade deleted')
  }
}

// ============ RENDER HISTORY ============
function renderHistory() {
  const historyDiv = document.getElementById('trade-log')
  if (!historyDiv) return

  if (trades.length === 0) {
    historyDiv.innerHTML =
      '<div style="text-align: center; padding: 40px; color: var(--dim);">📭 No trades yet. Create your first signal!</div>'
    return
  }

  historyDiv.innerHTML = trades
    .map(
      (trade) => `
        <div class="trade-item" style="background: white; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                <div>
                    <strong style="font-size: 16px;">${trade.coin}</strong>
                    <span style="margin-left: 10px; padding: 2px 8px; background: ${trade.side.includes('LONG') ? '#10b98120' : '#ef444420'}; border-radius: 6px; font-size: 12px;">${trade.side}</span>
                    <span style="margin-left: 10px; padding: 2px 8px; background: ${getStatusColor(trade.status)}; border-radius: 6px; font-size: 12px;">${trade.status}</span>
                </div>
                <small style="color: var(--dim);">${new Date(trade.date).toLocaleString()}</small>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; font-size: 13px; margin-bottom: 10px;">
                <div>📊 Entry: ${trade.entry}</div>
                <div>🎯 TP: ${trade.tp}</div>
                <div>🛑 SL: ${trade.sl}</div>
                <div>⚖️ BE: ${trade.be}</div>
            </div>
            ${trade.note ? `<div style="background: #f8fafc; padding: 8px; border-radius: 8px; font-size: 12px; margin-bottom: 10px;">📝 ${trade.note}</div>` : ''}
            ${
              trade.status === 'OPEN'
                ? `
                <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                    <button onclick="updateTradeStatus(${trade.id}, 'WIN', prompt('Enter exit price (for P&L calculation):', '${trade.tp}'))" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">✅ WIN</button>
                    <button onclick="updateTradeStatus(${trade.id}, 'LOSS', prompt('Enter exit price (for P&L calculation):', '${trade.sl}'))" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">❌ LOSS</button>
                    <button onclick="deleteTrade(${trade.id})" style="background: #64748b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">🗑️ DELETE</button>
                </div>
            `
                : `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); font-size: 12px;">
                    ${trade.profit !== null ? `<span style="color: ${trade.profit >= 0 ? '#10b981' : '#ef4444'}">📈 P&L: ${trade.profit >= 0 ? '+' : ''}${trade.profit}%</span>` : ''}
                    ${trade.exitPrice ? ` | Exit: ${trade.exitPrice}` : ''}
                    <small style="color: var(--dim);"> | Closed: ${new Date(trade.exitDate).toLocaleString()}</small>
                </div>
            `
            }
        </div>
    `,
    )
    .join('')
}

function getStatusColor(status) {
  if (status === 'WIN') return '#10b98120'
  if (status === 'LOSS') return '#ef444420'
  return '#facc1520'
}

// ============ STATISTICS ============
function updateStats() {
  const total = trades.length
  const closed = trades.filter((t) => t.status !== 'OPEN')
  const wins = closed.filter((t) => t.status === 'WIN').length
  const losses = closed.filter((t) => t.status === 'LOSS').length
  const winRate = closed.length
    ? ((wins / closed.length) * 100).toFixed(1)
    : '0'

  // Calculate profit factor
  const totalProfit = closed
    .filter((t) => t.profit > 0)
    .reduce((sum, t) => sum + t.profit, 0)
  const totalLoss = Math.abs(
    closed.filter((t) => t.profit < 0).reduce((sum, t) => sum + t.profit, 0),
  )
  const profitFactor =
    totalLoss > 0
      ? (totalProfit / totalLoss).toFixed(2)
      : totalProfit > 0
        ? '∞'
        : '0'

  document.getElementById('stat-total').innerText = total
  document.getElementById('stat-closed').innerText = closed.length
  document.getElementById('stat-winrate').innerText = winRate + '%'
  document.getElementById('stat-profit-factor').innerText = profitFactor

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
        monthlyData[month] = { wins: 0, losses: 0, profit: 0 }
      if (trade.status === 'WIN') monthlyData[month].wins++
      if (trade.status === 'LOSS') monthlyData[month].losses++
      if (trade.profit) monthlyData[month].profit += trade.profit
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
          backgroundColor: '#10b981',
          borderRadius: 8,
        },
        {
          label: 'Losses',
          data: lossData,
          backgroundColor: '#ef4444',
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: { mode: 'index', intersect: false },
      },
    },
  })
}

// ============ DATA IMPORT/EXPORT ============
function exportAllData() {
  const dataStr = JSON.stringify(trades, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trades_backup_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  alert('💾 Data exported successfully!')
}

function importAdminData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = (e) => {
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const importedTrades = JSON.parse(event.target.result)
        if (Array.isArray(importedTrades)) {
          trades = importedTrades
          localStorage.setItem('ma_trades', JSON.stringify(trades))
          renderHistory()
          updateStats()
          alert('✅ Data imported successfully!')
        } else {
          alert('❌ Invalid data format')
        }
      } catch (error) {
        alert('❌ Error importing data')
      }
    }
    reader.readAsText(file)
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
    'Status',
    'Exit Price',
    'P&L%',
    'Note',
  ]
  const csvData = trades.map((t) => [
    t.id,
    new Date(t.date).toLocaleString(),
    t.coin,
    t.side,
    t.entry,
    t.tp,
    t.sl,
    t.be,
    t.status,
    t.exitPrice || '',
    t.profit !== null ? t.profit : '',
    t.note || '',
  ])

  const csvContent = [headers, ...csvData]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `trades_report_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
  alert('📊 CSV report generated!')
}

function clearAllData() {
  if (
    confirm('⚠️ ARE YOU SURE? This will delete ALL trade history permanently!')
  ) {
    const confirmation = prompt('Type "DELETE" to confirm:')
    if (confirmation === 'DELETE') {
      trades = []
      localStorage.clear()
      alert('🗑️ Database wiped successfully.')
      location.reload()
    } else {
      alert('Cancelled - Database not wiped')
    }
  }
}

// ============ MARKET DATA ============
async function fetchMarketData() {
  try {
    const response = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"]',
    )
    const data = await response.json()

    const tickerText = data
      .map((coin) => {
        const price = parseFloat(coin.lastPrice).toFixed(2)
        const change = parseFloat(coin.priceChangePercent).toFixed(2)
        const emoji = change >= 0 ? '🟢' : '🔴'
        return `${coin.symbol.replace('USDT', '')}: $${price} ${emoji} ${change}%`
      })
      .join(' | ')

    const tickerElement = document.getElementById('binance-ticker')
    if (tickerElement) {
      tickerElement.innerHTML = `🔥 LIVE MARKET: ${tickerText}`
    }
  } catch (error) {
    console.error('Market data error:', error)
    const tickerElement = document.getElementById('binance-ticker')
    if (tickerElement) {
      tickerElement.innerHTML = '⚠️ Market data unavailable - check connection'
    }
  }
}

function loadCoinSuggestions() {
  const coins = [
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
  ]
  const datalist = document.getElementById('coin-suggestions')
  if (datalist) {
    datalist.innerHTML = coins.map((c) => `<option value="${c}">`).join('')
  }
}

function filterQuickSearch() {
  const searchTerm = document.getElementById('search-coin').value.toLowerCase()
  const suggestions = document.getElementById('coin-suggestions')
  if (!suggestions) return

  const allOptions = Array.from(suggestions.options)
  const coins = [
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
  ]

  const filtered = coins.filter((c) => c.toLowerCase().includes(searchTerm))
  suggestions.innerHTML = filtered.map((c) => `<option value="${c}">`).join('')
}

// ============ CLOCKS ============
function updateClocks() {
  const now = new Date()

  const nyTime = document.getElementById('time-ny')
  const londonTime = document.getElementById('time-london')
  const slTime = document.getElementById('time-sl')

  if (nyTime) {
    nyTime.innerText = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now)
  }

  if (londonTime) {
    londonTime.innerText = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now)
  }

  if (slTime) {
    slTime.innerText = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now)
  }
}

// ============ REAL-TIME KZ TRACKER (IMPROVED) ============
function initKZTracker() {
  if (kzInterval) clearInterval(kzInterval)
  kzInterval = setInterval(() => {
    updateKZTracker()
  }, 1000)
  updateKZTracker()
}

function updateKZTracker() {
  const now = new Date()
  const londonTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/London' }),
  )
  let hour = londonTime.getHours()
  let minute = londonTime.getMinutes()
  let second = londonTime.getSeconds()
  let currentTime = hour + minute / 60 + second / 3600

  let kzName = ''
  let percentage = 0
  let message = ''
  let color = '#f59e0b'
  let isActive = false

  // Define sessions
  const sessions = [
    {
      name: 'LONDON KZ',
      start: 8,
      end: 10,
      icon: '🔥',
      color: '#f97316',
      desc: 'High volatility - London open',
    },
    {
      name: 'LONDON-NY OVERLAP',
      start: 12,
      end: 13,
      icon: '⚡',
      color: '#dc2626',
      desc: 'Maximum liquidity - Best trading time',
    },
    {
      name: 'NEW YORK KZ',
      start: 13,
      end: 15,
      icon: '💪',
      color: '#ef4444',
      desc: 'Major market moves - US session',
    },
    {
      name: 'ASIA KZ',
      start: 20,
      end: 22,
      icon: '🌏',
      color: '#8b5cf6',
      desc: 'Asian breakout opportunities',
    },
  ]

  // Check active sessions
  for (let session of sessions) {
    if (currentTime >= session.start && currentTime < session.end) {
      isActive = true
      const elapsed = currentTime - session.start
      const duration = session.end - session.start
      percentage = (elapsed / duration) * 100
      const remaining = (session.end - currentTime) * 60
      kzName = `${session.icon} ${session.name} - ACTIVE ${session.icon}`
      message = `${session.desc} • ${formatTimeRemaining(remaining)} remaining`
      color = session.color
      break
    }
  }

  // Handle Asia session crossing midnight
  if (!isActive && (currentTime >= 20 || currentTime < 2)) {
    isActive = true
    let start = 20
    let end = 22
    let elapsed, remaining

    if (currentTime >= 20) {
      elapsed = currentTime - 20
      remaining = (22 - currentTime) * 60
    } else {
      elapsed = currentTime + 4
      remaining = (2 - currentTime) * 60
    }

    percentage = (elapsed / 2) * 100
    kzName = `🌏 ASIA KZ - ACTIVE 🌏`
    message = `Asian breakout opportunities • ${formatTimeRemaining(remaining)} remaining`
    color = '#8b5cf6'
  }

  // Off-session - Show countdown percentage (increases as session approaches)
  if (!isActive) {
    let nextSession = null
    let timeUntilNext = Infinity

    for (let session of sessions) {
      let startTime = session.start
      let waitTime

      if (currentTime < session.start) {
        waitTime = session.start - currentTime
      } else {
        waitTime = 24 - currentTime + session.start
      }

      if (waitTime < timeUntilNext) {
        timeUntilNext = waitTime
        nextSession = session
      }
    }

    // Special handling for Asia session
    if (currentTime >= 22 && currentTime < 24) {
      timeUntilNext = 24 - currentTime + 8
      nextSession = { name: 'LONDON KZ', icon: '🔥', color: '#f97316' }
    }

    // Calculate countdown percentage (0% = far away, 100% = about to start)
    const maxWaitTime = 24
    percentage = Math.min(
      100,
      Math.max(0, ((maxWaitTime - timeUntilNext) / maxWaitTime) * 100),
    )

    // Format countdown display
    const hours = Math.floor(timeUntilNext)
    const minutes = Math.floor((timeUntilNext % 1) * 60)
    const secs = Math.floor((((timeUntilNext % 1) * 60) % 1) * 60)

    kzName = `⏰ COUNTDOWN TO ${nextSession.name}`
    message = `${nextSession.icon} ${nextSession.name} starts in ${hours}h ${minutes}m ${secs}s`
    color = '#94a3b8'

    // Update countdown display separately
    const countdownEl = document.getElementById('kz-countdown')
    if (countdownEl) {
      countdownEl.innerHTML = `⏰ ${nextSession.name}: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      countdownEl.style.color = '#f59e0b'
    }
  } else {
    // During active session, show remaining time in countdown
    const countdownEl = document.getElementById('kz-countdown')
    if (countdownEl) {
      let sessionEnd = 0
      if (kzName.includes('LONDON') && !kzName.includes('OVERLAP'))
        sessionEnd = 10
      else if (kzName.includes('OVERLAP')) sessionEnd = 13
      else if (kzName.includes('NEW YORK')) sessionEnd = 15
      else if (kzName.includes('ASIA')) sessionEnd = 22

      if (sessionEnd > 0) {
        const remaining = (sessionEnd - currentTime) * 3600
        const hours = Math.floor(remaining / 3600)
        const minutes = Math.floor((remaining % 3600) / 60)
        const secs = Math.floor(remaining % 60)
        countdownEl.innerHTML = `🔥 Session ends in: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        countdownEl.style.color = '#f97316'
      }
    }
  }

  // Update DOM
  const kzNameElement = document.getElementById('active-kz-name')
  const kzPercentElement = document.getElementById('kz-percent')
  const kzBarElement = document.getElementById('kz-bar')
  const kzMessageElement = document.getElementById('kz-message')

  if (kzNameElement) kzNameElement.innerHTML = kzName
  if (kzPercentElement)
    kzPercentElement.innerText = `${Math.round(percentage)}%`
  if (kzBarElement) {
    kzBarElement.style.width = `${percentage}%`
    kzBarElement.style.backgroundColor = color
  }
  if (kzMessageElement) kzMessageElement.innerHTML = message
}

function formatTimeRemaining(minutes) {
  if (minutes <= 0) return 'starting now'
  const hours = Math.floor(minutes / 60)
  const mins = Math.floor(minutes % 60)

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins} minutes`
}
