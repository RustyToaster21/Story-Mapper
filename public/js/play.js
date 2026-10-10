// Play-test panel: run the story as a player would, with flags and history.
import { h } from './dom.js';
import { applyFlag, flagSatisfied } from './analysis.js';

export class Player {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.showLocked = false;
  }

  start(sceneId) {
    const story = this.app.story;
    this.fromStart = sceneId === story.startSceneId;
    this.history = [{ sceneId, flags: new Set() }];
    this.recorded = false;
    this.root.hidden = false;
    this.render();
    this.root.querySelector('h2')?.focus();
  }

  get active() { return !this.root.hidden; }

  close() {
    this.root.hidden = true;
    this.app.map.trail([]);
  }

  current() { return this.history.at(-1); }

  choose(choice) {
    const flags = new Set(this.current().flags);
    applyFlag(choice.sets, flags);
    this.history.push({ sceneId: choice.target, flags });
    this.render();
  }

  back() {
    if (this.history.length > 1) { this.history.pop(); this.render(); }
  }

  // Only full runs from the start scene count toward coverage stats.
  async record() {
    if (this.recorded || !this.fromStart) return;
    this.recorded = true;
    try {
      await this.app.recordPlaythrough(this.history.map((s) => s.sceneId));
    } catch {
      this.recorded = false;
    }
  }

  render() {
    const story = this.app.story;
    const { sceneId, flags } = this.current();
    const scene = story.scenes.find((s) => s.id === sceneId);
    this.app.map.trail(this.history.map((s) => s.sceneId));

    const head = h('header', { class: 'play-head' },
      h('span', { class: 'badge badge-accent', text: 'Play-test' }),
      h('span', { class: 'muted small', text: `Step ${this.history.length}` }),
      h('button', { type: 'button', class: 'icon', title: 'Close play-test', 'aria-label': 'Close play-test', text: '✕', onclick: () => this.close() }));

    if (!scene) {
      this.root.replaceChildren(head, h('p', { class: 'error', text: 'This choice points to a scene that no longer exists.' }), this.controls());
      return;
    }

    const available = scene.choices.filter((c) => story.scenes.some((s) => s.id === c.target));
    const open = available.filter((c) => flagSatisfied(c.requires, flags));
    const locked = available.filter((c) => !flagSatisfied(c.requires, flags));
    const isEnd = open.length === 0;
    if (isEnd) this.record();

    this.root.replaceChildren(...[
      head,
      h('h2', { tabindex: '-1', text: scene.title }),
      h('div', { class: 'play-body', text: scene.body || '(This scene has no text yet.)' }),
      isEnd
        ? h('div', { class: `the-end ${scene.ending ? `end-${scene.ending}` : 'end-dead'}` },
          h('strong', { text: scene.ending ? `The End — ${scene.ending} ending` : 'Dead end' }),
          h('span', { class: 'small', text: scene.ending ? '' : locked.length ? 'Every choice here is locked by a flag.' : 'This scene has no choices and is not marked as an ending.' }),
          this.fromStart ? h('span', { class: 'small muted', text: 'Playthrough recorded.' }) : null)
        : h('ol', { class: 'play-choices' }, open.map((c) => h('li', {},
          h('button', { type: 'button', class: 'choice-btn', text: c.label || '(untitled choice)', onclick: () => this.choose(c) })))),
      locked.length ? h('details', { class: 'locked', open: this.showLocked, ontoggle: (e) => { this.showLocked = e.target.open; } },
        h('summary', { text: `${locked.length} locked choice${locked.length === 1 ? '' : 's'}` }),
        h('ul', {}, locked.map((c) => h('li', { class: 'muted small', text: `${c.label || '(untitled)'} — needs ${c.requires}` })))) : null,
      h('div', { class: 'flags' },
        h('span', { class: 'muted small', text: 'Flags: ' }),
        flags.size ? [...flags].map((f) => h('span', { class: 'chip', text: f })) : h('span', { class: 'muted small', text: 'none' })),
      this.controls(),
    ].filter(Boolean)); // replaceChildren would stringify null
  }

  controls() {
    return h('div', { class: 'row wrap play-controls' },
      h('button', { type: 'button', class: 'btn', text: '← Back', disabled: this.history.length < 2, onclick: () => this.back() }),
      h('button', { type: 'button', class: 'btn', text: 'Restart', onclick: () => this.start(this.history[0].sceneId) }),
      h('button', { type: 'button', class: 'btn', text: 'Edit this scene', onclick: () => { const id = this.current().sceneId; this.close(); this.app.select(id, { center: true }); } }));
  }
}
