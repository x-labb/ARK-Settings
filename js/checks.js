// Plain-language warnings about combinations that won't do what people expect.

import { findSetting, SETTINGS } from './catalog.js';
import { getValue, isChanged } from './values.js';
import { parseIni, tokenize } from './ini.js';

export function runChecks(state) {
  const out = [];
  const warn = text => out.push({ level: 'warn', text });
  const info = text => out.push({ level: 'info', text });
  const val = key => {
    const s = findSetting(key);
    return s ? getValue(state, s) : undefined;
  };
  const changed = key => {
    const s = findSetting(key);
    return !!s && isChanged(state, s);
  };
  const managedOmitted = state.options.omitManaged;

  if (!managedOmitted && val('RCONEnabled') === true) {
    const pw = String(val('ServerAdminPassword') || '');
    if (pw.length < 10) {
      warn('RCON is on and the admin password is short or empty. Anyone who can reach the RCON port and guess it gets full admin. Use 10+ characters, or keep the RCON port closed on your router.');
    }
  } else if (!managedOmitted && findSetting('ServerAdminPassword') && !val('ServerAdminPassword')) {
    info('No admin password set, so nobody can use admin commands in game.');
  }

  if (changed('KickIdlePlayersPeriod') && findSetting('EnableIdlePlayerKick') && !val('EnableIdlePlayerKick')) {
    warn('KickIdlePlayersPeriod does nothing unless the EnableIdlePlayerKick launch option is on.');
  }

  if (val('PreventTribeAlliances') === true && changed('MaxAlliancesPerTribe')) {
    info('Alliances are turned off (PreventTribeAlliances), so MaxAlliancesPerTribe has no effect.');
  }

  const save = val('AutoSavePeriodMinutes');
  if (changed('AutoSavePeriodMinutes') && typeof save === 'number' && save > 0 && save < 5) {
    info(`Saving every ${save} minute${save === 1 ? '' : 's'} can cause lag spikes once the save file grows. 10–15 minutes is typical.`);
  }

  if (changed('MaxPlayers') && changed('WinLiveMaxPlayers') && val('MaxPlayers') !== val('WinLiveMaxPlayers')) {
    warn(`Player slots are set twice with different values (MaxPlayers ${val('MaxPlayers')}, WinLiveMaxPlayers ${val('WinLiveMaxPlayers')}). Keep one.`);
  }

  // Keys typed in Custom lines that the builder also writes end up twice in the file.
  const builderKeys = new Set(SETTINGS.filter(s => isChanged(state, s)).map(s => s.key.toLowerCase()));
  const dupes = new Set();
  for (const text of [state.custom.gus, state.custom.game]) {
    for (const e of parseIni(text || '')) {
      if (e.key && builderKeys.has(e.key.toLowerCase())) dupes.add(e.key);
    }
  }
  for (const token of tokenize(state.custom.cmd || '')) {
    const key = token.replace(/^[?-]/, '').split('=')[0];
    if (builderKeys.has(key.toLowerCase())) dupes.add(key);
  }
  for (const key of dupes) warn(`${key} is set both in Custom lines and in the builder, so it will appear twice.`);

  return out;
}
