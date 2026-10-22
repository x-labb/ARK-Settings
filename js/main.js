import { store, blankState } from './state.js';
import { PAGES, SETTINGS } from './catalog.js';
import { h, icon, toast, downloadText, readFile } from './ui/dom.js';
import { renderView, renderSidebar } from './ui/views.js';
import { mountOutput } from './ui/output.js';
import { openImport } from './ui/import-dialog.js';

const $ = sel => document.querySelector(sel);
const main = $('#main');
const nav = $('#sidebar');
const search = $('#search');
const body = document.body;

// ---------- routing ----------

function currentPage() {
  const id = location.hash.replace(/^#\/?/, '');
  return PAGES.some(p => p.id === id) ? id : 'server';
}

function render() {
  const q = search.value.trim();
  renderView(main, q ? { search: q } : { page: currentPage() });
  renderSidebar(nav, q ? null : currentPage());
}

window.addEventListener('hashchange', () => {
  search.value = '';
  render();
  main.scrollTop = 0;
  body.classList.remove('nav-open');
});

search.addEventListener('input', () => {
  render();
  main.scrollTop = 0;
});

document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    search.focus();
    search.select();
  } else if (e.key === 'Escape' && document.activeElement === search && search.value) {
    search.value = '';
    render();
  } else if (e.key === 'Escape') {
    body.classList.remove('nav-open', 'files-open');
  }
});

store.subscribe((state, { structural }) => {
  if (structural) render();
  else renderSidebar(nav, search.value.trim() ? null : currentPage());
});

// ---------- top bar ----------

$('#search-icon').append(icon('search'));
$('#btn-nav').append(icon('menu'));
$('#btn-import').append(icon('upload'), h('span', { class: 'btn-text' }, 'Import'));
$('#btn-files').append(icon('file'), h('span', { class: 'btn-text' }, 'Files'));
$('#menu summary').append(icon('more'));

$('#btn-nav').addEventListener('click', () => body.classList.toggle('nav-open'));
$('#btn-files').addEventListener('click', () => body.classList.toggle('files-open'));
$('#backdrop').addEventListener('click', () => body.classList.remove('nav-open', 'files-open'));
$('#btn-import').addEventListener('click', openImport);

// Theme: follows the system until the user picks one.
const themeBtn = $('#btn-theme');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light')) === 'dark';
function paintThemeButton() {
  themeBtn.replaceChildren(icon(isDark() ? 'sun' : 'moon'));
  themeBtn.title = isDark() ? 'Switch to light mode' : 'Switch to dark mode';
}
themeBtn.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ark-settings:theme', next); } catch {}
  paintThemeButton();
});
systemDark.addEventListener('change', paintThemeButton);
paintThemeButton();

// ---------- menu: presets and reset ----------

const menu = $('#menu');
const presetInput = $('#preset-file');
const passwordKeys = SETTINGS.filter(s => s.type === 'password').map(s => s.key);

document.addEventListener('click', e => {
  if (menu.open && !menu.contains(e.target)) menu.open = false;
});

menu.addEventListener('click', e => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  menu.open = false;

  if (action === 'save-preset') {
    const state = structuredClone(store.state);
    for (const key of passwordKeys) delete state.values[key];
    const preset = { app: 'ark-settings', version: 1, savedAt: new Date().toISOString(), state };
    downloadText('ark-settings-preset.json', JSON.stringify(preset, null, 2), 'application/json');
    toast('Preset saved. Passwords were left out.');
  } else if (action === 'load-preset') {
    presetInput.click();
  } else if (action === 'reset-all') {
    if (confirm('Reset every setting to default? This clears the builder in this browser.')) {
      store.replace({ ...blankState(), options: store.state.options });
      toast('Everything is back to default');
    }
  }
});

presetInput.addEventListener('change', async () => {
  const file = presetInput.files[0];
  presetInput.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await readFile(file));
    if (data?.app !== 'ark-settings' || !data.state) throw new Error('not a preset');
    // Presets never carry passwords, so keep the ones already typed in.
    const kept = Object.fromEntries(passwordKeys.filter(k => k in store.state.values).map(k => [k, store.state.values[k]]));
    store.replace({ ...data.state, values: { ...(data.state.values || {}), ...kept } });
    toast(`Loaded ${file.name}`);
  } catch {
    toast('That file isn’t an ARK Settings preset.', { level: 'warn' });
  }
});

// ---------- start ----------

mountOutput($('#output'));
render();
