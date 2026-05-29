const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const cp   = require('child_process');
const os   = require('os');

const isDev = !app.isPackaged;

// ── Discord Gateway bot ───────────────────────────────────────────────────────
let gclWin = null;
let discordGW = null;
let discordHB = null;
let discordSeq = null;

function sendToRenderer(ch, data) {
  try { if (gclWin && !gclWin.isDestroyed()) gclWin.webContents.send(ch, data); } catch {}
}

function startDiscordGateway(token, targetGuildId) {
  if (discordGW) { try { discordGW.close(1000); } catch {} }
  clearInterval(discordHB);
  discordSeq = null;

  const sock = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
  discordGW = sock;

  sock.onmessage = ({ data }) => {
    try {
      const { op, d, s, t } = JSON.parse(data);
      if (s != null) discordSeq = s;

      if (op === 10) {
        clearInterval(discordHB);
        discordHB = setInterval(() => {
          if (sock.readyState === 1) sock.send(JSON.stringify({ op:1, d:discordSeq }));
        }, d.heartbeat_interval);
        sock.send(JSON.stringify({ op:2, d:{ token, intents:1|2|128|256, properties:{ os:'win32', browser:'gcl', device:'gcl' } } }));

      } else if (op === 0) {
        if (t === 'READY') {
          sendToRenderer('discord-bot-ready', { user: d.user });

        } else if (t === 'GUILD_CREATE' && (!targetGuildId || d.id === targetGuildId)) {
          sendToRenderer('discord-guild-data', {
            id:   d.id,
            name: d.name,
            members: (d.members||[]).filter(m=>!m.user?.bot).map(m=>({
              id:       m.user.id,
              username: m.user.username,
              nick:     m.nick||null,
              avatar:   m.user.avatar ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=32` : null,
            })),
            presences: (d.presences||[]).map(p=>({
              userId:   p.user.id,
              status:   p.status,
              activity: p.activities?.[0] ? { name:p.activities[0].name, type:p.activities[0].type } : null,
            })),
            voiceStates: (d.voice_states||[]).map(v=>({ userId:v.user_id, channelId:v.channel_id })),
            voiceChannels: (d.channels||[]).filter(c=>c.type===2)
              .map(c=>({ id:c.id, name:c.name, position:c.position }))
              .sort((a,b)=>a.position-b.position),
          });

        } else if (t === 'PRESENCE_UPDATE') {
          sendToRenderer('discord-presence-update', {
            userId:   d.user.id,
            status:   d.status,
            activity: d.activities?.[0] ? { name:d.activities[0].name, type:d.activities[0].type } : null,
          });

        } else if (t === 'VOICE_STATE_UPDATE') {
          sendToRenderer('discord-voice-update', { userId:d.user_id, channelId:d.channel_id });
        }

      } else if (op === 7) {
        startDiscordGateway(token, targetGuildId);
      } else if (op === 9) {
        sendToRenderer('discord-bot-error', { message:'Invalid session — enable Server Members + Presence intents in your bot settings.' });
      }
    } catch {}
  };

  sock.onclose = ({ code }) => {
    clearInterval(discordHB);
    sendToRenderer('discord-bot-disconnected', { code });
    if (code !== 1000 && code !== 1001) setTimeout(() => startDiscordGateway(token, targetGuildId), 5000);
  };

  sock.onerror = () => sendToRenderer('discord-bot-error', { message:'Gateway connection failed — check your internet connection.' });
}

ipcMain.handle('discord-bot-connect',    async (_, { token, guildId }) => { startDiscordGateway(token, guildId||null); return true; });
ipcMain.handle('discord-bot-disconnect', async () => { if (discordGW) { try { discordGW.close(1000); } catch {} discordGW=null; } clearInterval(discordHB); return true; });

// ── IPC: real disk info via PowerShell ────────────────────────────────────────
ipcMain.handle('get-disk-info', async () => {
  try {
    const out = cp.execSync(
      'powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | Select-Object Name,Used,Free | ConvertTo-Json -Compress"',
      { encoding: 'utf8', timeout: 6000 }
    );
    const raw = JSON.parse(out.trim());
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map(d => ({ name: d.Name + ':', total: d.Used + d.Free, used: d.Used, free: d.Free }));
  } catch { return []; }
});

// ── IPC: read real Steam library from local ACF files ─────────────────────────
ipcMain.handle('get-steam-library', async () => {
  try {
    const regOut = cp.execSync(
      'reg query "HKCU\\SOFTWARE\\Valve\\Steam" /v SteamPath',
      { encoding: 'utf8', timeout: 4000 }
    );
    const steamPath = regOut.match(/SteamPath\s+REG_SZ\s+(.+)/)?.[1]?.trim();
    if (!steamPath || !fs.existsSync(steamPath)) return [];

    const libPaths = [steamPath];
    const lfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(lfPath)) {
      for (const m of fs.readFileSync(lfPath, 'utf8').matchAll(/"path"\s+"([^"]+)"/g)) {
        const p = m[1].replace(/\\\\/g, '\\');
        if (!libPaths.includes(p)) libPaths.push(p);
      }
    }

    const games = [];
    for (const lib of libPaths) {
      const dir = path.join(lib, 'steamapps');
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!file.startsWith('appmanifest_') || !file.endsWith('.acf')) continue;
        try {
          const acf   = fs.readFileSync(path.join(dir, file), 'utf8');
          const appid = acf.match(/"appid"\s+"(\d+)"/)?.[1];
          const name  = acf.match(/"name"\s+"([^"]+)"/)?.[1];
          const size  = acf.match(/"SizeOnDisk"\s+"(\d+)"/)?.[1];
          if (appid && name) games.push({ appid: parseInt(appid), name, sizeGB: size ? parseFloat((parseInt(size)/1073741824).toFixed(1)) : 0 });
        } catch {}
      }
    }
    return games;
  } catch { return []; }
});

// ── IPC: read Epic Games installed library ────────────────────────────────────
ipcMain.handle('scan-epic-library', async (_, customPath) => {
  const results = new Map(); // appName → entry

  // 1. LauncherInstalled.dat — always at a fixed path, no guessing needed
  const datPath = 'C:\\ProgramData\\Epic\\UnrealEngineLauncher\\LauncherInstalled.dat';
  if (fs.existsSync(datPath)) {
    try {
      const dat = JSON.parse(fs.readFileSync(datPath, 'utf8'));
      for (const entry of (dat.InstallationList || [])) {
        if (!entry.AppName || !entry.InstallLocation) continue;
        // Use folder name as a readable fallback name
        const folderName = entry.InstallLocation.split(/[/\\]/).filter(Boolean).pop() || entry.AppName;
        results.set(entry.AppName, { appName: entry.AppName, name: folderName, sizeGB: 0 });
      }
    } catch {}
  }

  // 2. Manifest .item files — override/fill display names and sizes
  const manifestsDir = customPath || 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
  if (fs.existsSync(manifestsDir)) {
    const files = fs.readdirSync(manifestsDir).filter(f => f.endsWith('.item'));
    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(manifestsDir, f), 'utf8'));
        if (!data.AppName || !data.DisplayName) continue;
        const sizeGB = data.InstallSize ? parseFloat((data.InstallSize / 1073741824).toFixed(1)) : 0;
        if (results.has(data.AppName)) {
          // Upgrade the dat entry with the proper display name and size
          const existing = results.get(data.AppName);
          existing.name = data.DisplayName;
          existing.sizeGB = sizeGB;
        } else if (data.InstallLocation) {
          results.set(data.AppName, { appName: data.AppName, name: data.DisplayName, sizeGB });
        }
      } catch {}
    }
  }

  if (results.size > 0) return [...results.values()];
  // Neither source found anything — signal UI to ask for a custom path
  if (!customPath && !fs.existsSync(datPath) && !fs.existsSync(manifestsDir)) return null;
  return customPath ? [] : null;
});

// ── IPC: read Ubisoft installed games ─────────────────────────────────────────
ipcMain.handle('scan-ubisoft-library', async (_, customPath) => {
  try {
    const regOut = cp.execSync(
      'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs" /s',
      { encoding: 'utf8', timeout: 5000 }
    );
    const games = [];
    const lines = regOut.split(/\r?\n/);
    let currentId = null;
    for (const line of lines) {
      const keyMatch = line.match(/Installs\\(\d+)\s*$/i);
      if (keyMatch) { currentId = keyMatch[1]; }
      const dirMatch = line.match(/InstallDir\s+REG_SZ\s+(.+)/i);
      if (dirMatch && currentId) {
        const dir = dirMatch[1].trim();
        if (fs.existsSync(dir)) games.push({ id: currentId, name: path.basename(dir), installDir: dir, sizeGB: 0 });
        currentId = null;
      }
    }
    if (games.length > 0) return games;
  } catch {}

  // Fall back to scanning games folder
  const scanDir = customPath || 'C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games';
  if (!fs.existsSync(scanDir)) return customPath ? [] : null;
  const entries = fs.readdirSync(scanDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map((e, i) => ({ id: `ubi_dir_${i}`, name: e.name, installDir: path.join(scanDir, e.name), sizeGB: 0 }));
  return entries.length > 0 ? entries : (customPath ? [] : null);
});

// ── IPC: read CurseForge "My Modpacks" ────────────────────────────────────────
ipcMain.handle('scan-curseforge-library', async (_, customPath) => {
  const defaultDir = path.join(os.homedir(), 'curseforge', 'minecraft', 'Instances');
  const instancesDir = customPath || defaultDir;
  if (!fs.existsSync(instancesDir)) return customPath ? [] : null;

  const entries = fs.readdirSync(instancesDir, { withFileTypes: true }).filter(e => e.isDirectory());
  return entries.map(e => {
    const instancePath = path.join(instancesDir, e.name);
    let name = e.name, version = '', modCount = 0;
    try {
      const jsonPath = path.join(instancePath, 'minecraftinstance.json');
      if (fs.existsSync(jsonPath)) {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        name = data.name || e.name;
        version = data.gameVersion || '';
        modCount = data.installedModCount || 0;
      }
    } catch {}
    return { id: e.name, name, version, modCount };
  });
});

// ── IPC: open folder picker dialog ────────────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: open file picker for game executables ────────────────────────────────
ipcMain.handle('select-game-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Executables', extensions: ['exe'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: scan a folder for image files ───────────────────────────────────────
ipcMain.handle('scan-folder-for-image', async (_, folderPath) => {
  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.ico']);
  try {
    const files = fs.readdirSync(folderPath);
    return files
      .filter(f => imageExts.has(path.extname(f).toLowerCase()))
      .map(f => path.join(folderPath, f));
  } catch { return []; }
});

// ── IPC: launch a local exe via shell ────────────────────────────────────────
ipcMain.handle('launch-exe', async (_, exePath) => {
  shell.openPath(exePath);
});

// ── IPC: launch a game or open a launcher via protocol URL ────────────────────
ipcMain.handle('launch-game', async (_, url) => {
  shell.openExternal(url);
});

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const iconPath = path.join(__dirname, '../public/logos/Gaming-Community-Logo - 1.png');
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#07070e',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  gclWin = win;
  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
