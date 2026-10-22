// Form controls for one setting. Each returns { el, id } and calls onChange(value).

import { h, icon } from './dom.js';

let uid = 0;

function randomPassword(length = 16) {
  // Letters and digits only: symbols can break the ?Key=Value launch syntax.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export function control(setting, value, onChange) {
  const id = `f-${setting.key}-${++uid}`;

  switch (setting.type) {
    case 'bool': {
      const input = h('input', {
        type: 'checkbox',
        role: 'switch',
        id,
        checked: !!value,
        onchange: e => onChange(e.target.checked),
      });
      return { id, el: h('label', { class: 'switch' }, input, h('span', { class: 'switch-track', 'aria-hidden': 'true' })) };
    }

    case 'enum': {
      const options = [...(setting.options || [])];
      if (!options.some(o => String(o.value) === String(value))) options.push({ value, label: String(value) });
      const numeric = typeof setting.default === 'number';
      const select = h(
        'select',
        { id, class: 'input', onchange: e => onChange(numeric ? Number(e.target.value) : e.target.value) },
        options.map(o => h('option', { value: String(o.value), selected: String(o.value) === String(value) }, o.label)),
      );
      return { id, el: select };
    }

    case 'int':
    case 'float': {
      const input = h('input', {
        id,
        class: 'input input-num',
        type: 'number',
        inputmode: setting.type === 'int' ? 'numeric' : 'decimal',
        step: setting.step ?? (setting.type === 'int' ? 1 : 'any'),
        min: setting.min,
        max: setting.max,
        value: String(value),
        oninput: e => {
          const t = e.target.value.trim();
          if (t === '') return onChange(setting.default);
          const n = Number(t);
          if (Number.isFinite(n)) onChange(setting.type === 'int' ? Math.trunc(n) : n);
        },
      });
      return { id, el: input };
    }

    case 'password': {
      const input = h('input', {
        id,
        class: 'input',
        type: 'password',
        autocomplete: 'new-password',
        spellcheck: 'false',
        value: value ?? '',
        oninput: e => onChange(e.target.value),
      });
      const show = h('button', {
        type: 'button',
        class: 'icon-btn',
        title: 'Show or hide',
        'aria-label': 'Show or hide password',
        onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; },
      }, icon('eye'));
      const generate = h('button', {
        type: 'button',
        class: 'icon-btn',
        title: 'Generate a strong password',
        'aria-label': 'Generate a strong password',
        onclick: () => {
          input.value = randomPassword();
          input.type = 'text';
          onChange(input.value);
        },
      }, icon('dice'));
      return { id, el: h('div', { class: 'input-group' }, input, show, generate) };
    }

    case 'text': {
      const ta = h('textarea', { id, class: 'input', rows: 3, oninput: e => onChange(e.target.value) });
      ta.value = value ?? '';
      return { id, el: ta };
    }

    default: {
      const input = h('input', {
        id,
        class: 'input',
        type: 'text',
        spellcheck: 'false',
        value: value ?? '',
        placeholder: setting.placeholder,
        oninput: e => onChange(e.target.value),
      });
      return { id, el: input };
    }
  }
}
