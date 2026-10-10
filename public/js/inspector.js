// Right-hand panel: edit the selected scene and its choices.
import { h } from './dom.js';

const NEW_SCENE = '__new__';

export class Inspector {
  constructor(root, app) {
    this.root = root;
    this.app = app;
  }

  render() {
    const story = this.app.story;
    const scene = story && story.scenes.find((s) => s.id === this.app.selectedId);
    this.root.replaceChildren(scene ? this.sceneForm(story, scene) : this.empty(story));
  }

  empty(story) {
    return h('div', { class: 'empty' },
      h('h2', { text: 'No scene selected' }),
      h('p', { text: story ? 'Click a scene on the map to edit it. Double-click empty space to add a scene.' : 'Create or pick a story to begin.' }),
      story && h('ul', { class: 'hints' },
        h('li', {}, h('kbd', { text: 'Double-click' }), ' empty map space — add a scene'),
        h('li', {}, h('kbd', { text: 'Right-click' }), ' a scene — link the selected scene to it'),
        h('li', {}, h('kbd', { text: 'Drag' }), ' scenes to arrange them'),
        h('li', {}, h('kbd', { text: 'N' }), ' new scene, ', h('kbd', { text: 'Del' }), ' delete selected, ', h('kbd', { text: '/' }), ' search')),
    );
  }

  // Edits that don't change structure update state without rebuilding the form (keeps focus).
  field(scene, key, value) {
    this.app.mutate((st) => { st.scenes.find((s) => s.id === scene.id)[key] = value; });
  }

  sceneForm(story, scene) {
    const app = this.app;
    const isStart = story.startSceneId === scene.id;
    const incoming = story.scenes.filter((s) => s.choices.some((c) => c.target === scene.id));
    const visits = story.stats?.visits?.[scene.id] || 0;
    const words = h('span', { class: 'muted small' });
    const countWords = (t) => { const n = t.split(/\s+/).filter(Boolean).length; words.textContent = `${n} word${n === 1 ? '' : 's'}`; };
    countWords(scene.body);

    return h('form', { class: 'scene-form', onsubmit: (e) => e.preventDefault() },
      h('div', { class: 'row space' },
        h('span', { class: `badge ${isStart ? 'badge-accent' : ''}`, text: isStart ? 'Start scene' : 'Scene' }),
        h('span', { class: 'muted small', text: `${visits} play-test visit${visits === 1 ? '' : 's'}` })),

      label('Title', h('input', {
        id: 'scene-title', value: scene.title, maxlength: 200, required: true,
        oninput: (e) => this.field(scene, 'title', e.target.value || 'Untitled scene'),
      })),

      h('div', { class: 'grid2' },
        label('Status', select(['draft', 'review', 'done'], scene.status,
          (v) => app.mutate((st) => { st.scenes.find((s) => s.id === scene.id).status = v; }))),
        label('Ending', select([['', 'Not an ending'], ['good', 'Good ending'], ['bad', 'Bad ending'], ['neutral', 'Neutral ending']], scene.ending,
          (v) => app.mutate((st) => { st.scenes.find((s) => s.id === scene.id).ending = v; }, { rebuild: true })))),

      label(h('span', { class: 'row space' }, 'Scene text', words), h('textarea', {
        rows: 8, maxlength: 50000, value: scene.body, placeholder: 'What the player reads…',
        oninput: (e) => { countWords(e.target.value); this.field(scene, 'body', e.target.value); },
      })),

      h('fieldset', { class: 'choices' },
        h('legend', { text: `Choices (${scene.choices.length})` }),
        scene.ending && scene.choices.length === 0 ? h('p', { class: 'muted small', text: 'Endings usually have no choices.' }) : null,
        scene.choices.map((c, i) => this.choiceRow(story, scene, c, i)),
        h('button', { type: 'button', class: 'btn', text: '+ Add choice', onclick: () => app.addChoice(scene.id) })),

      label('Tags (comma separated)', h('input', {
        value: scene.tags.join(', '), placeholder: 'act 1, combat, lore',
        onchange: (e) => app.mutate((st) => {
          st.scenes.find((s) => s.id === scene.id).tags = [...new Set(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))];
        }),
      })),

      label('Author notes (never shown to players)', h('textarea', {
        rows: 3, value: scene.notes, placeholder: 'Ideas, todos, continuity…',
        oninput: (e) => this.field(scene, 'notes', e.target.value),
      })),

      h('div', { class: 'incoming' },
        h('h3', { text: `Reached from (${incoming.length})` }),
        incoming.length
          ? h('ul', {}, incoming.map((s) => h('li', {}, h('button', { type: 'button', class: 'link', text: s.title, onclick: () => app.select(s.id, { center: true }) }))))
          : h('p', { class: 'muted small', text: isStart ? 'This is where the story begins.' : 'Nothing links here yet.' })),

      h('div', { class: 'row wrap actions' },
        h('button', { type: 'button', class: 'btn', text: 'Play from here', onclick: () => app.play(scene.id) }),
        !isStart && h('button', { type: 'button', class: 'btn', text: 'Make start scene', onclick: () => app.mutate((st) => { st.startSceneId = scene.id; }, { rebuild: true }) }),
        h('button', { type: 'button', class: 'btn btn-danger', text: 'Delete scene', onclick: () => app.deleteScene(scene.id) })),
    );
  }

  choiceRow(story, scene, choice, index) {
    const app = this.app;
    const update = (key, value, rebuild = false) => app.mutate((st) => {
      st.scenes.find((s) => s.id === scene.id).choices.find((c) => c.id === choice.id)[key] = value;
    }, { rebuild });
    const targetOptions = [['', '— choose target —'], ...story.scenes.map((s) => [s.id, s.title]), [NEW_SCENE, '+ New scene…']];
    const target = select(targetOptions, choice.target, (v) => {
      if (v === NEW_SCENE) app.addScene({ fromSceneId: scene.id, choiceId: choice.id });
      else update('target', v, true);
    });
    target.setAttribute('aria-label', 'Target scene');
    const broken = !story.scenes.some((s) => s.id === choice.target);

    return h('div', { class: `choice ${broken ? 'broken' : ''}` },
      h('div', { class: 'row' },
        h('input', { class: 'grow', value: choice.label, placeholder: `Choice ${index + 1} text`, 'aria-label': 'Choice text', maxlength: 500, oninput: (e) => update('label', e.target.value) }),
        h('button', { type: 'button', class: 'icon', title: 'Move up', 'aria-label': 'Move up', text: '↑', disabled: index === 0, onclick: () => app.moveChoice(scene.id, index, -1) }),
        h('button', { type: 'button', class: 'icon', title: 'Remove choice', 'aria-label': 'Remove choice', text: '✕', onclick: () => app.removeChoice(scene.id, choice.id) })),
      h('div', { class: 'row' },
        h('span', { class: 'muted small', text: '→' }), target,
        !broken && h('button', { type: 'button', class: 'icon', title: 'Go to target', 'aria-label': 'Go to target', text: '↗', onclick: () => app.select(choice.target, { center: true }) })),
      h('div', { class: 'grid2' },
        flagInput('Requires flag', choice.requires, 'key or !key', (v) => update('requires', v)),
        flagInput('Sets flag', choice.sets, 'key or !key', (v) => update('sets', v))),
    );
  }
}

function label(text, control) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, text), control);
}

function select(options, value, onChange) {
  const el = h('select', { onchange: (e) => onChange(e.target.value) },
    options.map((o) => {
      const [v, t] = Array.isArray(o) ? o : [o, o[0].toUpperCase() + o.slice(1)];
      return h('option', { value: v, text: t });
    }));
  el.value = value;
  return el;
}

function flagInput(text, value, placeholder, onChange) {
  return label(text, h('input', {
    value, placeholder, pattern: '!?[A-Za-z0-9_.\\-]{1,64}', spellcheck: 'false',
    onchange: (e) => {
      const v = e.target.value.trim();
      if (v && !e.target.checkValidity()) { e.target.reportValidity(); return; }
      onChange(v);
    },
  }));
}
