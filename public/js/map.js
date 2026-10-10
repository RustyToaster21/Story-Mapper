// Cytoscape wrapper: renders scenes as nodes and choices as edges.
// Labels are drawn on a canvas by Cytoscape, so story text is never parsed as markup.
import cytoscape from '/vendor/cytoscape.mjs';

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
// Rough wrapped-line estimate for a 150px-wide 12px label.
const nodeHeight = (label) => 18 + 15 * Math.max(1, Math.ceil(label.length / 22));

function tokens() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    text: v('--text'), muted: v('--text-muted'), surface: v('--surface'), bg: v('--bg'), line: v('--border-strong'),
    accent: v('--accent'), draft: v('--st-draft'), review: v('--st-review'), done: v('--st-done'),
    good: v('--end-good'), bad: v('--end-bad'), neutral: v('--end-neutral'), danger: v('--danger'),
    heatLo: v('--heat-lo'), heatHi: v('--heat-hi'), font: v('--font-ui'),
  };
}

function stylesheet(t) {
  return [
    {
      selector: 'node',
      style: {
        shape: 'round-rectangle', label: 'data(label)', 'font-family': t.font, 'font-size': 12,
        color: t.text, 'text-wrap': 'wrap', 'text-max-width': 150, 'text-valign': 'center',
        width: 170, height: 'data(h)', padding: 10, 'background-color': t.surface,
        'border-width': 2, 'border-color': t.draft,
      },
    },
    { selector: 'node.st-review', style: { 'border-color': t.review } },
    { selector: 'node.st-done', style: { 'border-color': t.done } },
    { selector: 'node.ending', style: { shape: 'cut-rectangle', 'border-width': 3 } },
    { selector: 'node.end-good', style: { 'background-color': t.good, color: t.bg } },
    { selector: 'node.end-bad', style: { 'background-color': t.bad, color: t.bg } },
    { selector: 'node.end-neutral', style: { 'background-color': t.neutral, color: t.bg } },
    { selector: 'node.start', style: { 'border-style': 'double', 'border-width': 6 } },
    { selector: 'node.issue', style: { 'outline-width': 3, 'outline-color': t.danger, 'outline-offset': 3, 'outline-style': 'dashed' } },
    { selector: 'node.heat', style: { 'background-color': `mapData(heat, 0, 1, ${t.heatLo}, ${t.heatHi})`, color: t.text } },
    { selector: 'node:selected', style: { 'border-color': t.accent, 'border-width': 4, 'overlay-opacity': 0 } },
    { selector: 'node.current', style: { 'underlay-color': t.accent, 'underlay-opacity': 0.35, 'underlay-padding': 10 } },
    { selector: 'node.trail', style: { 'underlay-color': t.accent, 'underlay-opacity': 0.12, 'underlay-padding': 6 } },
    {
      selector: 'edge',
      style: {
        width: 2, 'line-color': t.line, 'target-arrow-color': t.line, 'target-arrow-shape': 'triangle',
        'curve-style': 'bezier', label: 'data(label)', 'font-family': t.font, 'font-size': 10, color: t.muted,
        'text-background-color': t.bg, 'text-background-opacity': 0.9, 'text-background-padding': 2,
        'text-rotation': 'autorotate', 'loop-direction': '-45deg', 'loop-sweep': '-60deg',
      },
    },
    { selector: 'edge.conditional', style: { 'line-style': 'dashed' } },
    { selector: 'edge:selected', style: { 'line-color': t.accent, 'target-arrow-color': t.accent, width: 3 } },
    { selector: 'edge.trail', style: { 'line-color': t.accent, 'target-arrow-color': t.accent } },
    { selector: '.faded', style: { opacity: 0.2 } },
  ];
}

export class StoryMap {
  constructor(container, handlers) {
    this.handlers = handlers;
    this.cy = cytoscape({
      container, style: stylesheet(tokens()), minZoom: 0.15, maxZoom: 3,
      boxSelectionEnabled: false, selectionType: 'single',
    });
    const cy = this.cy;
    cy.on('tap', 'node', (e) => handlers.onSelect(e.target.id()));
    cy.on('tap', 'edge', (e) => handlers.onSelect(e.target.data('source')));
    cy.on('tap', (e) => { if (e.target === cy) handlers.onSelect(null); });
    cy.on('dbltap', (e) => { if (e.target === cy) handlers.onAddAt(e.position); });
    cy.on('cxttap', 'node', (e) => handlers.onLink(e.target.id()));
    cy.on('dragfree', 'node', (e) => handlers.onMove(e.target.id(), { ...e.target.position() }));
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.restyle());
  }

  restyle() { this.cy.style(stylesheet(tokens())); }

  // Diff the story into the graph so pan/zoom/selection survive edits.
  render(story, analysis, { heatmap = false } = {}) {
    const cy = this.cy;
    const issues = new Set([...analysis.deadEnds, ...analysis.unreachable, ...analysis.brokenChoices.map((b) => b.sceneId)]);
    const visits = story.stats?.visits || {};
    const maxVisits = Math.max(1, ...Object.values(visits));
    const sceneIds = new Set(story.scenes.map((s) => s.id));
    const wanted = new Set();

    cy.batch(() => {
      for (const s of story.scenes) {
        wanted.add(s.id);
        const classes = [`st-${s.status}`];
        if (s.ending) classes.push('ending', `end-${s.ending}`);
        if (s.id === story.startSceneId) classes.push('start');
        if (issues.has(s.id)) classes.push('issue');
        if (heatmap) classes.push('heat');
        const label = truncate(s.title, 60);
        const data = { id: s.id, label, h: nodeHeight(label), heat: (visits[s.id] || 0) / maxVisits };
        let node = cy.getElementById(s.id);
        if (node.empty()) node = cy.add({ group: 'nodes', data, position: s.position || { x: 0, y: 0 } });
        else node.data(data);
        node.classes(classes);
      }
      for (const s of story.scenes) {
        for (const c of s.choices) {
          if (!sceneIds.has(c.target)) continue;
          wanted.add(c.id);
          const prefix = c.requires ? `[${c.requires}] ` : '';
          const data = { id: c.id, source: s.id, target: c.target, label: truncate(prefix + (c.label || ''), 34) };
          let edge = cy.getElementById(c.id);
          if (!edge.empty() && (edge.data('source') !== s.id || edge.data('target') !== c.target)) {
            edge.remove();
            edge = cy.collection();
          }
          if (edge.empty()) edge = cy.add({ group: 'edges', data });
          else edge.data(data);
          edge.classes(c.requires ? ['conditional'] : []);
        }
      }
      cy.elements().filter((el) => !wanted.has(el.id())).remove();
    });
  }

  select(id) {
    this.cy.$(':selected').unselect();
    if (id) this.cy.getElementById(id).select();
  }

  center(id) {
    const node = this.cy.getElementById(id);
    if (node.nonempty()) this.cy.animate({ center: { eles: node }, duration: 250 });
  }

  highlight(query) {
    const q = query.trim().toLowerCase();
    this.cy.batch(() => {
      this.cy.elements().removeClass('faded');
      if (!q) return;
      const hit = this.cy.nodes().filter((n) => this.handlers.matches(n.id(), q));
      this.cy.elements().not(hit).addClass('faded');
    });
  }

  trail(path) {
    const cy = this.cy;
    cy.batch(() => {
      cy.elements().removeClass('trail current');
      path.forEach((id, i) => {
        cy.getElementById(id).addClass(i === path.length - 1 ? 'current' : 'trail');
        if (i > 0) cy.edges().filter((e) => e.data('source') === path[i - 1] && e.data('target') === id).addClass('trail');
      });
    });
    if (path.length) this.center(path.at(-1));
  }

  // Auto-layout: top-down tree from the start scene; returns new positions.
  layout(startId, { animate = true } = {}) {
    const roots = this.cy.getElementById(startId);
    const l = this.cy.layout({
      name: 'breadthfirst', directed: true, roots: roots.nonempty() ? roots : undefined,
      spacingFactor: 1.1, padding: 40, animate, animationDuration: 300,
    });
    return new Promise((resolve) => {
      l.one('layoutstop', () => resolve(this.cy.nodes().map((n) => [n.id(), { ...n.position() }])));
      l.run();
    });
  }

  fit() { this.cy.animate({ fit: { padding: 40 }, duration: 250 }); }

  png() {
    return this.cy.png({ output: 'blob-promise', full: true, scale: 2, bg: tokens().bg });
  }
}
