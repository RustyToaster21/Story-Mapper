import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, flagSatisfied, applyFlag } from '../public/js/analysis.js';

const scene = (id, choices = [], extra = {}) => ({
  id, title: id, body: '', status: 'draft', ending: '', tags: [], notes: '', position: null,
  choices: choices.map(([target, more = {}], i) => ({ id: `${id}-c${i}`, label: `to ${target}`, target, requires: '', sets: '', ...more })),
  ...extra,
});

const story = (scenes, startSceneId = scenes[0]?.id) => ({ startSceneId, scenes });

test('finds dead ends, unreachable scenes and broken links', () => {
  const r = analyze(story([
    scene('a', [['b'], ['ghost'], ['']]),
    scene('b'),                              // dead end: no choices, not an ending
    scene('c', [['a']]),                     // unreachable from a
    scene('d', [], { ending: 'good' }),      // unreachable ending
  ]));
  assert.deepEqual(r.deadEnds, ['b']);
  assert.deepEqual(r.unreachable.sort(), ['c', 'd']);
  assert.deepEqual(r.brokenChoices.map((b) => b.choiceId), ['a-c1', 'a-c2']);
  assert.deepEqual(r.endings, ['d']);
  assert.equal(r.reachableEndings.length, 0);
});

test('missing start scene is reported', () => {
  const r = analyze(story([scene('a')], 'nope'));
  assert.equal(r.missingStart, true);
  assert.deepEqual(r.unreachable, ['a']);
});

test('counts distinct paths to endings and longest path', () => {
  //   a -> b -> d(end)
  //   a -> c -> d
  //   c -> e(end)
  const r = analyze(story([
    scene('a', [['b'], ['c']]),
    scene('b', [['d']]),
    scene('c', [['d'], ['e']]),
    scene('d', [], { ending: 'good' }),
    scene('e', [], { ending: 'bad' }),
  ]));
  assert.equal(r.endingPaths, 3);
  assert.equal(r.longestPath, 3); // a -> b -> d is 3 scenes
  assert.equal(r.hasCycle, false);
  assert.deepEqual(r.endingsByType, { good: 1, bad: 1, neutral: 0 });
});

test('detects cycles without looping forever', () => {
  const r = analyze(story([
    scene('a', [['b']]),
    scene('b', [['a'], ['c']]),
    scene('c', [], { ending: 'neutral' }),
  ]));
  assert.equal(r.hasCycle, true);
  assert.equal(r.endingPaths, 1);
});

test('flags required but never set are reported', () => {
  const r = analyze(story([
    scene('a', [['b', { sets: 'key' }], ['c', { requires: 'lamp' }], ['b', { requires: '!key' }]]),
    scene('b', [], { ending: 'good' }),
    scene('c', [], { ending: 'bad' }),
  ]));
  assert.deepEqual(r.flags.sort(), ['key', 'lamp']);
  assert.deepEqual(r.requiredNeverSet, ['lamp']);
});

test('status counts and word count', () => {
  const r = analyze(story([
    scene('a', [], { status: 'done', body: 'You wake up  in a cave.' }),
    scene('b', [], { status: 'review', body: '' }),
  ]));
  assert.deepEqual(r.statusCounts, { draft: 0, review: 1, done: 1 });
  assert.equal(r.wordCount, 6);
});

test('flag helpers', () => {
  const flags = new Set(['key']);
  assert.equal(flagSatisfied('', flags), true);
  assert.equal(flagSatisfied('key', flags), true);
  assert.equal(flagSatisfied('!key', flags), false);
  assert.equal(flagSatisfied('lamp', flags), false);
  assert.equal(flagSatisfied('!lamp', flags), true);
  applyFlag('lamp', flags);
  applyFlag('!key', flags);
  assert.deepEqual([...flags], ['lamp']);
});
