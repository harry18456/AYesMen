# AYesMan - Antigravity YesMan ⚡

**AYesMan** enhances your [Google Antigravity](https://antigravity.dev) experience with a unified status bar item that shows your auto-accept state and provides a real-time model quota dashboard on hover.

> ⚠️ Unofficial extension. Not affiliated with or endorsed by Google or Antigravity.

**[中文說明 → README.zh-tw.md](README.zh-tw.md)**

---

## Features

### ⚡ Unified Status Bar

One status bar item does it all.

- **Active**: `▶️ YesMan` — auto-accept is running
- **Paused**: `⏸️ YesMan` — auto-accept is off (orange background)
- **Click** to toggle auto-accept on/off
- **Hover** to see a full quota breakdown — all models with percentages and reset timers
- **Background color**: turns yellow (<40%) or red (<20%) when quota is critically low

### ✅ Auto-Accept

Stop clicking "Accept" on every terminal command the Agent proposes. AYesMan does it for you.

- **Toggle anytime**: Click the status bar item or use `Ctrl+Shift+P` → `AYesMan: Toggle Auto-Accept`
- **Multi-project aware**: Works correctly when multiple Antigravity windows are open for different projects
- **On by default**: Starts enabled when the extension loads
- **No filter restrictions**: Antigravity's built-in Auto Run blocks commands with `|`, `;`, or certain keywords (e.g. `rmdir`). AYesMan accepts all of them.

> ⚠️ **Security note**: Because AYesMan bypasses Antigravity's safety filters, working with untrusted files or repositories while auto-accept is active carries prompt injection risk. Pause auto-accept (`⏸️ YesMan`) when reviewing unfamiliar code.

### 📊 Quota Dashboard

Antigravity's UI doesn't show you exactly how much quota you have left per model. AYesMan does.

- **Hover tooltip**: All models with percentages and reset timers
- **Auto-refresh**: Updates every 2 minutes in the background
- **Manual refresh**: `Ctrl+Shift+P` → `AYesMan: Refresh Quota`

---

## Requirements

- Google Antigravity IDE

---

## Commands

| Command                       | Description                   |
| ----------------------------- | ----------------------------- |
| `AYesMan: Toggle Auto-Accept` | Enable or disable auto-accept |
| `AYesMan: Refresh Quota`      | Manually refresh quota data   |

---

## How It Works

AYesMan communicates with Antigravity running locally on your machine. No data leaves your computer beyond what Antigravity itself already sends — AYesMan only reads and interacts with a local process.

- **Quota data** is fetched by querying Antigravity locally for the same quota information the IDE uses internally.
- **Auto-Accept** works by detecting pending agent steps via Antigravity and confirming them on your behalf — equivalent to clicking the Accept button yourself.

---

## Known Limitations

- Requires Antigravity to be running before the extension activates
- Since this extension uses Antigravity's internal APIs, updates to Antigravity may occasionally break functionality until AYesMan is updated

---

## Disclaimer

AYesMan is an independent, unofficial tool created by the community. It interacts with Antigravity to provide features not available in the official UI. Use at your own discretion.

This extension operates entirely on localhost. All API calls are made to Antigravity locally using your existing session credentials — they are indistinguishable from normal IDE activity and do not touch Google's servers directly.

This extension does not bypass any quota limits, does not increase API usage, and does not transmit your data to any third party.

---

## License

MIT
