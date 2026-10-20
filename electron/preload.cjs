const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getLanInfo: () => ipcRenderer.invoke('get-lan-info'),
});
