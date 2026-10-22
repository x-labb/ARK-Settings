// The "Your files" panel: live GameUserSettings.ini, Game.ini and launch command.

import { h, icon, toast, copyText, downloadText } from './dom.js';
import { store, uiPref, setUiPref } from '../state.js';
import { buildGus, buildGame, buildCommand } from '../generate.js';
import { runChecks } from '../checks.js';

const TABS = [
  { id: 'gus', label: 'GameUserSettings.ini', file: 'GameUserSettings.ini' },
  { id: 'game', label: 'Game.ini', file: 'Game.ini' },
  { id: 'cmd', label: 'Command line', file: 'launch-command.txt' },
];

const CONFIG_PATH = 'ShooterGame\\Saved\\Config\\WindowsServer\\';

function iniCode(text) {
  const code = h('code');
  for (const line of text.replace(/\n$/, '').split('\n')) {
    if (/^\[.*\]$/.test(line)) {
      code.append(h('span', { class: 'tok-section' }, line));
    } else {
      const eq = line.indexOf('=');
      if (eq === -1) code.append(line);
      else code.append(h('span', { class: 'tok-key' }, line.slice(0, eq)), h('span', { class: 'tok-punct' }, '='), h('span', { class: 'tok-value' }, line.slice(eq + 1)));
    }
    code.append('\n');
  }
  return h('pre', { class: 'code' }, code);
}

function cmdCode(parts) {
  const code = h('code');
  parts.forEach((p, i) => {
    if (i) code.append(' ');
    code.append(h('span', { class: p.startsWith('-') ? 'tok-key' : p.includes('?') ? 'tok-value' : 'tok-section' }, p));
  });
  return h('pre', { class: 'code code-wrap' }, code);
}

function actions(text, fileName, crlf = true) {
  return h('div', { class: 'code-actions' },
    h('button', {
      type: 'button',
      class: 'btn btn-sm',
      onclick: async () => {
        const ok = await copyText(text);
        toast(ok ? 'Copied to clipboard' : 'Copy failed. Select the text and copy it by hand.', { level: ok ? 'ok' : 'warn' });
      },
    }, icon('copy'), 'Copy'),
    fileName ? h('button', {
      type: 'button',
      class: 'btn btn-sm',
      onclick: () => downloadText(fileName, crlf ? text.replace(/\r?\n/g, '\r\n') : text),
    }, icon('download'), 'Download') : null);
}

function emptyFile(name) {
  return h('div', { class: 'output-empty' },
    icon('file'),
    h('p', {}, `Nothing to put in ${name} yet.`),
    h('p', { class: 'muted' }, 'Everything it covers is at default, so the server doesn’t need this file. Change a setting and it shows up here.'));
}

export function mountOutput(root) {
  let tab = uiPref('outputTab', 'gus');
  const counts = {};
  const tabButtons = TABS.map(t => {
    const count = h('span', { class: 'tab-count' });
    counts[t.id] = count;
    return h('button', {
      type: 'button',
      role: 'tab',
      class: 'tab',
      dataset: { tab: t.id },
      onclick: () => {
        tab = t.id;
        setUiPref('outputTab', tab);
        paint();
      },
    }, h('span', {}, t.label), count);
  });

  const body = h('div', { class: 'output-body' });
  const checksBox = h('div', { class: 'checks' });

  const option = (key, label, help) => h('label', { class: 'opt' },
    h('input', {
      type: 'checkbox',
      checked: store.state.options[key],
      onchange: e => store.update(s => { s.options[key] = e.target.checked; }),
    }),
    h('span', {}, h('span', { class: 'opt-label' }, label), h('span', { class: 'opt-help' }, help)));

  root.replaceChildren(
    h('div', { class: 'output-head' },
      h('h2', {}, 'Your files'),
      h('button', {
        type: 'button',
        class: 'icon-btn output-close',
        'aria-label': 'Close',
        onclick: () => document.body.classList.remove('files-open'),
      }, icon('x'))),
    h('div', { class: 'tabs', role: 'tablist' }, tabButtons),
    body,
    h('div', { class: 'output-foot' },
      option('omitManaged', 'Leave out what my host panel sets', 'Session name, passwords, ports, player slots, mods. AMP, Nitrado and similar panels usually fill these in from their own fields.'),
      option('includeDefaults', 'Write unchanged settings too', 'Gives a complete reference file instead of only your changes.')),
  );

  function paint() {
    const st = store.state;
    const gus = buildGus(st);
    const game = buildGame(st);
    const cmd = buildCommand(st);
    counts.gus.textContent = gus.count || '';
    counts.game.textContent = game.count || '';
    counts.cmd.textContent = cmd.count || '';
    for (const b of tabButtons) b.setAttribute('aria-selected', String(b.dataset.tab === tab));

    const checks = runChecks(st);
    checksBox.replaceChildren(...checks.map(c => h('div', { class: `check check-${c.level}` }, icon(c.level === 'warn' ? 'alert' : 'info'), h('span', {}, c.text))));

    const nodes = [];
    if (checks.length) nodes.push(checksBox);

    if (tab === 'gus' || tab === 'game') {
      const out = tab === 'gus' ? gus : game;
      const name = tab === 'gus' ? 'GameUserSettings.ini' : 'Game.ini';
      if (!out.text) {
        nodes.push(emptyFile(name));
      } else {
        nodes.push(
          h('div', { class: 'code-head' },
            h('div', { class: 'code-path' }, icon('folder'), h('span', {}, CONFIG_PATH, h('strong', {}, name))),
            actions(out.text, name)),
          iniCode(out.text));
      }
      nodes.push(h('div', { class: 'hint' },
        icon('info'),
        h('span', {}, tab === 'gus'
          ? 'Stop the server before you replace this file. ARK rewrites GameUserSettings.ini when it shuts down, so edits made while it runs get lost.'
          : 'Game.ini is only read at startup. Restart the server after replacing it.')));
    } else {
      const parts = ['ArkAscendedServer.exe', /\s/.test(cmd.url) ? `"${cmd.url}"` : cmd.url, ...cmd.flags];
      nodes.push(
        h('div', { class: 'code-head' }, h('div', { class: 'code-path' }, h('span', {}, 'Full launch command')), actions(cmd.full, 'launch-command.txt', false)),
        cmdCode(parts));

      const extraOptions = cmd.options.length ? `?${cmd.options.join('?')}` : '';
      const extraFlags = cmd.flags.join(' ');
      nodes.push(h('div', { class: 'panel-extra' },
        h('h3', {}, 'Using a host panel like AMP?'),
        h('p', {}, 'The panel builds the command itself. Pick the map in the panel, then add only these:'),
        extraOptions || extraFlags
          ? [
            extraOptions ? h('div', { class: 'mini' }, h('div', { class: 'mini-label' }, 'Map options (after the map name)'), h('code', {}, extraOptions), actions(extraOptions)) : null,
            extraFlags ? h('div', { class: 'mini' }, h('div', { class: 'mini-label' }, 'Extra arguments'), h('code', {}, extraFlags), actions(extraFlags)) : null,
          ]
          : h('p', { class: 'muted' }, 'Nothing extra to add.')));
    }
    body.replaceChildren(...nodes);
  }

  let queued = false;
  store.subscribe(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      paint();
    });
  });
  paint();
}
