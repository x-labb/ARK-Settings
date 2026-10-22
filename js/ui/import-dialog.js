// "Import" dialog: paste or drop existing config files to load them into the builder.

import { h, icon, readFile } from './dom.js';
import { store } from '../state.js';
import { importConfig, detectKind } from '../import.js';

const KINDS = [
  { id: 'gus', label: 'GameUserSettings.ini' },
  { id: 'game', label: 'Game.ini' },
  { id: 'cmd', label: 'Launch command' },
];

export function openImport() {
  const dlg = document.getElementById('import-dialog');
  const areas = {};
  for (const k of KINDS) {
    areas[k.id] = h('textarea', { class: 'input code-input', rows: 5, spellcheck: 'false', placeholder: `Paste ${k.label} here` });
  }
  const replace = h('input', { type: 'checkbox', checked: true });
  const fileInput = h('input', { type: 'file', multiple: true, accept: '.ini,.txt,.cfg', hidden: true, onchange: e => takeFiles(e.target.files) });

  async function takeFiles(files) {
    for (const file of files) {
      const text = await readFile(file);
      areas[detectKind(file.name, text)].value = text;
    }
  }

  const drop = h('button', {
    type: 'button',
    class: 'dropzone',
    onclick: () => fileInput.click(),
    ondragover: e => { e.preventDefault(); drop.classList.add('over'); },
    ondragleave: () => drop.classList.remove('over'),
    ondrop: e => {
      e.preventDefault();
      drop.classList.remove('over');
      takeFiles(e.dataTransfer.files);
    },
  }, icon('upload'), h('span', {}, h('strong', {}, 'Drop your .ini files here'), ' or click to pick them'));

  const close = () => dlg.close();

  const form = h('div', { class: 'dialog-body' },
    h('p', { class: 'muted' }, 'Settings split over several lines are joined back together, keys in the wrong file are moved, client-only graphics settings are skipped, and anything the builder doesn’t know is kept as a custom line.'),
    drop, fileInput,
    KINDS.map(k => h('label', { class: 'field' }, h('span', { class: 'field-label' }, k.label), areas[k.id])),
    h('label', { class: 'opt' }, replace, h('span', {},
      h('span', { class: 'opt-label' }, 'Start from scratch'),
      h('span', { class: 'opt-help' }, 'Clear the builder first. Untick to apply the files on top of what you have.'))));

  const footer = h('div', { class: 'dialog-foot' },
    h('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel'),
    h('button', {
      type: 'button',
      class: 'btn btn-primary',
      onclick: () => {
        const texts = Object.fromEntries(KINDS.map(k => [k.id, areas[k.id].value]));
        if (!Object.values(texts).some(t => t.trim())) {
          areas.gus.focus();
          return;
        }
        const { state, report } = importConfig(texts, store.state, { replace: replace.checked });
        store.replace(state);
        showReport(report);
      },
    }, 'Import'));

  function showReport(report) {
    const stats = [
      `${report.applied} setting${report.applied === 1 ? '' : 's'} imported`,
      report.custom.length ? `${report.custom.length} kept as custom lines` : null,
      report.skipped ? `${report.skipped} client-only lines skipped` : null,
    ].filter(Boolean);
    dlg.replaceChildren(
      header('Import done'),
      h('div', { class: 'dialog-body' },
        h('div', { class: 'report-stats' }, stats.map(s => h('span', { class: 'pill' }, s))),
        report.warnings.length
          ? [h('h3', {}, 'Fixed or worth a look'), h('ul', { class: 'report-list' }, report.warnings.map(w => h('li', {}, icon('alert'), h('span', {}, w))))]
          : h('p', {}, 'No problems found.'),
        report.custom.length
          ? h('p', { class: 'muted' }, 'Kept as custom lines: ', h('code', {}, report.custom.join(', ')), '. You can edit them under Advanced → Custom lines.')
          : null),
      h('div', { class: 'dialog-foot' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: close }, 'Done')));
  }

  function header(title) {
    return h('div', { class: 'dialog-head' },
      h('h2', {}, title),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon('x')));
  }

  dlg.replaceChildren(header('Import existing config'), form, footer);
  dlg.showModal();
}
