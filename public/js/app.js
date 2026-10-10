import { api, ApiError } from './api.js';
import { analyze } from './analysis.js';
import { $, h, toast, download, slug } from './dom.js';
import { StoryMap } from './map.js';
import { Inspector } from './inspector.js';
import { Sidebar } from './sidebar.js';
import { Player } from './play.js';

const SAVE_DELAY = 600;
const newId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 16);
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

class App {
  constructor() {
    this.story = null;
    this.analysis = null;
    this.selectedId = null;
    this.heatmap = storage.get('heatmap') === '1';
    this.saveTimer = null;
    this.saving = null;
    this.dirty = false;

    this.map = new StoryMap($('#cy'), {
      onSelect: (id) => this.select(id),
      onAddAt: (pos) => this.addScene({ position: pos }),
      onLink: (id) => this.linkSelectedTo(id),
      onMove: (id, pos) => this.mutate((st) => { st.scenes.find((s) => s.id === id).position = pos; }, { quiet: true }),
      matches: (id, q) => {
        const s = this.story.scenes.find((x) => x.id === id);
        return !!s && [s.title, s.body, s.notes, ...s.tags].some((t) => t.toLowerCase().includes(q));
      },
    });
    this.inspector = new Inspector($('#inspector'), this);
    this.sidebar = new Sidebar($('#sidebar'), this);
    this.player = new Player($('#player'), this);
    this.bindChrome();
  }

  // ---------- loading ----------

  async init() {
    try {
      const stories = await this.refreshList();
      const last = storage.get('lastStory');
      const pick = stories.find((s) => s.id === last) || stories[0];
      if (pick) await this.open(pick.id);
      else this.renderAll();
    } catch (err) {
      toast(`Could not reach the server: ${err.message}`, 'error');
    }
  }

  async refreshList() {
    const stories = await api.list();
    const sel = $('#story-select');
    sel.replaceChildren(...stories.map((s) => h('option', { value: s.id, text: `${s.title} (${s.sceneCount})` })));
    if (!stories.length) sel.append(h('option', { value: '', text: 'No stories yet' }));
    if (this.story) sel.value = this.story.id;
    return stories;
  }

  async open(id) {
    await this.flush();
    this.player.close();
    this.story = await api.get(id);
    this.selectedId = null;
    storage.set('lastStory', id);
    $('#story-select').value = id;
    this.analysis = analyze(this.story);
    this.map.cy.elements().remove();
    this.renderAll();
    if (this.story.scenes.some((s) => !s.position)) await this.autoLayout({ animate: false });
    else this.map.cy.fit(undefined, 40);
  }

  // ---------- rendering ----------

  renderAll() {
    const empty = !this.story;
    $('#empty-state').hidden = !empty;
    for (const el of document.querySelectorAll('[data-needs-story]')) el.disabled = empty;
    if (this.story) {
      this.map.render(this.story, this.analysis, { heatmap: this.heatmap });
      this.map.select(this.selectedId);
      this.map.highlight($('#search').value);
      document.title = `${this.story.title} · Story Mapper`;
    }
    this.sidebar.render();
    this.inspector.render();
  }

  // Every edit goes through here: apply, re-analyse, re-render, autosave.
  mutate(fn, { rebuild = false, quiet = false, storyMeta = false } = {}) {
    if (!this.story) return;
    fn(this.story);
    this.analysis = analyze(this.story);
    if (!quiet) {
      this.map.render(this.story, this.analysis, { heatmap: this.heatmap });
      this.map.select(this.selectedId);
      this.sidebar.refresh();
      if (rebuild) this.inspector.render();
    }
    if (storyMeta) document.title = `${this.story.title} · Story Mapper`;
    this.scheduleSave();
  }

  select(id, { center = false } = {}) {
    this.selectedId = id && this.story?.scenes.some((s) => s.id === id) ? id : null;
    this.map.select(this.selectedId);
    if (center && this.selectedId) this.map.center(this.selectedId);
    this.inspector.render();
  }

  setHeatmap(on) {
    this.heatmap = on;
    storage.set('heatmap', on ? '1' : '0');
    this.map.render(this.story, this.analysis, { heatmap: on });
  }

  // ---------- saving ----------

  setSaveState(text, kind = '') {
    const el = $('#save-state');
    el.textContent = text;
    el.dataset.kind = kind;
  }

  scheduleSave() {
    this.dirty = true;
    this.setSaveState('Unsaved changes…');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), SAVE_DELAY);
  }

  async save() {
    clearTimeout(this.saveTimer);
    if (this.saving) { await this.saving; if (this.dirty) return this.save(); return; }
    if (!this.dirty || !this.story) return;
    this.dirty = false;
    const story = this.story;
    this.setSaveState('Saving…');
    let outcome = 'ok';
    this.saving = (async () => {
      try {
        const saved = await api.save(story);
        story.updatedAt = saved.updatedAt;
        story.stats = saved.stats;
        this.setSaveState(this.dirty ? 'Unsaved changes…' : 'All changes saved', this.dirty ? '' : 'ok');
        this.refreshListLabel(saved);
      } catch (err) {
        outcome = err instanceof ApiError && err.status === 409 ? 'conflict' : 'failed';
        if (outcome === 'failed') toast(`Save failed: ${err.message}`, 'error');
      } finally {
        this.saving = null;
      }
    })();
    await this.saving;

    // Follow-ups run after `saving` clears, so open()/flush() can't wait on themselves.
    if (outcome === 'conflict') {
      this.dirty = false;
      toast('This story was changed in another tab. Loaded the latest version.', 'error');
      await this.open(story.id);
      this.setSaveState('Reloaded latest', 'ok');
    } else if (outcome === 'failed') {
      this.dirty = true;
      this.setSaveState('Save failed — retrying', 'error');
      this.saveTimer = setTimeout(() => this.save(), 5000);
    } else if (this.dirty) {
      this.scheduleSave();
    }
  }

  async flush() {
    if (this.dirty || this.saving) await this.save();
  }

  refreshListLabel(story) {
    const opt = [...$('#story-select').options].find((o) => o.value === story.id);
    if (opt) opt.textContent = `${story.title} (${story.scenes.length})`;
  }

  // ---------- scene & choice operations ----------

  addScene({ position, fromSceneId, choiceId } = {}) {
    if (!this.story) return;
    const id = newId();
    const from = this.story.scenes.find((s) => s.id === (fromSceneId || this.selectedId));
    const pos = position || this.freeSpot(from?.position ? { x: from.position.x, y: from.position.y + 180 } : this.viewCenter());
    this.mutate((st) => {
      st.scenes.push({ id, title: 'New scene', body: '', status: 'draft', ending: '', tags: [], notes: '', position: pos, choices: [] });
      if (fromSceneId) {
        const src = st.scenes.find((s) => s.id === fromSceneId);
        const choice = src.choices.find((c) => c.id === choiceId);
        if (choice) choice.target = id;
        else src.choices.push({ id: newId(), label: '', target: id, requires: '', sets: '' });
      }
      if (!st.startSceneId) st.startSceneId = id;
    });
    this.select(id);
    setTimeout(() => { const t = $('#scene-title'); t?.focus(); t?.select(); });
  }

  // Step sideways (alternating right/left) until the spot doesn't overlap a scene.
  freeSpot(p) {
    const taken = (x, y) => this.story.scenes.some((s) => s.position
      && Math.abs(s.position.x - x) < 190 && Math.abs(s.position.y - y) < 80);
    for (let i = 0; i < 40; i++) {
      const x = p.x + Math.ceil(i / 2) * 200 * (i % 2 ? 1 : -1);
      if (!taken(x, p.y)) return { x, y: p.y };
    }
    return p;
  }

  viewCenter() {
    const ext = this.map.cy.extent();
    return { x: (ext.x1 + ext.x2) / 2, y: (ext.y1 + ext.y2) / 2 };
  }

  deleteScene(id) {
    const scene = this.story.scenes.find((s) => s.id === id);
    const inbound = this.story.scenes.reduce((n, s) => n + s.choices.filter((c) => c.target === id).length, 0);
    const msg = `Delete “${scene.title}”?${inbound ? ` ${inbound} choice${inbound === 1 ? '' : 's'} pointing here will become broken links.` : ''}`;
    if (!confirm(msg)) return;
    this.mutate((st) => {
      st.scenes = st.scenes.filter((s) => s.id !== id);
      if (st.startSceneId === id) st.startSceneId = st.scenes[0]?.id || '';
    });
    this.select(null);
  }

  addChoice(sceneId, target = '') {
    this.mutate((st) => {
      st.scenes.find((s) => s.id === sceneId).choices.push({ id: newId(), label: '', target, requires: '', sets: '' });
    }, { rebuild: true });
    const inputs = document.querySelectorAll('#inspector .choice input.grow');
    inputs[inputs.length - 1]?.focus();
  }

  removeChoice(sceneId, choiceId) {
    this.mutate((st) => {
      const s = st.scenes.find((x) => x.id === sceneId);
      s.choices = s.choices.filter((c) => c.id !== choiceId);
    }, { rebuild: true });
  }

  moveChoice(sceneId, index, delta) {
    this.mutate((st) => {
      const list = st.scenes.find((x) => x.id === sceneId).choices;
      const [c] = list.splice(index, 1);
      list.splice(index + delta, 0, c);
    }, { rebuild: true });
  }

  linkSelectedTo(targetId) {
    if (!this.selectedId) { toast('Select a scene first, then right-click the scene it should lead to.'); return; }
    const target = this.story.scenes.find((s) => s.id === targetId);
    this.addChoice(this.selectedId, targetId);
    toast(`Added a choice leading to “${target.title}”.`);
  }

  async autoLayout(opts) {
    const positions = await this.map.layout(this.story.startSceneId, opts);
    const byId = new Map(positions);
    this.mutate((st) => { for (const s of st.scenes) s.position = byId.get(s.id) || s.position; }, { quiet: true });
  }

  // ---------- play-testing ----------

  play(sceneId) {
    if (!this.story?.scenes.length) return;
    this.player.start(sceneId || this.story.startSceneId || this.story.scenes[0].id);
  }

  async recordPlaythrough(path) {
    const stats = await api.playthrough(this.story.id, path);
    this.story.stats = stats;
    this.sidebar.refresh();
    if (this.heatmap) this.map.render(this.story, this.analysis, { heatmap: true });
    if (this.selectedId) this.inspector.render();
  }

  async resetStats() {
    if (!confirm('Reset all play-test statistics for this story?')) return;
    this.story.stats = await api.resetStats(this.story.id);
    this.renderAll();
  }

  // ---------- story-level actions ----------

  async newStory() {
    const title = prompt('Name your new story:', 'Untitled story');
    if (title === null) return;
    try {
      const story = await api.create(title);
      await this.refreshList();
      await this.open(story.id);
      this.select(story.startSceneId);
    } catch (err) { toast(`Could not create story: ${err.message}`, 'error'); }
  }

  async deleteStory() {
    if (!this.story || !confirm(`Delete the story “${this.story.title}” and all its scenes? This cannot be undone.\n\nTip: export it first.`)) return;
    clearTimeout(this.saveTimer);
    this.dirty = false;
    await api.remove(this.story.id);
    this.story = null;
    const stories = await this.refreshList();
    if (stories[0]) await this.open(stories[0].id);
    else { this.map.cy.elements().remove(); this.renderAll(); }
  }

  async exportJson() {
    await this.flush();
    const { stats, ...rest } = this.story;
    const blob = new Blob([JSON.stringify({ format: 'story-mapper/1', ...rest, stats }, null, 2)], { type: 'application/json' });
    download(`${slug(this.story.title)}.json`, blob);
  }

  async exportPng() {
    download(`${slug(this.story.title)}-map.png`, await this.map.png());
  }

  async importFile(file) {
    if (file.size > 20 * 1024 * 1024) { toast('That file is too large (max 20 MB).', 'error'); return; }
    let doc;
    try { doc = JSON.parse(await file.text()); } catch { toast('That file is not valid JSON.', 'error'); return; }
    try {
      const story = await api.import(doc);
      await this.refreshList();
      await this.open(story.id);
      toast(`Imported “${story.title}”.`);
    } catch (err) { toast(`Import failed: ${err.message}`, 'error'); }
  }

  // ---------- chrome ----------

  bindChrome() {
    $('#story-select').addEventListener('change', (e) => e.target.value && this.open(e.target.value));
    $('#btn-new').addEventListener('click', () => this.newStory());
    $('#btn-empty-new').addEventListener('click', () => this.newStory());
    $('#btn-import').addEventListener('click', () => $('#file-import').click());
    $('#file-import').addEventListener('change', (e) => {
      const [file] = e.target.files;
      e.target.value = '';
      if (file) this.importFile(file);
    });
    $('#btn-export').addEventListener('click', () => this.exportJson());
    $('#btn-png').addEventListener('click', () => this.exportPng());
    $('#btn-delete-story').addEventListener('click', () => this.deleteStory());
    $('#btn-play').addEventListener('click', () => this.play());
    $('#btn-add').addEventListener('click', () => this.addScene());
    $('#btn-layout').addEventListener('click', () => this.autoLayout());
    $('#btn-fit').addEventListener('click', () => this.map.fit());
    $('#search').addEventListener('input', (e) => this.map.highlight(e.target.value));

    document.addEventListener('keydown', (e) => {
      const typing = e.target.closest('input, textarea, select, [contenteditable]');
      if (e.key === 'Escape') {
        if (this.player.active) this.player.close();
        else if (typing) e.target.blur();
        else this.select(null);
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || !this.story) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); this.addScene(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedId) { e.preventDefault(); this.deleteScene(this.selectedId); }
      else if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); this.play(); }
    });

    // Best-effort save when the tab closes.
    addEventListener('pagehide', () => {
      if (this.dirty && this.story) api.save(this.story, { keepalive: true }).catch(() => {});
    });
  }
}

const app = new App();
window.storyMapper = app; // handy for poking at state from the devtools console
app.init();
