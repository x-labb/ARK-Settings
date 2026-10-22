// Everything the UI knows about: pages, scalar settings, stat tables and class lists.

import { SETTINGS as RAW_SETTINGS, MAPS } from './data/settings.js';

export { MAPS };

export const CATEGORIES = [
  { id: 'server', label: 'Server', desc: 'Name, passwords, player slots, RCON and the message of the day.' },
  { id: 'launch', label: 'Launch options', desc: 'Map, port and the options that only work on the command line.' },
  { id: 'general', label: 'Gameplay', desc: 'Difficulty, day and night, HUD and general rules.' },
  { id: 'rates', label: 'Rates', desc: 'XP, harvesting, taming and resource respawn.' },
  { id: 'players', label: 'Players', desc: 'Survivor damage, resistance, drain and recovery.' },
  { id: 'dinos', label: 'Dinos', desc: 'Wild and tamed creatures, tame limits, flyers and cryopods.' },
  { id: 'breeding', label: 'Breeding', desc: 'Mating, eggs, maturation and imprinting.' },
  { id: 'structures', label: 'Structures', desc: 'Building limits, decay, pickup, platforms and turrets.' },
  { id: 'items', label: 'Items & loot', desc: 'Stack sizes, spoiling, loot quality and crafting.' },
  { id: 'pvp', label: 'PvP & PvE', desc: 'Game mode, offline raid protection and friendly fire.' },
  { id: 'tribes', label: 'Tribes', desc: 'Tribe size, alliances and tribe logs.' },
  { id: 'world', label: 'World', desc: 'Crops, corpses, bosses and world events.' },
  { id: 'engrams', label: 'Engrams', desc: 'Engram points, respecs and explorer notes.' },
];

export const TOOL_PAGES = [
  { id: 'stats', label: 'Stat multipliers', desc: 'Per-level and base stat multipliers for survivors and creatures, written to Game.ini.' },
  { id: 'lists', label: 'Class overrides', desc: 'Per-resource and per-species multipliers, creature swaps and engram unlocks, written to Game.ini.' },
  { id: 'custom', label: 'Custom lines', desc: 'Anything the builder does not cover. These lines are added to the files as they are.' },
];

export const PAGES = [...CATEGORIES, ...TOOL_PAGES];

export const FILES = {
  gus: { name: 'GameUserSettings.ini', short: 'GUS' },
  game: { name: 'Game.ini', short: 'Game.ini' },
  cmd: { name: 'Command line', short: 'Launch' },
};

const TYPE_DEFAULT = { bool: false, int: 0, float: 0 };
const categoryIds = new Set(CATEGORIES.map(c => c.id));

export const SETTINGS = [];
{
  const seen = new Set();
  for (const raw of RAW_SETTINGS) {
    if (!raw || !raw.key) continue;
    const lower = raw.key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    const type = raw.type || 'string';
    SETTINGS.push({
      ...raw,
      type,
      file: raw.file || 'gus',
      section: (raw.file || 'gus') === 'gus' ? raw.section || 'ServerSettings' : undefined,
      category: categoryIds.has(raw.category) ? raw.category : 'general',
      label: raw.label || raw.key,
      default: raw.default ?? TYPE_DEFAULT[type] ?? '',
    });
  }
}

const BY_KEY = new Map(SETTINGS.map(s => [s.key.toLowerCase(), s]));

export const findSetting = key => BY_KEY.get(String(key).toLowerCase());

export const settingsIn = category => SETTINGS.filter(s => s.category === category);

/** Settings that host panels (AMP, Nitrado, …) usually fill in from their own fields. */
export const MANAGED_KEYS = new Set([
  'sessionname', 'serverpassword', 'serveradminpassword', 'spectatorpassword',
  'rconenabled', 'rconport', 'maxplayers', 'winlivemaxplayers', 'mods', 'serverplatform',
  'clusterid', 'clusterdiroverride',
]);

export const isManaged = setting => MANAGED_KEYS.has(setting.key.toLowerCase());

export const STATS = [
  'Health', 'Stamina', 'Torpidity', 'Oxygen', 'Food', 'Water',
  'Temperature', 'Weight', 'Melee damage', 'Movement speed', 'Fortitude', 'Crafting skill',
];

const ones = () => Array(12).fill(1);

// Defaults and unused indexes follow ark.wiki.gg/wiki/Server_configuration.
// Creatures have no water, temperature, fortitude or crafting skill stat.
const CREATURE_UNUSED = [5, 6, 10, 11];

export const STAT_TABLES = [
  {
    key: 'PerLevelStatsMultiplier_Player',
    label: 'Survivor, per level',
    desc: 'How much a survivor gains each time a point goes into the stat.',
    defaults: ones(),
    ignored: [],
  },
  {
    key: 'PlayerBaseStatMultipliers',
    label: 'Survivor, base',
    desc: 'Scales the stat a fresh survivor starts with.',
    defaults: ones(),
    ignored: [6, 8, 9, 10, 11],
  },
  {
    key: 'PerLevelStatsMultiplier_DinoWild',
    label: 'Wild, per level',
    desc: 'Stat gained per level by wild creatures.',
    defaults: ones(),
    ignored: CREATURE_UNUSED,
  },
  {
    key: 'PerLevelStatsMultiplier_DinoTamed',
    label: 'Tamed, per level',
    desc: 'Stat gained per point a player puts into a tamed creature.',
    defaults: [0.2, 1, 1, 1, 1, 1, 1, 1, 0.17, 1, 1, 1],
    ignored: CREATURE_UNUSED,
  },
  {
    key: 'PerLevelStatsMultiplier_DinoTamed_Add',
    label: 'Tamed, taming bonus (add)',
    desc: 'Flat bonus a creature gets when it is tamed.',
    defaults: [0.14, 1, 1, 1, 1, 1, 1, 1, 0.14, 1, 1, 1],
    ignored: CREATURE_UNUSED,
  },
  {
    key: 'PerLevelStatsMultiplier_DinoTamed_Affinity',
    label: 'Tamed, taming bonus (effectiveness)',
    desc: 'Bonus scaled by taming effectiveness.',
    defaults: [0.44, 1, 1, 1, 1, 1, 1, 1, 0.44, 1, 1, 1],
    ignored: CREATURE_UNUSED,
  },
];

export const STRUCT_LISTS = [
  {
    key: 'HarvestResourceItemAmountClassMultipliers',
    label: 'Harvest amount per resource',
    desc: 'Multiplies how much of one resource you get, on top of the global harvest amount.',
    fields: [
      { name: 'ClassName', label: 'Resource', suggest: 'resources', required: true },
      { name: 'Multiplier', label: 'Multiplier', type: 'float', default: 1 },
    ],
  },
  {
    key: 'DinoClassDamageMultipliers',
    label: 'Wild creature damage per species',
    desc: 'Scales the damage one wild species deals.',
    fields: [
      { name: 'ClassName', label: 'Creature', suggest: 'dinos', required: true },
      { name: 'Multiplier', label: 'Multiplier', type: 'float', default: 1 },
    ],
  },
  {
    key: 'DinoClassResistanceMultipliers',
    label: 'Wild creature resistance per species',
    desc: 'Scales how much damage one wild species shrugs off. Unlike the global resistance settings, higher means it takes less damage.',
    fields: [
      { name: 'ClassName', label: 'Creature', suggest: 'dinos', required: true },
      { name: 'Multiplier', label: 'Multiplier', type: 'float', default: 1 },
    ],
  },
  {
    key: 'TamedDinoClassDamageMultipliers',
    label: 'Tamed creature damage per species',
    desc: 'Scales the damage one tamed species deals.',
    fields: [
      { name: 'ClassName', label: 'Creature', suggest: 'dinos', required: true },
      { name: 'Multiplier', label: 'Multiplier', type: 'float', default: 1 },
    ],
  },
  {
    key: 'TamedDinoClassResistanceMultipliers',
    label: 'Tamed creature resistance per species',
    desc: 'Scales how much damage one tamed species shrugs off. Unlike the global resistance settings, higher means it takes less damage.',
    fields: [
      { name: 'ClassName', label: 'Creature', suggest: 'dinos', required: true },
      { name: 'Multiplier', label: 'Multiplier', type: 'float', default: 1 },
    ],
  },
  {
    key: 'NPCReplacements',
    label: 'Replace a creature',
    desc: 'Every spawn of the first creature becomes the second one. Leave "Replace with" empty to stop it spawning.',
    fields: [
      { name: 'FromClassName', label: 'Creature', suggest: 'dinos', required: true },
      { name: 'ToClassName', label: 'Replace with', suggest: 'dinos' },
    ],
  },
  {
    key: 'EngramEntryAutoUnlocks',
    label: 'Auto-unlock engrams',
    desc: 'Unlocks an engram for free once a survivor reaches the level.',
    fields: [
      { name: 'EngramClassName', label: 'Engram class', required: true },
      { name: 'LevelToAutoUnlock', label: 'At level', type: 'int', default: 0 },
    ],
  },
];
