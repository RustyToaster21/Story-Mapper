// A small demo story seeded on first run so the map isn't empty.
export const sampleStory = () => {
  const now = new Date().toISOString();
  const c = (id, label, target, extra = {}) => ({ id, label, target, requires: '', sets: '', ...extra });
  return {
    id: 'sample-lighthouse',
    title: 'The Lighthouse at Gull Point',
    description: 'Demo story: a storm, a dark lighthouse, and a ship heading for the rocks.',
    startSceneId: 'arrival',
    createdAt: now,
    updatedAt: now,
    scenes: [
      {
        id: 'arrival', title: 'Arrival', status: 'done', tags: ['act 1'],
        body: 'Rain lashes the cliffs. The lighthouse above Gull Point is dark, and somewhere out at sea a ship\'s horn sounds.',
        choices: [c('c1', 'Climb the cliff path to the lighthouse', 'door'), c('c2', 'Search the keeper\'s cottage first', 'cottage')],
      },
      {
        id: 'cottage', title: 'Keeper\'s Cottage', status: 'done', tags: ['act 1'],
        body: 'The cottage is cold. On the table: a brass key and a half-written log entry.',
        choices: [c('c3', 'Take the brass key', 'door', { sets: 'key' }), c('c4', 'Read the log', 'log')],
      },
      {
        id: 'log', title: 'The Log', status: 'review', tags: ['act 1', 'lore'],
        body: '"The lamp mechanism jams in the cold. Strike the governor twice." The entry ends mid-sentence.',
        choices: [c('c5', 'Pocket the key and go', 'door', { sets: 'key' })],
      },
      {
        id: 'door', title: 'Lighthouse Door', status: 'review', tags: ['act 2'],
        body: 'The iron door is locked tight.',
        choices: [
          c('c6', 'Unlock it with the brass key', 'stairs', { requires: 'key' }),
          c('c7', 'Force the door', 'injured', { requires: '!key' }),
          c('c8', 'Go back to the cottage', 'cottage', { requires: '!key' }),
        ],
      },
      {
        id: 'injured', title: 'Forced Entry', status: 'draft', tags: ['act 2'],
        body: 'The door gives way, and so does your shoulder.',
        choices: [c('c9', 'Stagger up the stairs', 'stairs')],
      },
      {
        id: 'stairs', title: 'The Lamp Room', status: 'draft', tags: ['act 3'],
        body: 'The great lamp is cold. The governor is frozen in place. The horn sounds again — closer.',
        choices: [c('c10', 'Strike the governor twice', 'saved'), c('c11', 'Try to light the lamp by hand', 'wreck')],
      },
      {
        id: 'saved', title: 'The Light Returns', status: 'draft', ending: 'good', tags: ['ending'],
        body: 'The mechanism groans and the beam sweeps the water. The ship turns away from the rocks.',
        choices: [],
      },
      {
        id: 'wreck', title: 'Too Late', status: 'draft', ending: 'bad', tags: ['ending'],
        body: 'The match gutters out. Below, timber splinters on stone.',
        choices: [],
      },
      {
        id: 'cellar', title: 'The Cellar (unwritten)', status: 'draft', tags: ['idea'],
        body: '', notes: 'Idea: a hidden cellar with the previous keeper\'s secret. Not linked yet.',
        choices: [],
      },
    ],
  };
};
