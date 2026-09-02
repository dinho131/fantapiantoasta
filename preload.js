const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  readConfigFile: (filePath) => ipcRenderer.invoke('read-config-file', filePath),
  readPlayersFile: (filePath) => ipcRenderer.invoke('read-players-file', filePath),
  loadLocale: (lang) => ipcRenderer.invoke('load-locale', lang),
  saveAuctionState: (stateData) => ipcRenderer.invoke('save-auction-state', stateData),
  getSavedSessions: () => ipcRenderer.invoke('get-saved-sessions'),
  loadSavedState: (filePath) => ipcRenderer.invoke('load-saved-state', filePath),
  exportCsv: (data) => ipcRenderer.invoke('export-csv', data)
});
