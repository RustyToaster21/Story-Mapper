// Pure story-structure analysis, shared by the browser UI and the Node tests.

const PATH_CAP = 100000;   // stop counting paths beyond this (branchy stories explode)
const VISIT_CAP = 200000;  // hard bound on DFS work

export const STATUSES = ['draft', 'review', 'done'];
export const ENDINGS = ['good', 'bad', 'neutral'];

// A requirement is "" (always), "flag" (must be set) or "!flag" (must be unset).
export function flagSatisfied(requires, flags) {
  if (!requires) return true;
  return requires.startsWith('!') ? !flags.has(requires.slice(1)) : flags.has(requires);
}

// An effect is "" (nothing), "flag" (set it) or "!flag" (clear it).
export function applyFlag(sets, flags) {
  if (!sets) return;
  if (sets.startsWith('!')) flags.delete(sets.slice(1));
  else flags.add(sets);
}

const flagName = (s) => (s.startsWith('!') ? s.slice(1) : s);

export function analyze(story) {
  const scenes = story.scenes || [];
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const missingStart = !byId.has(story.startSceneId);

  const brokenChoices = [];
  const adjacency = new Map();
  const flagsSet = new Set();
  const flagsRequired = new Set();
  const positiveRequired = new Set();
  let choiceCount = 0;
  let wordCount = 0;
  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const endingsByType = Object.fromEntries(ENDINGS.map((s) => [s, 0]));

  for (const s of scenes) {
    const targets = [];
    for (const c of s.choices || []) {
      choiceCount++;
      if (!c.target || !byId.has(c.target)) brokenChoices.push({ sceneId: s.id, choiceId: c.id });
      else targets.push(c.target);
      if (c.sets && !c.sets.startsWith('!')) flagsSet.add(c.sets);
      if (c.requires) flagsRequired.add(flagName(c.requires));
      if (c.requires && !c.requires.startsWith('!')) positiveRequired.add(c.requires);
    }
    adjacency.set(s.id, targets);
    if (s.status in statusCounts) statusCounts[s.status]++;
    if (s.ending in endingsByType) endingsByType[s.ending]++;
    wordCount += (s.body || '').split(/\s+/).filter(Boolean).length;
  }

  const endings = scenes.filter((s) => s.ending).map((s) => s.id);
  const deadEnds = scenes.filter((s) => !s.ending && (adjacency.get(s.id) || []).length === 0
    && !(s.choices || []).length).map((s) => s.id);

  // Reachability (ignores flag conditions — structural view).
  const reachable = new Set();
  if (!missingStart) {
    const queue = [story.startSceneId];
    reachable.add(story.startSceneId);
    while (queue.length) {
      for (const t of adjacency.get(queue.shift())) {
        if (!reachable.has(t)) { reachable.add(t); queue.push(t); }
      }
    }
  }
  const unreachable = scenes.filter((s) => !reachable.has(s.id)).map((s) => s.id);
  const reachableEndings = endings.filter((id) => reachable.has(id));

  // Simple-path DFS from the start: counts paths to endings, longest path, cycles.
  let endingPaths = 0;
  let longestPath = 0;
  let hasCycle = false;
  let work = 0;
  let truncated = false;
  if (!missingStart) {
    const onPath = new Set();
    const dfs = (id, depth) => {
      if (++work > VISIT_CAP || endingPaths >= PATH_CAP) { truncated = true; return; }
      onPath.add(id);
      longestPath = Math.max(longestPath, depth);
      if (byId.get(id).ending) endingPaths++;
      for (const t of adjacency.get(id)) {
        if (onPath.has(t)) hasCycle = true;
        else dfs(t, depth + 1);
      }
      onPath.delete(id);
    };
    dfs(story.startSceneId, 1);
  }

  const allFlags = new Set([...flagsSet, ...flagsRequired]);
  for (const s of scenes) for (const c of s.choices || []) if (c.sets) allFlags.add(flagName(c.sets));

  return {
    sceneCount: scenes.length,
    choiceCount,
    wordCount,
    statusCounts,
    endingsByType,
    missingStart,
    endings,
    reachableEndings,
    deadEnds,
    unreachable,
    brokenChoices,
    hasCycle,
    endingPaths,
    longestPath,
    truncated,
    flags: [...allFlags],
    requiredNeverSet: [...positiveRequired].filter((f) => !flagsSet.has(f)),
  };
}
