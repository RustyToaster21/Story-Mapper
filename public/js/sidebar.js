// Left panel: story details, progress, structural issues and play-test coverage.
import { h } from './dom.js';

export class Sidebar {
  constructor(root, app) {
    this.root = root;
    this.app = app;
  }

  render() {
    const { story, analysis } = this.app;
    if (!story) { this.root.replaceChildren(); return; }
    this.root.replaceChildren(
      this.details(story),
      this.progress(analysis),
      this.issues(story, analysis),
      this.coverage(story, analysis),
      this.legend(),
    );
  }

  // Only the issues/progress/coverage sections change on every edit; keep inputs focused.
  refresh() {
    const { story, analysis } = this.app;
    if (!story || !this.root.firstChild) return this.render();
    const [, progress, issues, coverage] = this.root.children;
    progress.replaceWith(this.progress(analysis));
    issues.replaceWith(this.issues(story, analysis));
    coverage.replaceWith(this.coverage(story, analysis));
  }

  details(story) {
    const app = this.app;
    return h('section', { class: 'panel' },
      h('label', { class: 'field' }, h('span', { class: 'field-label', text: 'Story title' }),
        h('input', { value: story.title, maxlength: 200, oninput: (e) => app.mutate((st) => { st.title = e.target.value || 'Untitled story'; }, { storyMeta: true }) })),
      h('label', { class: 'field' }, h('span', { class: 'field-label', text: 'Premise' }),
        h('textarea', { rows: 3, value: story.description, maxlength: 5000, placeholder: 'One or two lines about the story…', oninput: (e) => app.mutate((st) => { st.description = e.target.value; }) })),
    );
  }

  progress(a) {
    const done = a.sceneCount ? Math.round((a.statusCounts.done / a.sceneCount) * 100) : 0;
    const pct = (n) => (a.sceneCount ? (n / a.sceneCount) * 100 : 0);
    const bar = h('div', { class: 'bar', role: 'img', 'aria-label': `${a.statusCounts.done} done, ${a.statusCounts.review} in review, ${a.statusCounts.draft} draft` },
      seg('done', pct(a.statusCounts.done)), seg('review', pct(a.statusCounts.review)), seg('draft', pct(a.statusCounts.draft)));
    return h('section', { class: 'panel' },
      h('h2', { text: 'Progress' }),
      h('div', { class: 'row space' }, h('span', { class: 'big', text: `${done}%` }), h('span', { class: 'muted small', text: 'scenes marked done' })),
      bar,
      h('div', { class: 'row space small muted' },
        h('span', { text: `● ${a.statusCounts.done} done` }), h('span', { text: `● ${a.statusCounts.review} review` }), h('span', { text: `● ${a.statusCounts.draft} draft` })),
      h('dl', { class: 'stats' },
        stat('Scenes', a.sceneCount), stat('Choices', a.choiceCount), stat('Words', a.wordCount.toLocaleString()),
        stat('Endings', `${a.endingsByType.good}✓ ${a.endingsByType.bad}✗ ${a.endingsByType.neutral}–`),
        stat('Paths to an ending', `${a.endingPaths.toLocaleString()}${a.truncated ? '+' : ''}`),
        stat('Longest path', `${a.longestPath} scenes`),
        stat('Loops', a.hasCycle ? 'Yes' : 'None')),
    );
  }

  issues(story, a) {
    const app = this.app;
    const title = (id) => story.scenes.find((s) => s.id === id)?.title || id;
    const items = [];
    if (a.missingStart) items.push({ kind: 'error', text: 'No start scene — pick one with “Make start scene”.' });
    for (const b of a.brokenChoices) {
      const label = story.scenes.find((s) => s.id === b.sceneId)?.choices.find((c) => c.id === b.choiceId)?.label || 'untitled';
      items.push({ kind: 'error', text: `Choice “${label}” in ${title(b.sceneId)} has no target`, id: b.sceneId });
    }
    for (const id of a.deadEnds) items.push({ kind: 'warn', text: `Dead end: ${title(id)} (no choices, not an ending)`, id });
    for (const id of a.unreachable) items.push({ kind: 'warn', text: `Unreachable: ${title(id)}`, id });
    for (const f of a.requiredNeverSet) items.push({ kind: 'warn', text: `Flag “${f}” is required but never set` });
    if (a.sceneCount && !a.reachableEndings.length) items.push({ kind: 'warn', text: 'No ending can be reached from the start yet.' });

    return h('section', { class: 'panel' },
      h('h2', {}, 'Issues ', h('span', { class: `count ${items.length ? 'count-warn' : 'count-ok'}`, text: String(items.length) })),
      items.length
        ? h('ul', { class: 'issues' }, items.map((it) => h('li', { class: it.kind },
          it.id ? h('button', { type: 'button', class: 'link', text: it.text, onclick: () => app.select(it.id, { center: true }) }) : h('span', { text: it.text }))))
        : h('p', { class: 'muted small', text: 'No structural problems found.' }),
    );
  }

  coverage(story, a) {
    const app = this.app;
    const { stats } = story;
    const visited = story.scenes.filter((s) => stats.visits[s.id]).length;
    const endingsHit = a.endings.filter((id) => stats.endingsReached[id]).length;
    return h('section', { class: 'panel' },
      h('h2', { text: 'Play-test coverage' }),
      h('dl', { class: 'stats' },
        stat('Playthroughs', stats.playthroughs),
        stat('Scenes visited', `${visited} / ${a.sceneCount}`),
        stat('Endings reached', `${endingsHit} / ${a.endings.length}`)),
      h('div', { class: 'row wrap' },
        h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: app.heatmap, onchange: (e) => app.setHeatmap(e.target.checked) }), ' Visit heatmap on map'),
        stats.playthroughs ? h('button', { type: 'button', class: 'link small', text: 'Reset stats', onclick: () => app.resetStats() }) : null),
    );
  }

  legend() {
    return h('section', { class: 'panel legend' },
      h('h2', { text: 'Legend' }),
      h('ul', {},
        h('li', {}, h('i', { class: 'sw sw-draft' }), 'Draft'),
        h('li', {}, h('i', { class: 'sw sw-review' }), 'In review'),
        h('li', {}, h('i', { class: 'sw sw-done' }), 'Done'),
        h('li', {}, h('i', { class: 'sw sw-start' }), 'Start scene'),
        h('li', {}, h('i', { class: 'sw sw-good' }), 'Good / ', h('i', { class: 'sw sw-bad' }), 'bad / ', h('i', { class: 'sw sw-neutral' }), 'neutral ending'),
        h('li', {}, h('i', { class: 'sw sw-issue' }), 'Has an issue'),
        h('li', {}, h('i', { class: 'sw sw-dash' }), 'Choice needs a flag')),
    );
  }
}

const stat = (k, v) => [h('dt', { text: k }), h('dd', { text: String(v) })];
const seg = (kind, width) => {
  const el = h('span', { class: `seg seg-${kind}` });
  el.style.width = `${width}%`; // CSSOM, allowed under the CSP
  return el;
};
