# AYesMan ⚡

**AYesMan** enhances your [Google Antigravity](https://antigravity.dev) experience with two quality-of-life features: a real-time quota dashboard and automatic agent step acceptance.

> ⚠️ Unofficial extension. Not affiliated with or endorsed by Google or Antigravity.

**[中文說明 → README.zh-tw.md](README.zh-tw.md)**

---

## Features

### 📊 Quota Dashboard

Antigravity's UI doesn't show you exactly how much quota you have left per model. AYesMan does.

- **Status bar**: Displays the model with the lowest remaining quota at a glance (e.g. `⚠ Gemini 3 Pro: 20%`)
- **Color indicator**: 🟢 Healthy (≥80%) · 🟡 Moderate (40–79%) · 🔴 Low (<40%)
- **Hover tooltip**: Full breakdown — all models with percentages, reset timers, and your plan's Prompt & Flow credit usage
- **Auto-refresh**: Updates every 2 minutes in the background. Click the status bar item to refresh immediately.

![Quota Dashboard screenshot placeholder](docs/quota-screenshot.png)

### ✅ Auto-Accept

Stop clicking "Accept" on every terminal command the Agent proposes. AYesMan does it for you.

- **Toggle anytime**: Click the status bar item or use `Ctrl+Shift+P` → `AYesMan: Toggle Auto-Accept`
- **Multi-project aware**: Works correctly when multiple Antigravity windows are open for different projects
- **On by default**: Starts enabled when the extension loads

---

## Requirements

- Google Antigravity IDE (Windows)
- The Antigravity language server must be running (it starts automatically with the IDE)

> **Note**: Currently Windows-only. macOS/Linux support is not available at this time.

---

## Commands

| Command | Description |
|---------|-------------|
| `AYesMan: Toggle Auto-Accept` | Enable or disable auto-accept |
| `AYesMan: Refresh Quota` | Manually refresh quota data |
| `AYesMan: Diagnose Auto-Accept` | Debug information for troubleshooting |

---

## How It Works

AYesMan communicates with the Antigravity language server running locally on your machine. No data leaves your computer beyond what Antigravity itself already sends — AYesMan only reads and interacts with a local process.

- **Quota data** is fetched by querying your local language server for the same quota information the IDE uses internally.
- **Auto-Accept** works by detecting pending agent steps via the local language server and confirming them on your behalf — equivalent to clicking the Accept button yourself.

---

## Known Limitations

- Windows only (relies on PowerShell for process discovery)
- Requires Antigravity to be running before the extension activates
- Since this extension uses Antigravity's internal APIs, updates to Antigravity may occasionally break functionality until AYesMan is updated

---

## Disclaimer

AYesMan is an independent, unofficial tool created by the community. It interacts with Antigravity's local language server to provide features not available in the official UI. Use at your own discretion.

This extension does not bypass any quota limits, does not increase API usage, and does not transmit your data to any third party.

---

## License

MIT
