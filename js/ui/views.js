// Main-area pages and the sidebar.

import { h, icon } from './dom.js';
import {
  CATEGORIES, TOOL_PAGES, PAGES, SETTINGS, MAPS, FILES, STATS, STAT_TABLES, STRUCT_LISTS, settingsIn,
} from '../catalog.js';
import { store, uiPref, setUiPref } from '../state.js';
import { getValue, setValue, isChanged, displayValue, same } from '../values.js';
import { control } from './controls.js';
import { RESOURCE_CLASSES, DINO_CLASSES } from '../data/classes.js';
import { validRows } from '../generate.js';
import { blankState } from '../state.js';

const DEFAULT_LAUNCH = blankState().launch;

// ---------- counts ----------

const launchChanges = st => (st.launch.map !== DEFAULT_LAUNCH.map ? 1 : 0) + (st.launch.port !== DEFAULT_LAUNCH.port ? 1 : 0);

export function pageChanges(st, pageId) {
  if (pageId === 'stats') return Object.values(st.stats).reduce((n, t) => n + Object.keys(t).length, 0);
  if (pageId === 'lists') return STRUCT_LISTS.reduce((n, def) => n + validRows(def, st.lists[def.key]).length, 0);
  if (pageId === 'custom') {
    return ['gus', 'game', 'cmd'].reduce((n, k) => n + (st.custom[k] || '').split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('[')).length, 0);
  }
  const n = settingsIn(pageId).filter(s => isChanged(st, s)).length;
  return pageId === 'launch' ? n + launchChanges(st) : n;
}

// ---------- sidebar ----------

export function renderSidebar(nav, activeId) {
  const st = store.state;
  const link = page => {
    const n = pageChanges(st, page.id);
    return h('a', {
      class: 'nav-link',
      href: `#/${page.id}`,
      'aria-current': page.id === activeId ? 'page' : null,
    }, h('span', {}, page.label), n ? h('span', { class: 'nav-count', title: `${n} changed` }, n) : null);
  };
  const total = PAGES.reduce((n, p) => n + pageChanges(st, p.id), 0);
  nav.replaceChildren(
    h('div', { class: 'nav-group' }, h('div', { class: 'nav-label' }, 'Settings'), CATEGORIES.map(link)),
    h('div', { class: 'nav-group' }, h('div', { class: 'nav-label' }, 'Advanced'), TOOL_PAGES.map(link)),
    h('div', { class: 'nav-foot' },
      h('div', {}, total ? `${total} change${total === 1 ? '' : 's'} from default` : 'Everything is at default'),
      h('div', { class: 'nav-foot-muted' }, 'Saved in this browser only.')),
  );
}

// ---------- shared bits ----------

function keyLabel(s) {
  if (s.file !== 'cmd') return s.key;
  if (s.cmd === 'option') return `?${s.key}=`;
  if (s.cmd === 'flag' || s.type === 'bool') return `-${s.key}`;
  return `-${s.key}=`;
}

function settingRow(s) {
  const changed = isChanged(store.state, s);
  const ctrl = control(s, getValue(store.state, s), v => {
    store.update(st => setValue(st, s, v));
    row.classList.toggle('changed', isChanged(store.state, s));
  });
  const reset = h('button', {
    type: 'button',
    class: 'icon-btn reset',
    title: 'Reset to default',
    'aria-label': `Reset ${s.label} to default`,
    onclick: () => {
      store.update(st => setValue(st, s, s.default));
      row.replaceWith(settingRow(s));
    },
  }, icon('reset'));

  const row = h('div', { class: `setting${changed ? ' changed' : ''}`, id: `s-${s.key}` },
    h('div', { class: 'setting-info' },
      h('div', { class: 'setting-title' },
        h('label', { for: ctrl.id }, s.label),
        h('span', { class: `badge badge-${s.file}`, title: `Written to ${FILES[s.file].name}` }, FILES[s.file].short)),
      h('code', { class: 'setting-key' }, keyLabel(s)),
      s.desc ? h('p', { class: 'setting-desc' }, s.desc) : null),
    h('div', { class: 'setting-control' },
      h('div', { class: 'control-line' }, ctrl.el, reset),
      h('div', { class: 'setting-default' }, `Default: ${displayValue(s, s.default)}`)),
  );
  return row;
}

function pageHead(page, { onReset, extra } = {}) {
  const n = pageChanges(store.state, page.id);
  return h('header', { class: 'page-head' },
    h('div', { class: 'page-title' },
      h('h1', {}, page.label),
      page.desc ? h('p', {}, page.desc) : null),
    h('div', { class: 'page-actions' },
      extra || null,
      onReset && n ? h('button', {
        type: 'button',
        class: 'btn btn-ghost',
        onclick: () => {
          if (confirm(`Reset ${n} change${n === 1 ? '' : 's'} on this page to default?`)) onReset();
        },
      }, icon('reset'), 'Reset page') : null),
  );
}

function rowsCard(settings) {
  return h('div', { class: 'card setting-list' }, settings.map(settingRow));
}

// ---------- category pages ----------

function categoryPage(page) {
  const changedOnly = uiPref('changedOnly', false);
  const all = settingsIn(page.id);
  const visible = changedOnly ? all.filter(s => isChanged(store.state, s)) : all;
  const basic = visible.filter(s => !s.advanced);
  const advanced = visible.filter(s => s.advanced);

  const filter = h('label', { class: 'chip-toggle' },
    h('input', {
      type: 'checkbox',
      checked: changedOnly,
      onchange: e => { setUiPref('changedOnly', e.target.checked); store.update(() => {}, { structural: true }); },
    }),
    h('span', {}, 'Changed only'));

  const nodes = [
    pageHead(page, {
      extra: filter,
      onReset: () => store.update(st => {
        for (const s of all) delete st.values[s.key];
        if (page.id === 'launch') st.launch = { ...DEFAULT_LAUNCH };
      }, { structural: true }),
    }),
  ];

  if (page.id === 'launch') nodes.push(launchCard());

  if (!all.length) {
    nodes.push(h('div', { class: 'empty' }, 'No settings in this category yet.'));
  } else if (!visible.length) {
    nodes.push(h('div', { class: 'empty' }, 'Nothing changed on this page.'));
  } else {
    if (basic.length) nodes.push(rowsCard(basic));
    if (advanced.length) {
      const open = changedOnly || advanced.some(s => isChanged(store.state, s));
      nodes.push(h('details', { class: 'advanced', open },
        h('summary', {}, `Advanced (${advanced.length})`),
        rowsCard(advanced)));
    }
  }
  return nodes;
}

function launchCard() {
  const st = store.state;
  const known = MAPS.some(m => m.id === st.launch.map);
  const customInput = h('input', {
    class: 'input',
    type: 'text',
    spellcheck: 'false',
    placeholder: 'e.g. Astraeos_WP',
    value: known ? '' : st.launch.map,
    hidden: known,
    'aria-label': 'Custom map ID',
    oninput: e => store.update(s => { s.launch.map = e.target.value.trim(); }),
  });
  const select = h('select', {
    class: 'input',
    id: 'launch-map',
    onchange: e => {
      const v = e.target.value;
      customInput.hidden = v !== '__custom';
      if (v === '__custom') {
        customInput.focus();
        store.update(s => { s.launch.map = customInput.value.trim(); });
      } else {
        store.update(s => { s.launch.map = v; });
      }
    },
  },
  MAPS.map(m => h('option', { value: m.id, selected: m.id === st.launch.map }, m.label)),
  h('option', { value: '__custom', selected: !known }, 'Other map (type its ID)…'));

  const port = h('input', {
    class: 'input input-num',
    id: 'launch-port',
    type: 'number',
    min: 1,
    max: 65535,
    value: String(st.launch.port),
    oninput: e => {
      const n = Number(e.target.value);
      if (Number.isInteger(n) && n > 0 && n < 65536) store.update(s => { s.launch.port = n; });
    },
  });

  return h('div', { class: 'card setting-list' },
    h('div', { class: 'setting' },
      h('div', { class: 'setting-info' },
        h('div', { class: 'setting-title' }, h('label', { for: 'launch-map' }, 'Map'), h('span', { class: 'badge badge-cmd' }, 'Launch')),
        h('code', { class: 'setting-key' }, `${st.launch.map || 'Map'}?listen`),
        h('p', { class: 'setting-desc' }, 'The map the server loads. Mod maps need their mod ID in the mods option too.')),
      h('div', { class: 'setting-control' }, select, customInput)),
    h('div', { class: 'setting' },
      h('div', { class: 'setting-info' },
        h('div', { class: 'setting-title' }, h('label', { for: 'launch-port' }, 'Game port'), h('span', { class: 'badge badge-cmd' }, 'Launch')),
        h('code', { class: 'setting-key' }, '-port='),
        h('p', { class: 'setting-desc' }, 'UDP port players connect to. Forward it on your router. Each server on the same machine needs its own.')),
      h('div', { class: 'setting-control' },
        h('div', { class: 'control-line' }, port),
        h('div', { class: 'setting-default' }, `Default: ${DEFAULT_LAUNCH.port}`))),
  );
}

// ---------- stats ----------

function statsPage(page) {
  const st = store.state;
  const head = h('tr', {}, h('th', { scope: 'col' }, 'Stat'),
    STAT_TABLES.map(t => h('th', { scope: 'col', title: t.desc }, t.label, h('code', {}, t.key.replace('PerLevelStatsMultiplier_', 'PerLevel…_')))));

  const cell = (table, i) => {
    if (table.ignored.includes(i)) return h('td', { class: 'stat-na', title: 'The game ignores this stat here' }, '—');
    const overrides = st.stats[table.key] || {};
    const has = Object.hasOwn(overrides, i);
    const td = h('td', { class: has ? 'changed' : '' });
    const input = h('input', {
      class: 'input input-num input-cell',
      type: 'number',
      step: 'any',
      min: 0,
      placeholder: String(table.defaults[i]),
      value: has ? String(overrides[i]) : '',
      'aria-label': `${table.label}: ${STATS[i]}`,
      oninput: e => {
        const t = e.target.value.trim();
        const n = Number(t);
        store.update(s => {
          const o = (s.stats[table.key] ??= {});
          if (t === '' || !Number.isFinite(n) || same(n, table.defaults[i])) delete o[i];
          else o[i] = n;
          if (!Object.keys(o).length) delete s.stats[table.key];
        });
        td.classList.toggle('changed', Object.hasOwn(store.state.stats[table.key] || {}, i));
      },
    });
    td.append(input);
    return td;
  };

  const body = STATS.map((name, i) => h('tr', {}, h('th', { scope: 'row' }, h('span', { class: 'stat-index' }, i), name), STAT_TABLES.map(t => cell(t, i))));

  return [
    pageHead(page, { onReset: () => store.update(s => { s.stats = {}; }, { structural: true }) }),
    h('p', { class: 'page-note' }, 'Empty cells use the default shown in grey. Type a value to override it. A value of 0 counts as 1, so use 0.01 to nearly switch a stat off.'),
    h('div', { class: 'card table-wrap' }, h('table', { class: 'stat-table' }, h('thead', {}, head), h('tbody', {}, body))),
    h('div', { class: 'legend' }, STAT_TABLES.map(t => h('div', {}, h('strong', {}, t.label), ` — ${t.desc}`))),
  ];
}

// ---------- class overrides ----------

function datalists() {
  return [
    h('datalist', { id: 'dl-resources' }, RESOURCE_CLASSES.map(([v, label]) => h('option', { value: v }, label))),
    h('datalist', { id: 'dl-dinos' }, DINO_CLASSES.map(([v, label]) => h('option', { value: v }, label))),
  ];
}

function listCard(def) {
  const rowsBox = h('div', { class: 'list-rows' });
  const rows = () => store.state.lists[def.key] || [];

  const paint = () => {
    const items = rows();
    rowsBox.replaceChildren(
      ...(items.length ? items.map((row, i) => listRow(def, row, i, paint)) : [h('div', { class: 'list-empty' }, 'No entries.')]),
    );
  };

  const add = h('button', {
    type: 'button',
    class: 'btn btn-ghost',
    onclick: () => {
      store.update(s => { (s.lists[def.key] ??= []).push({}); });
      paint();
      rowsBox.querySelector('.list-row:last-child input')?.focus();
    },
  }, icon('plus'), 'Add');

  paint();
  return h('section', { class: 'card list-card' },
    h('div', { class: 'list-head' },
      h('div', {},
        h('h2', {}, def.label),
        h('p', {}, def.desc),
        h('code', { class: 'setting-key' }, def.key)),
      add),
    h('div', { class: 'list-cols' }, def.fields.map(f => h('span', {}, f.label)), h('span', {})),
    rowsBox);
}

function listRow(def, row, index, repaint) {
  const set = (field, value) => store.update(s => {
    const r = s.lists[def.key][index];
    if (value === '' || value == null) delete r[field];
    else r[field] = value;
  });
  return h('div', { class: 'list-row' },
    def.fields.map(f => {
      const numeric = f.type === 'float' || f.type === 'int';
      return h('input', {
        class: `input${numeric ? ' input-num' : ''}`,
        type: numeric ? 'number' : 'text',
        step: numeric ? 'any' : null,
        spellcheck: 'false',
        list: f.suggest ? `dl-${f.suggest}` : null,
        placeholder: numeric ? String(f.default) : f.suggest === 'dinos' ? 'e.g. Rex_Character_BP_C' : f.suggest === 'resources' ? 'e.g. PrimalItemResource_Stone_C' : '',
        value: row[f.name] ?? '',
        'aria-label': f.label,
        oninput: e => {
          const t = e.target.value.trim();
          if (!numeric) return set(f.name, t);
          const n = Number(t);
          set(f.name, t === '' || !Number.isFinite(n) ? null : n);
        },
      });
    }),
    h('button', {
      type: 'button',
      class: 'icon-btn',
      title: 'Remove',
      'aria-label': 'Remove entry',
      onclick: () => {
        store.update(s => {
          s.lists[def.key].splice(index, 1);
          if (!s.lists[def.key].length) delete s.lists[def.key];
        });
        repaint();
      },
    }, icon('trash')));
}

function listsPage(page) {
  return [
    pageHead(page, { onReset: () => store.update(s => { s.lists = {}; }, { structural: true }) }),
    h('p', { class: 'page-note' }, 'Class names are the blueprint class IDs (see the ARK wiki’s creature and item ID pages). Suggestions appear as you type, and mod classes work too.'),
    datalists(),
    STRUCT_LISTS.map(listCard),
  ];
}

// ---------- custom lines ----------

function customPage(page) {
  const area = (key, label, help, placeholder) => {
    const ta = h('textarea', {
      class: 'input code-input',
      rows: 8,
      spellcheck: 'false',
      placeholder,
      oninput: e => store.update(s => { s.custom[key] = e.target.value; }),
    });
    ta.value = store.state.custom[key] || '';
    return h('section', { class: 'card custom-card' },
      h('h2', {}, label),
      h('p', {}, help),
      ta);
  };
  return [
    pageHead(page, { onReset: () => store.update(s => { s.custom = { gus: '', game: '', cmd: '' }; }, { structural: true }) }),
    area('gus', 'GameUserSettings.ini', 'Lines without a [Section] header go under [ServerSettings].', 'SomeSetting=True\n\n[SomeOtherSection]\nKey=Value'),
    area('game', 'Game.ini', 'Lines without a header go under [/script/shootergame.shootergamemode]. Good for ConfigOverride… entries, supply crate loot and spawn changes.', 'ConfigOverrideItemCraftingCosts=(ItemClassString="PrimalItemResource_MetalIngot_C",BaseCraftingResourceRequirements=((ResourceItemTypeString="PrimalItemResource_Metal_C",BaseResourceRequirement=1.0,bCraftingRequireExactResourceType=false)))'),
    area('cmd', 'Command line', 'Extra launch arguments. Start ?Key=Value options with ? and flags with -.', '?SomeOption=True -SomeFlag'),
  ];
}

// ---------- search ----------

function searchPage(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = SETTINGS.filter(s => {
    const hay = `${s.key} ${s.label} ${s.desc || ''}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
  const nodes = [h('header', { class: 'page-head' }, h('div', { class: 'page-title' },
    h('h1', {}, `${hits.length} result${hits.length === 1 ? '' : 's'}`),
    h('p', {}, `for “${query}”`)))];
  if (!hits.length) {
    nodes.push(h('div', { class: 'empty' }, 'No setting matches. Per-level stats and class overrides are under Advanced.'));
    return nodes;
  }
  for (const cat of CATEGORIES) {
    const group = hits.filter(s => s.category === cat.id);
    if (!group.length) continue;
    nodes.push(h('h2', { class: 'group-title' }, cat.label), rowsCard(group));
  }
  return nodes;
}

// ---------- entry ----------

export function renderView(main, { page: pageId, search }) {
  let nodes;
  if (search) {
    nodes = searchPage(search);
  } else {
    const page = PAGES.find(p => p.id === pageId) || PAGES[0];
    if (page.id === 'stats') nodes = statsPage(page);
    else if (page.id === 'lists') nodes = listsPage(page);
    else if (page.id === 'custom') nodes = customPage(page);
    else nodes = categoryPage(page);
  }
  main.replaceChildren(h('div', { class: 'page' }, nodes));
}
