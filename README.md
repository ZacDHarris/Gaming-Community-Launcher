# Gaming Community Launcher

<div align="center">
  <img src="public/logos/Gaming-Community-Logo.png" alt="Gaming Community Launcher Logo" width="120" />

  <h3>Your games. Your community. One launcher.</h3>

  <p>
    A unified desktop launcher that aggregates your entire gaming library from every major platform into a single, beautiful interface — with live community feeds, Discord integration, and no subscriptions required.
  </p>

  ![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)
  ![Electron](https://img.shields.io/badge/Electron-42.x-47848F?style=flat-square&logo=electron)
  ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
  ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
  ![Version](https://img.shields.io/badge/version-1.0.0-orange?style=flat-square)
</div>

---

## Overview

Gaming Community Launcher reads your locally installed games directly from Steam, Epic Games, Ubisoft, EA, Riot, Minecraft, and CurseForge — no API keys, no sign-in walls, no cloud sync required. Launch any game from one place, browse live Reddit discussions and Steam reviews, track your Discord server's voice channels in real time, and apply a custom theme that matches your setup.

---

## Features

### Multi-Platform Library Detection
Automatically scans your machine for installed games across all major launchers:

| Platform | Detection Method |
|---|---|
| **Steam** | Registry + `libraryfolders.vdf` manifest parsing |
| **Epic Games** | Manifest files in `%ProgramData%\Epic\EpicGamesLauncher` |
| **Ubisoft Connect** | Registry scan + install directory parsing |
| **EA App** | Registry-based library detection |
| **Riot Games** | Registry scan (Valorant, League of Legends, etc.) |
| **Minecraft** | `.minecraft` launcher profile detection |
| **CurseForge** | Modpack instance directory scanning |

### Game Detail Hub
Each game card opens a four-tab detail view:

- **About** — Wikipedia summaries, release metadata, genre, and cover art
- **Reddit** — Live hot posts pulled from the game's subreddit via the Reddit JSON API
- **Reviews** — Steam user reviews and aggregated community ratings
- **Patch Notes** — Links to official patch notes and community patch discussions

### Launch Any Game
Click a card and launch directly into the game using native protocol handlers:

```
steam://rungameid/<id>    Epic launcher deep links
battlenet://              riotclient://
minecraft://              curseforge://
```

Custom game support lets you add any executable with auto-detected artwork.

### Discord Integration
Connect a Discord bot token to see your server's live state:

- Voice channel member listings with activity status
- Real-time presence tracking via the Discord Gateway WebSocket
- Activity log notifications for join/leave events

### Themes
Six built-in dark themes that persist across sessions:

| Theme | Accent |
|---|---|
| Midnight | Deep blue-purple |
| Ember | Warm orange-red |
| Arctic | Ice blue |
| Forest | Muted green |
| Crimson | Bold red |
| Gold | Amber yellow |

### Visual Experience
- Animated splash screen with ring impact effects and particle bursts
- Ripple animations on card interaction
- Smooth spring-based transitions throughout
- Game artwork sourced from Steam CDN and Wikipedia thumbnails

### System Info
- Disk space display per drive via PowerShell integration

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 |
| Desktop Shell | Electron 42 |
| Build Tool | Vite 8 |
| Installer | Electron Builder + NSIS |
| Styling | CSS-in-JS (inline styles) |
| Data Sources | Steam Store API, Reddit JSON API, Wikipedia REST API, Discord Gateway |

---

## Download & Install

> **No Node.js or npm required.** The installer bundles everything.

1. Go to the [Releases](https://github.com/ZacDHarris/Gaming-Community-Launcher/releases) page
2. Download the latest `Gaming-Community-Launcher-Setup-x.x.x.exe`
3. Run the installer and follow the setup wizard
4. Launch from the desktop shortcut or Start Menu

Requires **Windows 10 or 11**.

---

## For Developers

If you want to contribute or build from source, you'll need Node.js and npm installed.

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher
- Windows 10 / 11

### Run in Development Mode

```bash
# Clone the repository
git clone https://github.com/ZacDHarris/Gaming-Community-Launcher.git
cd Gaming-Community-Launcher

# Install dependencies
npm install

# Start in development mode (Vite + Electron)
npm run electron:dev
```

### Build the Installer

```bash
# Produces a .exe installer in dist-electron/
npm run electron:build
```

---

## Project Structure

```
gaming-community-launcher/
├── electron/
│   ├── main.cjs        # Electron main process, IPC handlers, game detection
│   └── preload.cjs     # Context bridge (exposes system APIs to renderer)
├── src/
│   ├── App.jsx         # Main application component
│   ├── main.jsx        # React entry point
│   └── index.css       # Global styles
├── public/
│   └── logos/          # Platform and app icons
├── index.html
├── vite.config.js
└── package.json
```

---

## Privacy

This application runs **entirely on your local machine**. It does not:

- Collect, transmit, or store any personal data
- Require account creation or login
- Phone home or send telemetry of any kind

All external network requests are made directly from your machine to public APIs (Steam, Reddit, Wikipedia) at your request when viewing game details. Your Discord bot token, if configured, is stored only in your local app data and is never transmitted to any third party.

---

## Legal

### Third-Party Trademarks

The following platform names, logos, and trademarks are the property of their respective owners. Gaming Community Launcher is an independent project and is not affiliated with, endorsed by, or sponsored by any of these companies:

- **Steam** and the Steam logo are trademarks of **Valve Corporation**
- **Epic Games** and the Epic Games logo are trademarks of **Epic Games, Inc.**
- **Ubisoft Connect** and related marks are trademarks of **Ubisoft Entertainment SA**
- **EA App** and related marks are trademarks of **Electronic Arts Inc.**
- **Riot Games**, **Valorant**, **League of Legends**, and related marks are trademarks of **Riot Games, Inc.**
- **Minecraft** is a trademark of **Mojang Studios / Microsoft Corporation**
- **CurseForge** is a trademark of **Overwolf Ltd.**
- **Discord** and the Discord logo are trademarks of **Discord Inc.**

Platform logos used in the application are sourced from publicly available assets for identification purposes only.

### Third-Party APIs

This application uses the following public APIs:

- [Steam Store API](https://store.steampowered.com/api/) — subject to Valve's terms of service
- [Reddit JSON API](https://www.reddit.com/dev/api/) — subject to Reddit's API terms
- [Wikipedia REST API](https://www.mediawiki.org/wiki/API:REST_API) — content licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- [Discord Gateway API](https://discord.com/developers/docs/topics/gateway) — subject to Discord's developer terms

---

## License

```
MIT License

Copyright (c) 2026 Zach Harris

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">
  Built with React + Electron &nbsp;|&nbsp; Made for gamers
</div>
