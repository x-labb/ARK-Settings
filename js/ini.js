// Minimal INI handling for ARK / Unreal config files.

const COMMENT = /^\s*[;#]/;
const SECTION = /^\s*\[(.+?)\]\s*$/;

/** Net count of open parentheses outside quotes. */
function depth(s) {
  let d = 0;
  let quoted = false;
  for (const c of s) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === '(') d++;
    else if (!quoted && c === ')') d--;
  }
  return d;
}

/**
 * Reads INI text into entries. A value that opens a parenthesis and continues
 * on the next lines is joined back into one line (ARK only reads one line per
 * setting), and flagged with `joined` so the import can say so.
 */
export function parseIni(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const entries = [];
  let section = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || COMMENT.test(raw)) continue;
    const header = raw.match(SECTION);
    if (header) {
      section = header[1].trim();
      continue;
    }
    const eq = raw.indexOf('=');
    if (eq === -1) {
      entries.push({ section, key: null, value: raw.trim(), line: i + 1 });
      continue;
    }
    const start = i;
    const key = raw.slice(0, eq).trim();
    let value = raw.slice(eq + 1).trim();
    while (depth(value) > 0 && i + 1 < lines.length && !SECTION.test(lines[i + 1])) {
      i++;
      value += lines[i].trim();
    }
    entries.push({ section, key, value, line: start + 1, joined: i > start });
  }
  return entries;
}

/** Splits on `sep` at the top level only (outside quotes and parentheses). */
export function splitTop(s, sep) {
  const parts = [];
  let d = 0;
  let quoted = false;
  let cur = '';
  for (const c of s) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === '(') d++;
    else if (!quoted && c === ')') d--;
    if (c === sep && d === 0 && !quoted) {
      parts.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

export const unquote = v => (v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);

/** Parses `(A="x",B=1.0)` into `{ A: 'x', B: '1.0' }`, or null if it isn't a struct. */
export function parseStruct(value) {
  const s = value.trim();
  if (!s.startsWith('(') || !s.endsWith(')')) return null;
  const out = {};
  for (const part of splitTop(s.slice(1, -1), ',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = unquote(part.slice(eq + 1).trim());
  }
  return out;
}

/** Ordered INI sections, matched case-insensitively like Unreal does. */
export class Sections {
  constructor(order = []) {
    this.map = new Map(order.map(name => [name, []]));
  }

  resolve(name) {
    const lower = name.toLowerCase();
    for (const k of this.map.keys()) if (k.toLowerCase() === lower) return k;
    this.map.set(name, []);
    return name;
  }

  add(section, line) {
    this.map.get(this.resolve(section)).push(line);
  }

  /** Appends free-form INI text; lines before any header go to `fallback`. */
  merge(text, fallback) {
    let current = fallback;
    for (const line of String(text || '').split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      const header = t.match(SECTION);
      if (header) {
        current = this.resolve(header[1].trim());
        continue;
      }
      this.add(current, t);
    }
  }

  get lineCount() {
    let n = 0;
    for (const lines of this.map.values()) n += lines.length;
    return n;
  }

  toString() {
    const blocks = [...this.map]
      .filter(([, lines]) => lines.length)
      .map(([name, lines]) => `[${name}]\n${lines.join('\n')}`);
    return blocks.length ? blocks.join('\n\n') + '\n' : '';
  }
}

/** Splits a command line into tokens, honouring double quotes. */
export function tokenize(text) {
  const tokens = [];
  let cur = '';
  let quoted = false;
  let any = false;
  for (const c of text) {
    if (c === '"') {
      quoted = !quoted;
      any = true;
    } else if (!quoted && /\s/.test(c)) {
      if (any) tokens.push(cur);
      cur = '';
      any = false;
    } else {
      cur += c;
      any = true;
    }
  }
  if (any) tokens.push(cur);
  return tokens;
}
