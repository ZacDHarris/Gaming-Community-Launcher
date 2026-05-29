const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDiskInfo:            ()             => ipcRenderer.invoke('get-disk-info'),
  getSteamLibrary:        ()             => ipcRenderer.invoke('get-steam-library'),
  scanEpicLibrary:        (customPath)   => ipcRenderer.invoke('scan-epic-library',        customPath),
  scanUbisoftLibrary:     (customPath)   => ipcRenderer.invoke('scan-ubisoft-library',     customPath),
  scanCurseForgeLibrary:  (customPath)   => ipcRenderer.invoke('scan-curseforge-library',  customPath),
  selectFolder:           ()             => ipcRenderer.invoke('select-folder'),
  selectGameFile:         ()             => ipcRenderer.invoke('select-game-file'),
  scanFolderForImage:     (dir)          => ipcRenderer.invoke('scan-folder-for-image',    dir),
  launchExe:              (exePath)      => ipcRenderer.invoke('launch-exe',               exePath),
  launchGame:             (url)          => ipcRenderer.invoke('launch-game',              url),

  // Discord bot
  discordBotConnect:      (token, guildId) => ipcRenderer.invoke('discord-bot-connect',    { token, guildId }),
  discordBotDisconnect:   ()               => ipcRenderer.invoke('discord-bot-disconnect'),
  onDiscordReady:         (cb) => ipcRenderer.on('discord-bot-ready',        (_, d) => cb(d)),
  onDiscordGuild:         (cb) => ipcRenderer.on('discord-guild-data',        (_, d) => cb(d)),
  onDiscordPresence:      (cb) => ipcRenderer.on('discord-presence-update',   (_, d) => cb(d)),
  onDiscordVoice:         (cb) => ipcRenderer.on('discord-voice-update',      (_, d) => cb(d)),
  onDiscordError:         (cb) => ipcRenderer.on('discord-bot-error',         (_, d) => cb(d)),
  onDiscordDisconnect:    (cb) => ipcRenderer.on('discord-bot-disconnected',  (_, d) => cb(d)),
  removeDiscordListeners: ()   => ['discord-bot-ready','discord-guild-data','discord-presence-update','discord-voice-update','discord-bot-error','discord-bot-disconnected'].forEach(ch => ipcRenderer.removeAllListeners(ch)),
});
