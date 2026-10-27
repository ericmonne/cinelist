const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="100%" height="100%" fill="#26324a"/><text x="50%" y="50%" fill="#8d9ab0" font-family="sans-serif" font-size="16" text-anchor="middle">Sem pôster</text></svg>');
const imageUrl = (path, size = 'w342') => path ? `https://image.tmdb.org/t/p/${size}${path}` : PLACEHOLDER;
const state = { data: null, currentList: null, search: [], expandedGroups: { decades: false, countries: false, genres: false } };
const el = (id) => document.getElementById(id);

async function refresh() { state.data = await window.cine.getState(); renderNav(); renderStatus(); }
function renderStatus() { el('token-status').textContent = state.data.settings.hasToken ? '● TMDB conectado' : '○ Token necessário'; }
function titleForList(id) {
  if (id === 'general') return 'Lista geral';
  if (id.startsWith('decade:')) return `Década de ${id.slice(7)}`;
  if (id.startsWith('country:')) return state.data.lists.countries[id.slice(8)]?.name || 'País';
  return state.data.lists.genres[id.slice(6)]?.name || 'Gênero';
}
function listEntries(id) {
  let keys = [];
  if (id === 'general') keys = state.data.lists.general;
  else if (id.startsWith('decade:')) keys = state.data.lists.decades[id.slice(7)] || [];
  else if (id.startsWith('country:')) keys = state.data.lists.countries[id.slice(8)]?.keys || [];
  else keys = state.data.lists.genres[id.slice(6)]?.keys || [];
  return keys.map(key => state.data.entries[key]).filter(Boolean);
}
function navButton(label, id, count) {
  const btn = document.createElement('button'); btn.className = `list-link ${state.currentList === id ? 'selected' : ''}`;
  btn.textContent = `${label} (${count})`; btn.onclick = () => openList(id); return btn;
}
function appendGroup(root, groupId, label, items) {
  const group = document.createElement('div'); group.className = 'list-group';
  const heading = document.createElement('button'); heading.className = 'group-title toggle-heading'; heading.type = 'button';
  heading.innerHTML = `<span>${label}</span><span class="toggle-arrow">${state.expandedGroups[groupId] ? '⌃' : '⌄'}</span>`;
  heading.setAttribute('aria-expanded', String(state.expandedGroups[groupId]));
  heading.onclick = () => { state.expandedGroups[groupId] = !state.expandedGroups[groupId]; renderNav(); };
  group.append(heading);
  if (state.expandedGroups[groupId]) {
    if (items.length) items.forEach(({ label: name, id, count }) => group.append(navButton(name, id, count)));
    else { const empty = document.createElement('p'); empty.className = 'group-empty'; empty.textContent = 'Nenhuma lista ainda'; group.append(empty); }
  }
  root.append(group);
}
function renderNav() {
  const root = el('list-nav'); root.replaceChildren();
  root.append(navButton('Lista geral', 'general', state.data.lists.general.length));
  appendGroup(root, 'decades', 'POR DÉCADA', Object.entries(state.data.lists.decades).filter(([, keys]) => keys.length).sort(([a],[b]) => b.localeCompare(a)).map(([decade, keys]) => ({ label: decade, id: `decade:${decade}`, count: keys.length })));
  appendGroup(root, 'countries', 'POR PAÍS', Object.entries(state.data.lists.countries).filter(([, value]) => value.keys.length).sort(([,a],[,b]) => a.name.localeCompare(b.name, 'pt-BR')).map(([id, value]) => ({ label: value.name, id: `country:${id}`, count: value.keys.length })));
  appendGroup(root, 'genres', 'POR GÊNERO', Object.entries(state.data.lists.genres).filter(([, value]) => value.keys.length).sort(([,a],[,b]) => a.name.localeCompare(b.name, 'pt-BR')).map(([id, value]) => ({ label: value.name, id: `genre:${id}`, count: value.keys.length })));
}
function setView(view) {
  ['discover', 'list', 'settings'].forEach(name => el(`${name}-view`).classList.toggle('hidden', name !== view));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
}
function openList(id) { state.currentList = id; setView('list'); el('view-kicker').textContent = 'RANKING PESSOAL'; el('view-title').textContent = titleForList(id); renderNav(); renderList(); }
function showDiscover() { state.currentList = null; setView('discover'); el('view-kicker').textContent = 'CATÁLOGO PESSOAL'; el('view-title').textContent = 'Descobrir'; renderNav(); }
function renderList() {
  const list = el('rank-list'); const entries = listEntries(state.currentList); el('item-count').textContent = `${entries.length} ${entries.length === 1 ? 'título' : 'títulos'}`;
  list.replaceChildren();
  if (!entries.length) { list.innerHTML = '<div class="empty">Nenhum título nesta lista.<br>Adicione algo em “Descobrir” para criar rankings automaticamente.</div>'; return; }
  entries.forEach((entry, index) => {
    const row = document.createElement('article'); row.className = 'rank-row'; row.draggable = true; row.dataset.key = entry.key;
    const num = document.createElement('div'); num.className = 'rank-number'; num.textContent = String(index + 1).padStart(2, '0');
    const img = document.createElement('img'); img.src = imageUrl(entry.poster_path, 'w185'); img.alt = '';
    const text = document.createElement('div'); const title = document.createElement('div'); title.className = 'rank-title'; title.textContent = entry.title;
    const meta = document.createElement('div'); meta.className = 'rank-meta'; meta.textContent = `${entry.kind === 'tv' ? 'Série' : 'Filme'} · ${entry.year || 'sem ano'} · ${entry.genres.map(g => g.name).join(', ') || 'sem gênero'}`; text.append(title, meta);
    const remove = document.createElement('button'); remove.className = 'remove-button'; remove.textContent = 'Remover desta lista'; remove.onclick = async () => { await window.cine.removeFromList(state.currentList, entry.key); await refresh(); renderList(); };
    const drag = document.createElement('div'); drag.className = 'drag-handle'; drag.textContent = '⠿';
    row.append(num, img, text, remove, drag); wireDrag(row); list.append(row);
  });
}
function wireDrag(row) {
  row.addEventListener('dragstart', () => row.classList.add('dragging'));
  row.addEventListener('dragend', async () => { row.classList.remove('dragging'); const keys = [...el('rank-list').querySelectorAll('.rank-row')].map(item => item.dataset.key); await window.cine.rankList(state.currentList, keys); await refresh(); renderList(); });
  row.addEventListener('dragover', event => { event.preventDefault(); const other = event.currentTarget; const dragging = el('rank-list').querySelector('.dragging'); if (dragging && dragging !== other) { const before = event.clientY < other.getBoundingClientRect().top + other.offsetHeight / 2; other.parentNode.insertBefore(dragging, before ? other : other.nextSibling); } });
}
function renderResults() {
  const root = el('search-results'); root.replaceChildren();
  state.search.forEach(item => {
    const node = el('result-template').content.cloneNode(true); const kind = item.kind;
    const title = item.title || item.name; const original = item.original_title || item.original_name; const date = item.release_date || item.first_air_date || '';
    const poster = node.querySelector('.poster'); poster.src = imageUrl(item.poster_path); poster.alt = `Pôster de ${title}`;
    node.querySelector('.media-label').textContent = kind === 'tv' ? 'SÉRIE' : 'FILME'; node.querySelector('h3').textContent = title; node.querySelector('.original-title').textContent = original && original !== title ? original : ' '; node.querySelector('.summary').textContent = item.overview || 'Sem sinopse disponível.'; node.querySelector('.year').textContent = date.slice(0,4) || 'Ano não informado';
    node.querySelector('.add-button').onclick = () => addItem(item, kind); root.append(node);
  });
}
async function addItem(item, kind) {
  try {
    setSearchMessage('Carregando gêneros e dados do título…');
    const details = await window.cine.details(item.id, kind); const date = details.release_date || details.first_air_date || item.release_date || item.first_air_date || '';
    const year = date.slice(0, 4); const decade = year ? `${Math.floor(Number(year) / 10) * 10}s` : 'Sem década';
    const productionCountries = details.production_countries?.map(country => ({ id: country.iso_3166_1, name: country.name })).filter(country => country.id) || [];
    const countries = productionCountries.length ? productionCountries : (details.origin_country || []).map(id => ({ id, name: id }));
    await window.cine.addEntry({ id: details.id, kind, title: details.title || details.name, originalTitle: details.original_title || details.original_name, year, decade, poster_path: details.poster_path, genres: details.genres || [], countries, overview: details.overview || '' });
    await refresh(); setSearchMessage(`“${details.title || details.name}” foi adicionado à lista geral, ${decade}, países e gêneros.`); renderResults();
  } catch (error) { setSearchMessage(error.message, true); }
}
function setSearchMessage(message = '', error = false) { const box = el('search-message'); box.textContent = message; box.classList.toggle('error', error); }

el('search-form').addEventListener('submit', async (event) => { event.preventDefault(); const query = el('search-input').value.trim(); if (!query) return; try { const kind = el('kind-select').value; setSearchMessage('Buscando no TMDB…'); el('search-results').replaceChildren(); state.search = (await window.cine.search(query, kind)).map(item => ({ ...item, kind })); setSearchMessage(state.search.length ? `${state.search.length} resultados encontrados.` : 'Nenhum resultado encontrado.'); renderResults(); } catch (error) { setSearchMessage(error.message, true); } });
el('token-form').addEventListener('submit', async (event) => { event.preventDefault(); const token = el('token-input').value; if (!token) return; await window.cine.saveToken(token); el('token-input').value = ''; await refresh(); el('token-message').textContent = 'Token salvo neste computador.'; });
el('sync-countries-button').addEventListener('click', async () => {
  const button = el('sync-countries-button'); const message = el('token-message');
  try {
    button.disabled = true; button.textContent = 'Atualizando…'; message.textContent = 'Consultando os títulos já registrados no TMDB…';
    const result = await window.cine.syncExistingCountries(); await refresh();
    message.textContent = result.updated ? `Países atualizados em ${result.updated} ${result.updated === 1 ? 'título' : 'títulos'}${result.failed ? `; ${result.failed} não puderam ser consultados.` : '.'}` : (result.failed ? `Não foi possível consultar ${result.failed} título(s).` : 'Todos os títulos já têm seus países atualizados.');
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; button.textContent = 'Atualizar países dos títulos existentes'; }
});
document.querySelectorAll('.nav-item').forEach(button => button.onclick = () => button.dataset.view === 'discover' ? showDiscover() : (setView('settings'), el('view-kicker').textContent = 'PREFERÊNCIAS', el('view-title').textContent = 'Configurações'));

refresh().then(showDiscover);
