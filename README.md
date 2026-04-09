# ◈ CryptoSignal PRO v3.1

<div align="center">

![Version](https://img.shields.io/badge/version-3.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26.svg)
![CSS3](https://img.shields.io/badge/CSS3-1572B6.svg)
![Real-Time](https://img.shields.io/badge/Real--Time-KZ%20Tracker-red.svg)
![Status](https://img.shields.io/badge/Status-Fully%20Working-brightgreen.svg)

**Professional Crypto Trading Signal Terminal with Interactive World Map, Real-Time Kill Zone Tracking, Fear & Greed Index, and Auto TP/SL Monitoring**

</div>

---

## 📸 Dashboard Preview

<div align="center">
  <img src="https://via.placeholder.com/1200x600/0a0e1a/00d4aa?text=CryptoSignal+PRO+v3.1+-+Live+Trading+Terminal" alt="CryptoSignal PRO Dashboard" width="90%">
  <br>
  <em>Professional dark-mode trading terminal with live global session map and real-time analytics</em>
</div>

---

## ⚠️ Important — Run via Localhost

> **Do NOT open `index.html` directly by double-clicking it.**
> Browsers block all external API calls (`fetch`) from `file://` origins due to CORS policy.
> This means market prices, Fear & Greed index, and auto price monitoring will NOT work.

**Use a local server instead:**

```bash
# Python (easiest — already installed on most machines)
python -m http.server 8080
# then open http://localhost:8080

# Node.js
npx serve .

# VS Code
# Install the "Live Server" extension → right-click index.html → Open with Live Server
```

---

## 🆕 What's New in v3.1

| #   | Fix / Feature                         | Details                                                                       |
| --- | ------------------------------------- | ----------------------------------------------------------------------------- |
| 🔴  | **`manualClose()` restored**          | Mark Win / Mark Loss buttons now work — prompts for exit price                |
| 🔴  | **`editTrade()` restored**            | Edit button loads a trade back into the signal form cleanly                   |
| 🔴  | **`copyFromModal()` restored**        | Copy button inside message preview modal now works                            |
| 🔴  | **`resetForm()` infinite loop fixed** | Form clears safely after signal generation                                    |
| 🟡  | **R:R milestone direction fix**       | SHORT trades moving against position no longer trigger false milestone toasts |
| 🟡  | **London timezone corrected**         | Now correctly shows UTC+0 in winter, UTC+1 BST in summer (was always +1)      |
| 🟡  | **New York DST properly handled**     | 2nd Sunday March → 1st Sunday November rule implemented                       |
| 🟡  | **UTC clock on world map fixed**      | Was showing `--:--:--`, now ticks live every second                           |
| 🟡  | **Nav badge updates**                 | Open trades count in History nav now updates correctly                        |
| 🟢  | **Fear & Greed Index added**          | Live data from `alternative.me/fng` with color-coded sentiment                |
| 🟢  | **URL hash nav fix**                  | Active nav link now correctly reflects the page section on load               |
| 🟢  | **Telegram share fixed**              | Removed broken empty `url=` parameter                                         |
| 🟢  | **Position calculator guard**         | No longer crashes when Entry equals Stop Loss                                 |
| 🟢  | **Market data error message**         | Ticker now shows helpful guidance when API is blocked by `file://`            |

---

## ✨ Features

### 🎯 Core Features

| Feature                      | Description                                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| 📊 **Signal Generator**      | Create professional trading signals with one click, ready for Telegram   |
| ✏️ **Edit Open Trades**      | Modify any open trade's entry, SL, TPs, or notes                         |
| 💾 **Trade Management**      | Track, update, and close trades with automatic P&L calculation           |
| 📈 **Performance Analytics** | Win rate, profit factor, and interactive monthly performance charts      |
| 🌍 **Interactive World Map** | Live CSS world map with active session regions and connection lines      |
| 🔥 **Real-Time KZ Tracker**  | Smart detection of high-probability trading sessions with live countdown |
| 💹 **Live Market Data**      | Real-time prices from Binance API for top cryptocurrencies               |
| 😨 **Fear & Greed Index**    | Live market sentiment from alternative.me, color-coded by value          |

### 🚀 Advanced Features

- ✅ **Auto TP/SL Monitoring** — Price checks every 5 seconds; auto-closes trades on hit
- ✅ **R:R Milestone Toasts** — Notifies at 1:1, 1:2, 1:3... up to 1:10 (direction-aware)
- ✅ **Multi-TP Support** — Up to 6 take-profit targets with individual hit tracking
- ✅ **Message Builder** — Pre-formatted Telegram messages for signal open, TP hits, RR updates, SL, and final result
- ✅ **Manual Mode** — Disable auto-monitoring for limit orders you want to manage yourself
- ✅ **Edit Open Trades** — Load any open trade back into the form; re-generate to save changes
- ✅ **History Search & Filter** — Search by coin or note; filter by All / Open / Win / Loss
- ✅ **JSON Backup** — Full export/import of all trade data
- ✅ **Position Size Calculator** — Enter balance, risk %, entry, and SL to get exact position size
- ✅ **Risk Management Rules** — Built-in golden rules section (1% rule, min 1:2 R:R, always use SL)
- 📱 **Responsive Design** — Fully functional on desktop, tablet, and mobile
- ⌨️ **Keyboard Shortcuts**:
  - `Ctrl + Enter` — Generate signal (when Signal section is visible)
  - `Escape` — Close message modal

---

## 🎯 Real-Time Kill Zone Sessions

Sessions tracked in real-time with second-by-second updates:

| Session             | UTC Time      | Activity   | Description                             |
| ------------------- | ------------- | ---------- | --------------------------------------- |
| 🌏 **Asia KZ**      | 01:00 – 03:00 | ⚡ MEDIUM  | Tokyo open — AUD, NZD, JPY pairs        |
| 🔥 **London KZ**    | 07:00 – 10:00 | 🔥 HIGH    | London open — EUR, GBP, CHF pairs       |
| ⚡ **New York KZ**  | 12:00 – 15:00 | 🚀 EXTREME | NY + London overlap — maximum liquidity |
| 🎯 **London Close** | 15:00 – 17:00 | 🔥 HIGH    | Position squaring — watch for reversals |

**Live indicators:**

- 🗺️ Interactive world map with glowing active region
- 🔴 Active session pulse animation
- ⏰ Countdown timer to next session (accurate to the second)
- 📊 Session progress bar
- 🕐 Live clocks: New York · London · UTC · Your Local Time

---

## 🛠️ Technologies Used

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)
![Binance](https://img.shields.io/badge/Binance_API-F0B90B?style=for-the-badge&logo=binance&logoColor=black)
![LocalStorage](https://img.shields.io/badge/LocalStorage-FFA500?style=for-the-badge&logo=javascript&logoColor=white)

</div>

- **Frontend**: HTML5, CSS3, Vanilla JavaScript — zero frameworks
- **Charts**: Chart.js — monthly win/loss bar chart + R:R distribution bars
- **Storage**: Browser `localStorage` — all data stays 100% on your device
- **Market Data**: Binance Public API — no API key required
- **Sentiment**: alternative.me Fear & Greed Index API
- **Icons**: Font Awesome 6 + emoji — no paid assets
- **Real-Time**: `setInterval` at 1-second precision for clocks and KZ tracking

---

## 📦 Installation

### Option 1: Python Local Server (Recommended)

```bash
# Clone the repo
git clone https://github.com/VGLKSathsara/master-analyst-vip-terminal.git
cd master-analyst-vip-terminal

# Start local server
python -m http.server 8080

# Open in browser
# http://localhost:8080
```

### Option 2: Node.js

```bash
npx serve .
# Open http://localhost:3000
```

### Option 3: VS Code Live Server

1. Install the **Live Server** extension by Ritwick Dey
2. Right-click `index.html` → **Open with Live Server**
3. Browser opens automatically at `http://127.0.0.1:5500`

> ❌ **Do not** use `start index.html` / `open index.html` / double-click.
> Market data and price monitoring require a proper HTTP origin.

---

## 📖 How to Use

### Generating a Signal

1. Select a coin from the quick grid or type a custom pair (e.g. `BTC/USDT.P`)
2. Choose **Long** or **Short**, order type, leverage, and risk %
3. Enter your **Entry Price**, **TP targets** (up to 6), and **Stop Loss**
4. Optionally add a Break Even level or a note
5. Click **GENERATE SIGNAL** — the formatted Telegram message appears instantly
6. Click **Copy** or **Telegram** to share

### Auto Price Monitoring

- All non-manual open trades are checked every **5 seconds** via Binance API
- **SL hit** → trade auto-closes as LOSS
- **All TPs hit** → trade auto-closes as WIN
- **R:R milestones** (1:1 through 1:10) trigger toast notifications as the trade runs

### Manual Trades

- Enable **Manual Mode** when creating a signal to skip auto-monitoring
- In Trade History, use **Mark Win** or **Mark Loss** and enter your actual exit price

### Message Templates

Each trade card has buttons to copy pre-formatted messages:

- 📊 **Signal** — original entry message
- ⚖️ **1:N RR** — R:R milestone update messages
- 🎯 **TP hit** — TP confirmation messages
- 🛑 **SL Message** — stop loss notification
- 🏁 **Result** — final trade summary

---

## 📊 Analytics

| Metric           | Description                               |
| ---------------- | ----------------------------------------- |
| Total Signals    | All trades ever created                   |
| Win Rate         | Closed wins ÷ total closed × 100          |
| Profit Factor    | Gross profit ÷ gross loss                 |
| Total P&L        | Sum of all closed trade profits (%)       |
| Open Trades      | Live count of active positions            |
| Closed Trades    | Total completed trades                    |
| Monthly Chart    | Win/loss bar chart by month               |
| R:R Distribution | Breakdown of trades by R:R ratio achieved |

---

## 🗂️ Project Structure

```
cryptosignal-pro/
├── index.html      # Full single-page app layout
├── style.css       # Dark theme, responsive, all component styles
├── app.js          # All logic: signals, monitoring, analytics, modals
└── README.md       # This file
```

---

## 🔐 Privacy & Data

- **All data is stored locally** in your browser's `localStorage`
- **Nothing is sent to any server** — no accounts, no cloud, no tracking
- Use **Export** to back up your trades as JSON before clearing browser data
- Use **Import** to restore a previous backup

---

## ⚠️ Risk Warning

Cryptocurrency trading carries **substantial risk of loss**. This tool is for signal organization and record-keeping only — it does not constitute financial advice. Never trade with money you cannot afford to lose. Past performance does not guarantee future results.

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<div align="center">
  <strong>◈ CryptoSignal PRO v3.1</strong><br>
  🪷 Patience · 🌸 Discipline · 🔐 Your data, your device
</div>
