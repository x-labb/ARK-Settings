// Reads existing config files back into the app, and explains what it changed on the way.

import { parseIni, parseStruct, tokenize, unquote, Sections } from './ini.js';
import { findSetting, STAT_TABLES, STRUCT_LISTS, FILES } from './catalog.js';
import { blankState, normalize } from './state.js';
import { setValue } from './values.js';
import { GAME_SECTION } from './generate.js';

// Sections a game client writes into GameUserSettings.ini. A server never reads them.
const CLIENT_SECTIONS = new Set([
  'scalabilitygroups',
  '/script/shootergame.shootergameusersettings',
  '/script/engine.gameusersettings',
  'startup',
  '/script/engine.inputsettings',
]);

const STAT_RE = /^(PerLevelStatsMultiplier_[A-Za-z_]+|PlayerBaseStatMultipliers)\[(\d+)\]$/i;

export function parseValue(setting, raw) {
  const v = unquote(String(raw).trim());
  switch (setting.type) {
    case 'bool':
      if (/^(true|1)$/i.test(v)) return true;
      if (/^(false|0)$/i.test(v)) return false;
      return undefined;
    case 'int':
    case 'float': {
      if (v === '') return undefined;
      const n = Number(v);
      if (!Number.isFinite(n)) return undefined;
      return setting.type === 'int' ? Math.trunc(n) : n;
    }
    case 'enum': {
      const opt = setting.options?.find(o => String(o.value).toLowerCase() === v.toLowerCase());
      return opt ? opt.value : v;
    }
    case 'text':
      return v.replace(/\\n/g, '\n');
    default:
      return v;
  }
}

function where(setting) {
  if (setting.file === 'cmd') return 'the command line';
  if (setting.file === 'gus') return `GameUserSettings.ini [${setting.section}]`;
  return 'Game.ini';
}

function readRow(def, value) {
  const struct = parseStruct(value);
  if (!struct) return null;
  const lower = Object.fromEntries(Object.entries(struct).map(([k, v]) => [k.toLowerCase(), v]));
  const row = {};
  for (const f of def.fields) {
    const v = lower[f.name.toLowerCase()];
    if (v === undefined) continue;
    if (f.type === 'float' || f.type === 'int') {
      const n = Number(v);
      if (Number.isFinite(n)) row[f.name] = n;
    } else {
      row[f.name] = v;
    }
  }
  return def.fields.every(f => !f.required || row[f.name]) ? row : null;
}

/**
 * @param {{gus?: string, game?: string, cmd?: string}} texts
 * @param {object} current  the state to merge into when `replace` is false
 */
export function importConfig(texts, current, { replace = true } = {}) {
  const state = replace ? blankState() : normalize(structuredClone(current));
  if (replace) state.options = { ...current.options };

  const report = { applied: 0, custom: new Set(), skipped: 0, warnings: [] };
  const warn = text => report.warnings.push(text);
  const custom = {
    gus: new Sections(),
    game: new Sections(),
    cmd: [],
  };
  if (!replace) {
    custom.gus.merge(state.custom.gus, 'ServerSettings');
    custom.game.merge(state.custom.game, GAME_SECTION);
    custom.cmd.push(...tokenize(state.custom.cmd || ''));
  }

  const apply = (setting, raw) => {
    const v = parseValue(setting, raw);
    if (v === undefined) return false;
    setValue(state, setting, v);
    report.applied++;
    return true;
  };

  function readIni(text, file) {
    const fileName = FILES[file].name;
    const fallback = file === 'gus' ? 'ServerSettings' : GAME_SECTION;
    const seen = new Set();
    const joinedKeys = new Set();

    for (const e of parseIni(text)) {
      const section = e.section || fallback;
      if (!e.key) {
        warn(`Line ${e.line} of ${fileName} is not a setting and was ignored: “${e.value.slice(0, 60)}”.`);
        continue;
      }
      if (e.joined) joinedKeys.add(e.key);

      const stat = e.key.match(STAT_RE);
      if (stat) {
        const table = STAT_TABLES.find(t => t.key.toLowerCase() === stat[1].toLowerCase());
        const index = Number(stat[2]);
        const n = Number(e.value);
        if (table && index < 12 && Number.isFinite(n)) {
          (state.stats[table.key] ??= {})[index] = n;
          report.applied++;
          if (file !== 'game') warn(`${e.key} belongs in Game.ini, not ${fileName}. Moved it.`);
          continue;
        }
      }

      const list = STRUCT_LISTS.find(l => l.key.toLowerCase() === e.key.toLowerCase());
      if (list) {
        const row = readRow(list, e.value);
        if (row) {
          (state.lists[list.key] ??= []).push(row);
          report.applied++;
          if (file !== 'game') warn(`${list.key} belongs in Game.ini, not ${fileName}. Moved it.`);
          continue;
        }
      }

      // ASA ignores MaxPlayers and only takes the player count from -WinLiveMaxPlayers.
      const winLive = findSetting('WinLiveMaxPlayers');
      if (e.key.toLowerCase() === 'maxplayers' && winLive && !findSetting('MaxPlayers')) {
        if (apply(winLive, e.value)) {
          warn(`ASA ignores MaxPlayers (${e.value}). Moved it to the -WinLiveMaxPlayers launch option, which is what sets player slots.`);
          continue;
        }
      }

      const setting = findSetting(e.key);

      if (file === 'gus' && CLIENT_SECTIONS.has(section.toLowerCase())) {
        if (setting && !seen.has(setting.key) && apply(setting, e.value)) {
          seen.add(setting.key);
          warn(`${setting.key} was under [${section}], which only holds game client settings, so the server never read it. Moved it to ${where(setting)}.`);
        } else {
          report.skipped++;
        }
        continue;
      }

      if (setting) {
        if (seen.has(setting.key)) warn(`${setting.key} is set more than once in ${fileName}. Kept the last value (${e.value}).`);
        seen.add(setting.key);
        if (!apply(setting, e.value)) {
          warn(`${setting.key}=${e.value} in ${fileName} isn't a valid value, so it was kept as a custom line.`);
          custom[file].add(section, `${e.key}=${e.value}`);
          report.custom.add(e.key);
        } else if (setting.file === 'cmd') {
          warn(`${setting.key} only works as a launch option, so ARK ignored it in ${fileName}. Moved it to the command line.`);
        } else if (setting.file !== file) {
          warn(`${setting.key} belongs in ${where(setting)}, not ${fileName}. Moved it.`);
        } else if (file === 'gus' && setting.section.toLowerCase() !== section.toLowerCase()) {
          warn(`${setting.key} was under [${section}]. Moved it to [${setting.section}].`);
        }
        continue;
      }

      custom[file].add(section, `${e.key}=${e.value}`);
      report.custom.add(e.key);
    }

    for (const key of joinedKeys) {
      warn(`${key} in ${fileName} was split over several lines. ARK only reads one line per setting, so it was joined back into one.`);
    }
  }

  function readCommand(text) {
    for (const token of tokenize(text)) {
      if (/\.exe$/i.test(token) || /[\\/]ArkAscendedServer/i.test(token)) continue;

      if (!token.startsWith('-')) {
        const [map, ...parts] = token.split('?');
        if (map) state.launch.map = map;
        for (const part of parts) {
          if (!part || part.toLowerCase() === 'listen') continue;
          const eq = part.indexOf('=');
          const key = eq === -1 ? part : part.slice(0, eq);
          const value = eq === -1 ? 'True' : part.slice(eq + 1);
          if (key.toLowerCase() === 'port') {
            const port = Number(value);
            if (Number.isInteger(port)) state.launch.port = port;
            warn('?Port= in the map URL is ignored by ASA. The port is now written as a -port= flag.');
            continue;
          }
          const setting = findSetting(key);
          if (setting && apply(setting, value)) {
            if (setting.file !== 'cmd') warn(`${setting.key} was on the command line. Moved it to ${where(setting)}, which works the same.`);
          } else {
            custom.cmd.push(`?${part}`);
            report.custom.add(key);
          }
        }
        continue;
      }

      const body = token.slice(1);
      const eq = body.indexOf('=');
      const key = eq === -1 ? body : body.slice(0, eq);
      const value = eq === -1 ? 'True' : body.slice(eq + 1);
      if (key.toLowerCase() === 'port') {
        const port = Number(value);
        if (Number.isInteger(port)) state.launch.port = port;
        continue;
      }
      const setting = findSetting(key);
      if (setting && apply(setting, value)) {
        if (setting.file !== 'cmd') warn(`-${key} was given as a flag. Moved it to ${where(setting)}.`);
      } else {
        custom.cmd.push(token);
        report.custom.add(key);
      }
    }
  }

  if (texts.gus?.trim()) readIni(texts.gus, 'gus');
  if (texts.game?.trim()) readIni(texts.game, 'game');
  if (texts.cmd?.trim()) readCommand(texts.cmd);

  state.custom = {
    gus: custom.gus.toString().trim(),
    game: custom.game.toString().trim(),
    cmd: custom.cmd.map(t => (/\s/.test(t) ? `"${t}"` : t)).join(' '),
  };

  return {
    state,
    report: { ...report, custom: [...report.custom] },
  };
}

/** Guesses which file a dropped or pasted text is. */
export function detectKind(name, text) {
  if (/(^|[\\/])game\.ini$/i.test(name)) return 'game';
  if (/gameusersettings|(^|[\\/])gus/i.test(name)) return 'gus';
  if (/\[\s*ServerSettings\s*\]/i.test(text)) return 'gus';
  if (/shootergamemode/i.test(text)) return 'game';
  if (/\?listen|ArkAscendedServer|_WP\?/i.test(text)) return 'cmd';
  return /\.ini$/i.test(name) ? 'gus' : 'cmd';
}
