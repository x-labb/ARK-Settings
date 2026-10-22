// App state: everything the user picked, persisted in this browser only.

const STORAGE_KEY = 'ark-settings:v1';

export function blankState() {
  return {
    values: {},   // setting key -> value, only for settings that differ from the default
    stats: {},    // stat table key -> { [statIndex]: multiplier }
    lists: {},    // struct list key -> [{ field: value }]
    custom: { gus: '', game: '', cmd: '' },
    launch: { map: 'TheIsland_WP', port: 7777 },
    options: { includeDefaults: false, omitManaged: false },
  };
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function normalize(data) {
  const base = blankState();
  if (!isObj(data)) return base;
  return {
    values: isObj(data.values) ? data.values : {},
    stats: isObj(data.stats) ? data.stats : {},
    lists: isObj(data.lists) ? data.lists : {},
    custom: { ...base.custom, ...(isObj(data.custom) ? data.custom : {}) },
    launch: { ...base.launch, ...(isObj(data.launch) ? data.launch : {}) },
    options: { ...base.options, ...(isObj(data.options) ? data.options : {}) },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {}
  return blankState();
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

let state = load();
const listeners = new Set();

function notify(structural) {
  for (const fn of listeners) fn(state, { structural });
}

export const store = {
  get state() { return state; },
  /** Mutate state in place. `structural` asks views to re-render from scratch. */
  update(fn, { structural = false } = {}) {
    fn(state);
    persist();
    notify(structural);
  },
  replace(next) {
    state = normalize(next);
    persist();
    notify(true);
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Small per-browser UI preferences (selected tab, filters), kept apart from settings.
const UI_KEY = 'ark-settings:ui';

export function uiPref(name, fallback) {
  try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}')[name] ?? fallback; } catch { return fallback; }
}

export function setUiPref(name, value) {
  try {
    const prefs = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
    prefs[name] = value;
    localStorage.setItem(UI_KEY, JSON.stringify(prefs));
  } catch {}
}
