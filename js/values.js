// Reading and writing scalar setting values. Only non-default values are stored.

export function getValue(state, setting) {
  return Object.hasOwn(state.values, setting.key) ? state.values[setting.key] : setting.default;
}

export function same(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  return (a ?? '') === (b ?? '');
}

export function setValue(state, setting, value) {
  if (same(value, setting.default)) delete state.values[setting.key];
  else state.values[setting.key] = value;
}

export function isChanged(state, setting) {
  return Object.hasOwn(state.values, setting.key);
}

export function formatNumber(n, float = false) {
  if (typeof n !== 'number' || !Number.isFinite(n)) n = Number(n) || 0;
  let s = String(Number(n.toFixed(6)));
  if (float && /^-?\d+$/.test(s)) s += '.0';
  return s;
}

export function formatValue(setting, value) {
  switch (setting.type) {
    case 'bool': return value ? 'True' : 'False';
    case 'float': return formatNumber(value, true);
    case 'int': return formatNumber(Math.trunc(Number(value) || 0));
    case 'text': return String(value ?? '').replace(/\r?\n/g, '\\n');
    default: return String(value ?? '');
  }
}

export function displayValue(setting, value) {
  if (setting.type === 'bool') return value ? 'On' : 'Off';
  if (setting.type === 'enum') {
    const opt = setting.options?.find(o => String(o.value) === String(value));
    if (opt) return opt.label;
  }
  if (value === '' || value == null) return 'empty';
  if (typeof value === 'number') return formatNumber(value);
  return String(value);
}
