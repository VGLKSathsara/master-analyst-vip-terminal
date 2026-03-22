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

// ============ REAL-TIME KZ TRACKER ============
function initKZTracker() {
  if (kzInterval) clearInterval(kzInterval)
  kzInterval = setInterval(() => {
    updateKZTracker()
    updateCountdown()
  }, 1000)
  updateKZTracker()
  updateCountdown()
}

function updateKZTracker() {
  const now = new Date()
  const londonTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/London' }),
  )
  const hour = londonTime.getHours()
  const minute = londonTime.getMinutes()
  const currentTime = hour + minute / 60

  let kzName = ''
  let percentage = 0
  let message = ''
  let color = '#f59e0b'

  // London Kill Zone (08:00-10:00 UTC)
  if (currentTime >= 8 && currentTime < 10) {
    kzName = '🇬🇧 LONDON KZ - ACTIVE 🔥'
    const elapsed = currentTime - 8
    percentage = Math.min(100, (elapsed / 2) * 100)
    const remaining = (10 - currentTime) * 60
    const remainingMinutes = Math.floor(remaining)
    message = `🔥 LONDON SESSION ACTIVE! ${remainingMinutes} minutes remaining`
    color = '#f97316'
  }
  // New York Kill Zone (13:00-15:00 UTC)
  else if (currentTime >= 13 && currentTime < 15) {
    kzName = '🇺🇸 NEW YORK KZ - ACTIVE 💪'
    const elapsed = currentTime - 13
    percentage = Math.min(100, (elapsed / 2) * 100)
    const remaining = (15 - currentTime) * 60
    const remainingMinutes = Math.floor(remaining)
    message = `💪 NY SESSION ACTIVE! ${remainingMinutes} minutes remaining`
    color = '#ef4444'
  }
  // Asia Kill Zone (20:00-22:00 UTC)
  else if (currentTime >= 20 || currentTime < 2) {
    kzName = '🇯🇵 ASIA KZ - ACTIVE 🌏'
    let adjustedTime
    if (currentTime >= 20) {
      adjustedTime = currentTime - 20
      percentage = Math.min(100, (adjustedTime / 2) * 100)
      const remaining = (22 - currentTime) * 60
      const remainingMinutes = Math.floor(remaining)
      message = `🌏 ASIA SESSION ACTIVE! ${remainingMinutes} minutes remaining`
    } else {
      adjustedTime = currentTime + 4
      percentage = Math.min(100, (adjustedTime / 2) * 100)
      const remaining = (2 - currentTime) * 60
      const remainingMinutes = Math.floor(remaining)
      message = `🌏 ASIA SESSION ACTIVE! ${remainingMinutes} minutes remaining`
    }
    color = '#8b5cf6'
  }
  // London-NY Overlap (12:00-13:00 UTC)
  else if (currentTime >= 12 && currentTime < 13) {
    kzName = '⚡ LONDON-NY OVERLAP - MAX VOLATILITY 🚀'
    const elapsed = currentTime - 12
    percentage = 75 + elapsed * 25
    const remaining = (13 - currentTime) * 60
    const remainingMinutes = Math.floor(remaining)
    message = `🚀 HIGHEST VOLATILITY! ${remainingMinutes} minutes remaining`
    color = '#dc2626'
  }
  // Off-session
  else {
    kzName = '💤 OFF-SESSION'
    percentage = 20
    color = '#94a3b8'

    if (currentTime < 8) {
      message = `⏰ Next: London KZ in ${formatTimeRemaining((8 - currentTime) * 60)}`
    } else if (currentTime < 12) {
      message = `⏰ Next: Overlap in ${formatTimeRemaining((12 - currentTime) * 60)}`
    } else if (currentTime < 13) {
      message = `⏰ Next: NY KZ in ${formatTimeRemaining((13 - currentTime) * 60)}`
    } else if (currentTime < 20) {
      message = `⏰ Next: Asia KZ in ${formatTimeRemaining((20 - currentTime) * 60)}`
    } else {
      message = `⏰ Next: London KZ in ${formatTimeRemaining((24 - currentTime + 8) * 60)}`
    }
  }

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

function updateCountdown() {
  const now = new Date()
  const londonTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/London' }),
  )
  const hour = londonTime.getHours()
  const minute = londonTime.getMinutes()
  const second = londonTime.getSeconds()
  const currentTime = hour + minute / 60 + second / 3600

  let nextKZStart = null
  let nextKZName = ''

  if (currentTime < 8) {
    nextKZStart = 8
    nextKZName = 'London KZ'
  } else if (currentTime < 12) {
    nextKZStart = 12
    nextKZName = 'London-NY Overlap'
  } else if (currentTime < 13) {
    nextKZStart = 13
    nextKZName = 'New York KZ'
  } else if (currentTime < 20) {
    nextKZStart = 20
    nextKZName = 'Asia KZ'
  } else {
    nextKZStart = 24 + 8
    nextKZName = 'London KZ'
  }

  let remainingSeconds = (nextKZStart - currentTime) * 3600
  if (remainingSeconds < 0) remainingSeconds += 24 * 3600

  const hours = Math.floor(remainingSeconds / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = Math.floor(remainingSeconds % 60)

  const countdownElement = document.getElementById('kz-countdown')
  if (countdownElement) {
    const isActive =
      (currentTime >= 8 && currentTime < 10) ||
      (currentTime >= 13 && currentTime < 15) ||
      currentTime >= 20 ||
      currentTime < 2 ||
      (currentTime >= 12 && currentTime < 13)

    if (isActive) {
      countdownElement.innerHTML = `🔥 ${nextKZName.toUpperCase()} ACTIVE NOW! 🔥`
      countdownElement.style.color = '#f97316'
      countdownElement.style.fontSize = '14px'
    } else {
      countdownElement.innerHTML = `⏰ ${nextKZName} starts in: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      countdownElement.style.color = '#94a3b8'
    }
  }
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
