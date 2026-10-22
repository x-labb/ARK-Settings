// Turns the app state into GameUserSettings.ini, Game.ini and a launch command.

import { SETTINGS, STAT_TABLES, STRUCT_LISTS, isManaged } from './catalog.js';
import { getValue, formatValue, formatNumber, isChanged } from './values.js';
import { Sections, tokenize } from './ini.js';

export const GAME_SECTION = '/script/shootergame.shootergamemode';
const GUS_ORDER = ['ServerSettings', 'SessionSettings', 'MessageOfTheDay', '/Script/Engine.GameSession'];

function included(state, setting) {
  if (state.options.omitManaged && isManaged(setting)) return false;
  return isChanged(state, setting) || state.options.includeDefaults;
}

export function buildGus(state) {
  const doc = new Sections(GUS_ORDER);
  for (const s of SETTINGS) {
    if (s.file === 'gus' && included(state, s)) doc.add(s.section, `${s.key}=${formatValue(s, getValue(state, s))}`);
  }
  doc.merge(state.custom.gus, 'ServerSettings');
  return { text: doc.toString(), count: doc.lineCount };
}

export function formatStruct(def, row) {
  const parts = def.fields.map(f => {
    const v = row[f.name];
    if (f.type === 'float' || f.type === 'int') return `${f.name}=${formatNumber(v ?? f.default, f.type === 'float')}`;
    return `${f.name}="${String(v ?? '').replace(/"/g, '').trim()}"`;
  });
  return `(${parts.join(',')})`;
}

export const validRows = (def, rows) =>
  (rows || []).filter(row => def.fields.every(f => !f.required || String(row[f.name] ?? '').trim()));

export function buildGame(state) {
  const doc = new Sections([GAME_SECTION]);
  for (const s of SETTINGS) {
    if (s.file === 'game' && included(state, s)) doc.add(GAME_SECTION, `${s.key}=${formatValue(s, getValue(state, s))}`);
  }
  for (const table of STAT_TABLES) {
    const overrides = state.stats[table.key] || {};
    for (let i = 0; i < 12; i++) {
      if (Object.hasOwn(overrides, i)) doc.add(GAME_SECTION, `${table.key}[${i}]=${formatNumber(overrides[i], true)}`);
    }
  }
  for (const def of STRUCT_LISTS) {
    for (const row of validRows(def, state.lists[def.key])) doc.add(GAME_SECTION, `${def.key}=${formatStruct(def, row)}`);
  }
  doc.merge(state.custom.game, GAME_SECTION);
  return { text: doc.toString(), count: doc.lineCount };
}

const quote = v => (/\s/.test(v) ? `"${v}"` : v);

export function buildCommand(state) {
  const omit = state.options.omitManaged;
  const map = String(state.launch.map || 'TheIsland_WP').trim();
  const options = [];
  const flags = [];
  // ASA ignores ?Port= in the map URL; the port has to be a -port= flag.
  if (!omit && state.launch.port) flags.push(`-port=${state.launch.port}`);

  for (const s of SETTINGS) {
    if (s.file !== 'cmd' || !included(state, s)) continue;
    const v = getValue(state, s);
    if (s.cmd === 'option') {
      options.push(`${s.key}=${formatValue(s, v)}`);
    } else if (s.cmd === 'flag' || s.type === 'bool') {
      if (v) flags.push(`-${s.key}`);
    } else if (String(v ?? '') !== '') {
      flags.push(`-${s.key}=${quote(formatValue(s, v))}`);
    }
  }

  for (const token of tokenize(state.custom.cmd || '')) {
    if (token.startsWith('?')) options.push(token.slice(1));
    else flags.push(quote(token));
  }

  const url = [map, 'listen', ...options].join('?');
  return {
    full: ['ArkAscendedServer.exe', quote(url), ...flags].join(' '),
    url,
    map,
    options,
    flags,
    count: options.length + flags.length,
  };
}
