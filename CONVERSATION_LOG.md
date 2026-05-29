# Gaming Community Launcher — Dev Log

## Project
React + Vite + Electron desktop app. Reads real game libraries from Steam, Epic Games, Ubisoft, and CurseForge. Displays installed games, disk usage, favorites, and links to each platform's store.

**Run:** `npm run electron:dev`
**Build .exe:** `npm run electron:build`

---

## Session 1 — Electron Setup

**Goal:** Convert a React/Vite web app into a working .exe.

- Added `electron` and `electron-builder` as dev dependencies
- Created `electron/main.cjs` (main process) and `electron/preload.cjs` (IPC bridge)
- Added `base: './'` to `vite.config.js` so production assets use relative paths (required for Electron `file://` loading)
- Set `"main": "electron/main.cjs"` in `package.json`
- Added scripts: `electron:dev` (concurrently runs Vite + Electron) and `electron:build` (Vite build + electron-builder → NSIS installer)

**Fixes along the way:**
- Node.js was installed at `C:\Program Files\nodejs\` but not in PATH — added via `[System.Environment]::SetEnvironmentVariable`
- `electron:build` threw symlink privilege error → fixed by enabling Windows Developer Mode (Settings → System → For developers)

---

## Session 2 — Real Launcher Integration

**Goal:** Connect to actual game launchers instead of showing dummy data.

### Steam
- Registry lookup: `HKCU\SOFTWARE\Valve\Steam` → `SteamPath`
- Reads `steamapps/libraryfolders.vdf` for additional library locations
- Parses all `appmanifest_*.acf` files (regex for `appid`, `name`, `SizeOnDisk`)
- Launch URL: `steam://rungameid/{appid}`

### Epic Games
- Reads `C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests\*.item` JSON files
- Returns `null` if folder missing (triggers path picker UI), `[]` if empty
- Launch URL: `com.epicgames.launcher://apps/{appName}?action=launch`

### Ubisoft
- Registry: `HKLM\SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs\*`
- Falls back to scanning `Program Files\Ubisoft Game Launcher\games`
- Launch URL: `uplay://launch/{id}/0`

### CurseForge
- Scans `%UserProfile%\curseforge\minecraft\Instances\` directories
- Reads `minecraftinstance.json` per folder (name, gameVersion, installedModCount)

### Other changes
- Removed playtime feature
- Added real disk info via PowerShell `Get-PSDrive -PSProvider FileSystem`
- Added shop links (open each launcher to its store page)
- Increased font sizes
- Removed "Free & Open Source" from header
- Deleted GOG Galaxy
- Added Favorites feature (star button on cards, pinned section at top, stored in localStorage)
- Custom path picker for Epic, Ubisoft, CurseForge (stored in localStorage)

---

## Session 2 Bug — Black Screen on Launch

**Symptom:** `npm run electron:dev` showed only a black screen, no UI.

**Root cause:** JavaScript Temporal Dead Zone (TDZ). `handleSetPath` was defined before `toast` in the component body but referenced `toast` in its dependency array. Since `const` declarations can't be accessed before initialization, this caused a `ReferenceError` that crashed the renderer before React mounted.

**Fix:** Moved `handleSetPath` to after the `toast` and `discord` callbacks.

**Correct callback order:**
1. `toggleFavorite` — no dependencies
2. `useEffect` for Steam/disk loading
3. `toast`
4. `discord`
5. `handleSetPath` ← must come after `toast`
6. `handleConnect`

---

## Session 3 — Icons, Scrolling, Rename

### Scrolling fix
Changed outer app container from `minHeight: "100vh"` to `height: "100vh"` so the flex layout properly constrains `<main>` and its `overflowY: "auto"` actually kicks in.

### Rename
Updated `index.html` `<title>` to `Gaming Community Launcher`.

### Platform logo SVGs (all inline, no external deps)
Replaced all placeholder icons with proper SVG representations:

| Platform | Design |
|---|---|
| Steam | Blue gear/controller shape on dark navy |
| Epic Games | Geometric "E" letterform on near-black |
| Battle.net | 6-arm blue asterisk starburst on dark blue |
| EA | Orange path-drawn "E" and "A" on black |
| Ubisoft | Spiral with detached dot on black |
| Riot Client | Bold angular red "R" with cutout on dark |
| Minecraft | Grass block — green top, brown dirt, pixel face |
| CurseForge | Layered flame in orange/amber on dark |

### File cleanup
Deleted unused scaffold files:
- `src/App.css` (empty)
- `src/assets/react.svg`, `vite.svg`, `hero.png` (unused)
- `public/icons.svg` (unused)
- `eslint.config.js` (optional tooling)
- `README.md` (Vite boilerplate)

Added `dist-electron` to `.gitignore`.

---

## Final File Structure

```
gaming-launcher/
├── index.html              ← app entry point
├── package.json            ← dependencies + build config
├── vite.config.js          ← Vite config (base: './')
├── .gitignore
├── electron/
│   ├── main.cjs            ← Electron main process + all IPC handlers
│   └── preload.cjs         ← contextBridge IPC bridge
├── public/
│   └── favicon.svg         ← tab icon
└── src/
    ├── App.jsx             ← entire app (~1100 lines)
    ├── main.jsx            ← React entry point
    └── index.css           ← global styles (box-sizing, overflow, #root sizing)
```

---

## IPC API (window.electronAPI)

| Method | Description |
|---|---|
| `getDiskInfo()` | Returns `[{name, total, used, free}]` for all drives |
| `getSteamLibrary()` | Returns `[{appid, name, sizeGB}]` from ACF files |
| `scanEpicLibrary(path?)` | Returns `[{appName, name, sizeGB}]` or `null` |
| `scanUbisoftLibrary(path?)` | Returns `[{id, name, installDir, sizeGB}]` or `null` |
| `scanCurseForgeLibrary(path?)` | Returns `[{id, name, version, modCount}]` or `null` |
| `selectFolder()` | Opens folder picker dialog, returns path or null |
| `launchGame(url)` | Calls `shell.openExternal(url)` |

---

## GitHub Setup

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/gaming-community-launcher.git
git push -u origin main
```

Clone on another machine:
```bash
git clone https://github.com/YOUR_USERNAME/gaming-community-launcher.git
cd gaming-community-launcher
npm install
npm run electron:dev
```
