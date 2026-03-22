// ============ DATA MANAGEMENT ============
let trades = JSON.parse(localStorage.getItem('ma_trades')) || []
let chart = null

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
  updateClocks()
  setInterval(updateClocks, 1000)
  setInterval(updateKZTracker, 1000)
  setInterval(fetchMarketData, 30000)
  fetchMarketData()
  updateKZTracker()
  loadCoinSuggestions()
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

    if (exitPrice && !isNaN(exitPrice)) {
      trade.exitPrice = parseFloat(exitPrice)
      trade.profit = trade.side.includes('LONG')
        ? ((trade.exitPrice - trade.entry) / trade.entry) * 100
        : ((trade.entry - trade.exitPrice) / trade.entry) * 100
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
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <div>
                    <strong style="font-size: 16px;">${trade.coin}</strong>
                    <span style="margin-left: 10px; padding: 2px 8px; background: ${trade.side.includes('LONG') ? '#10b98120' : '#ef444420'}; border-radius: 6px; font-size: 12px;">${trade.side}</span>
                    <span style="margin-left: 10px; padding: 2px 8px; background: ${getStatusColor(trade.status)}; border-radius: 6px; font-size: 12px;">${trade.status}</span>
                </div>
                <small style="color: var(--dim);">${new Date(trade.date).toLocaleString()}</small>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 13px; margin-bottom: 10px;">
                <div>📊 Entry: ${trade.entry}</div>
                <div>🎯 TP: ${trade.tp}</div>
                <div>🛑 SL: ${trade.sl}</div>
                <div>⚖️ BE: ${trade.be}</div>
            </div>
            ${trade.note ? `<div style="background: #f8fafc; padding: 8px; border-radius: 8px; font-size: 12px; margin-bottom: 10px;">📝 ${trade.note}</div>` : ''}
            ${
              trade.status === 'OPEN'
                ? `
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button onclick="updateTradeStatus(${trade.id}, 'WIN', prompt('Exit price:', '${trade.tp}'))" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">✅ WIN</button>
                    <button onclick="updateTradeStatus(${trade.id}, 'LOSS', prompt('Exit price:', '${trade.sl}'))" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">❌ LOSS</button>
                    <button onclick="deleteTrade(${trade.id})" style="background: #64748b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">🗑️ DELETE</button>
                </div>
            `
                : `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); font-size: 12px;">
                    ${trade.profit ? `📈 P&L: ${trade.profit.toFixed(2)}%` : ''}
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
      if (!monthlyData[month]) monthlyData[month] = { wins: 0, losses: 0 }
      if (trade.status === 'WIN') monthlyData[month].wins++
      if (trade.status === 'LOSS') monthlyData[month].losses++
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
        { label: 'Wins', data: winData, backgroundColor: '#10b981' },
        { label: 'Losses', data: lossData, backgroundColor: '#ef4444' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { position: 'top' } },
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
    t.profit ? t.profit.toFixed(2) : '',
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
    if (confirm('Type "DELETE" to confirm:') === 'DELETE') {
      trades = []
      localStorage.clear()
      alert('🗑️ Database wiped successfully.')
      location.reload()
    } else {
      alert('Cancelled')
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

    document.getElementById('binance-ticker').innerHTML =
      `🔥 LIVE MARKET: ${tickerText}`
  } catch (error) {
    console.error('Market data error:', error)
    document.getElementById('binance-ticker').innerHTML =
      '⚠️ Market data unavailable - check connection'
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
  ]
  const datalist = document.getElementById('coin-suggestions')
  datalist.innerHTML = coins.map((c) => `<option value="${c}">`).join('')
}

function filterQuickSearch() {
  const searchTerm = document.getElementById('search-coin').value.toLowerCase()
  const suggestions = document.getElementById('coin-suggestions')
  const allOptions = Array.from(suggestions.options)

  suggestions.innerHTML = allOptions
    .filter((opt) => opt.value.toLowerCase().includes(searchTerm))
    .map((opt) => `<option value="${opt.value}">`)
    .join('')
}

// ============ CLOCKS ============
function updateClocks() {
  const now = new Date()

  document.getElementById('time-ny').innerText = new Intl.DateTimeFormat(
    'en-US',
    {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
  ).format(now)

  document.getElementById('time-london').innerText = new Intl.DateTimeFormat(
    'en-US',
    {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
  ).format(now)

  document.getElementById('time-sl').innerText = new Intl.DateTimeFormat(
    'en-US',
    {
      timeZone: 'Asia/Colombo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
  ).format(now)
}

// ============ KZ TRACKER ============
function updateKZTracker() {
  const londonTime = new Date().toLocaleString('en-US', {
    timeZone: 'Europe/London',
  })
  const hour = new Date(londonTime).getHours()
  const minute = new Date(londonTime).getMinutes()
  const currentTime = hour + minute / 60

  let kzName = ''
  let percentage = 0
  let message = ''

  // London Kill Zone (8:00-10:00)
  if (currentTime >= 8 && currentTime < 10) {
    kzName = '🇬🇧 LONDON KZ'
    const elapsed = currentTime - 8
    percentage = Math.min(100, (elapsed / 2) * 100)
    message = '🔥 Prime London session - High volatility expected!'
  }
  // New York Kill Zone (13:00-15:00)
  else if (currentTime >= 13 && currentTime < 15) {
    kzName = '🇺🇸 NEW YORK KZ'
    const elapsed = currentTime - 13
    percentage = Math.min(100, (elapsed / 2) * 100)
    message = '💪 NY session open - Major moves incoming!'
  }
  // Asia Kill Zone (20:00-22:00)
  else if (currentTime >= 20 || currentTime < 2) {
    kzName = '🇯🇵 ASIA KZ'
    let adjustedTime = currentTime >= 20 ? currentTime - 20 : currentTime + 4
    percentage = Math.min(100, (adjustedTime / 2) * 100)
    message = '🌏 Asian session - Watch for breakouts!'
  }
  // Overlap (13:00-15:00 is already NY)
  else if (currentTime >= 12 && currentTime < 13) {
    kzName = '⚡ LONDON-NY OVERLAP'
    percentage = 75
    message = '🚀 Highest volatility period - Perfect for trading!'
  } else {
    kzName = '💤 OFF-SESSION'
    percentage = 20
    message = '⏰ Next KZ: London (8:00-10:00 UTC)'
  }

  document.getElementById('active-kz-name').innerHTML = kzName
  document.getElementById('kz-percent').innerText = `${Math.round(percentage)}%`
  document.getElementById('kz-bar').style.width = `${percentage}%`
  document.getElementById('kz-message').innerHTML = message
}
