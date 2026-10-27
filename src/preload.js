const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cine', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveToken: (token) => ipcRenderer.invoke('settings:save', token),
  search: (query, kind) => ipcRenderer.invoke('tmdb:search', query, kind),
  details: (id, kind) => ipcRenderer.invoke('tmdb:details', id, kind),
  syncExistingCountries: () => ipcRenderer.invoke('countries:sync-existing'),
  addEntry: (item) => ipcRenderer.invoke('entry:add', item),
  removeFromList: (listId, key) => ipcRenderer.invoke('list:remove', listId, key),
  rankList: (listId, keys) => ipcRenderer.invoke('list:rank', listId, keys)
});
