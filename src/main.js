const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = () => path.join(app.getPath('userData'), 'cinelist.json');
const defaultData = () => ({
  settings: { token: '' },
  entries: {},
  lists: { general: [], decades: {}, countries: {}, genres: {} }
});

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(dbPath(), 'utf8'));
    return { ...defaultData(), ...data, lists: { ...defaultData().lists, ...data.lists } };
  } catch { return defaultData(); }
}
function saveData(data) {
  fs.writeFileSync(dbPath(), JSON.stringify(data, null, 2), 'utf8');
}
function decodeToken(value) {
  if (!value) return '';
  try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(value, 'base64')) : value; }
  catch { return ''; }
}
function encodeToken(value) {
  if (!value) return '';
  return safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(value).toString('base64') : value;
}
function publicState(data) {
  const { token, ...settings } = data.settings;
  return { ...data, settings: { ...settings, hasToken: Boolean(decodeToken(token)) } };
}

ipcMain.handle('state:get', () => publicState(loadData()));
ipcMain.handle('settings:save', (_event, token) => {
  const data = loadData();
  data.settings.token = encodeToken(token.trim());
  saveData(data);
  return publicState(data);
});
ipcMain.handle('tmdb:search', async (_event, query, kind) => {
  const token = decodeToken(loadData().settings.token);
  if (!token) throw new Error('Adicione o token de leitura da API do TMDB nas configurações.');
  const endpoint = kind === 'tv' ? 'tv' : 'movie';
  const search = async (language) => {
    const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
    url.search = new URLSearchParams({ query, language, include_adult: 'false' });
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
    if (!response.ok) throw new Error(response.status === 401 ? 'Token TMDB inválido.' : `TMDB respondeu ${response.status}.`);
    return (await response.json()).results || [];
  };
  const resultSets = await Promise.all([search('pt-BR'), search('en-US')]);
  const found = new Map();
  resultSets.flat().forEach((item) => found.set(item.id, item));
  return [...found.values()].slice(0, 20);
});
ipcMain.handle('tmdb:details', async (_event, id, kind) => {
  const token = decodeToken(loadData().settings.token);
  if (!token) throw new Error('Adicione o token de leitura da API do TMDB nas configurações.');
  const endpoint = kind === 'tv' ? 'tv' : 'movie';
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}/${id}`);
  url.searchParams.set('language', 'pt-BR');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!response.ok) throw new Error(`Não foi possível abrir os detalhes (${response.status}).`);
  return response.json();
});
ipcMain.handle('entry:add', (_event, item) => {
  const data = loadData();
  const key = `${item.kind}:${item.id}`;
  data.entries[key] = { ...item, key, countriesSyncedAt: new Date().toISOString(), addedAt: data.entries[key]?.addedAt || new Date().toISOString() };
  const listKeys = ['general', `decade:${item.decade}`, ...item.countries.map((country) => `country:${country.id}`), ...item.genres.map((genre) => `genre:${genre.id}`)];
  for (const listKey of listKeys) {
    if (listKey === 'general') data.lists.general = addOnce(data.lists.general, key);
    else if (listKey.startsWith('decade:')) {
      const decade = listKey.slice(7); data.lists.decades[decade] = addOnce(data.lists.decades[decade] || [], key);
    } else if (listKey.startsWith('country:')) {
      const countryId = listKey.slice(8); data.lists.countries[countryId] = { name: item.countries.find(c => c.id === countryId)?.name || countryId, keys: addOnce(data.lists.countries[countryId]?.keys || [], key) };
    } else {
      const genreId = listKey.slice(6); data.lists.genres[genreId] = { name: item.genres.find(g => String(g.id) === genreId)?.name || 'Gênero', keys: addOnce(data.lists.genres[genreId]?.keys || [], key) };
    }
  }
  saveData(data); return publicState(data);
});
ipcMain.handle('countries:sync-existing', async () => {
  const data = loadData();
  const token = decodeToken(data.settings.token);
  if (!token) throw new Error('Adicione o token de leitura da API do TMDB antes de atualizar os países.');
  const pending = Object.values(data.entries).filter(entry => !entry.countriesSyncedAt);
  let updated = 0;
  let failed = 0;
  for (const entry of pending) {
    try {
      const endpoint = entry.kind === 'tv' ? 'tv' : 'movie';
      const url = new URL(`https://api.themoviedb.org/3/${endpoint}/${entry.id}`);
      url.searchParams.set('language', 'pt-BR');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
      if (!response.ok) throw new Error(String(response.status));
      const details = await response.json();
      const production = details.production_countries?.map(country => ({ id: country.iso_3166_1, name: country.name })).filter(country => country.id) || [];
      entry.countries = production.length ? production : (details.origin_country || []).map(id => ({ id, name: id }));
      entry.countriesSyncedAt = new Date().toISOString();
      for (const country of entry.countries) {
        const countryId = String(country.id);
        data.lists.countries[countryId] = { name: country.name || countryId, keys: addOnce(data.lists.countries[countryId]?.keys || [], entry.key) };
      }
      updated++;
    } catch { failed++; }
  }
  saveData(data);
  return { updated, failed };
});
ipcMain.handle('list:remove', (_event, listId, key) => {
  const data = loadData();
  if (listId === 'general') data.lists.general = data.lists.general.filter(item => item !== key);
  else if (listId.startsWith('decade:')) { const d = listId.slice(7); data.lists.decades[d] = (data.lists.decades[d] || []).filter(item => item !== key); }
  else if (listId.startsWith('country:')) { const c = listId.slice(8); if (data.lists.countries[c]) data.lists.countries[c].keys = data.lists.countries[c].keys.filter(item => item !== key); }
  else { const g = listId.slice(6); if (data.lists.genres[g]) data.lists.genres[g].keys = data.lists.genres[g].keys.filter(item => item !== key); }
  saveData(data); return publicState(data);
});
ipcMain.handle('list:rank', (_event, listId, keys) => {
  const data = loadData();
  if (listId === 'general') data.lists.general = keys;
  else if (listId.startsWith('decade:')) data.lists.decades[listId.slice(7)] = keys;
  else if (listId.startsWith('country:') && data.lists.countries[listId.slice(8)]) data.lists.countries[listId.slice(8)].keys = keys;
  else if (data.lists.genres[listId.slice(6)]) data.lists.genres[listId.slice(6)].keys = keys;
  saveData(data); return publicState(data);
});
function addOnce(list, key) { return list.includes(key) ? list : [...list, key]; }

function createWindow() {
  const win = new BrowserWindow({ width: 1360, height: 860, minWidth: 900, minHeight: 650, backgroundColor: '#0b1020', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
