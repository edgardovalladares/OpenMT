const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getLanInfo: () => ipcRenderer.invoke('get-lan-info'),
  sendLyricsSync: (msg) => ipcRenderer.send('lyrics-sync-update', msg),
  onLyricsSync: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('lyrics-sync-event', listener);
    return () => ipcRenderer.removeListener('lyrics-sync-event', listener);
  },
});
