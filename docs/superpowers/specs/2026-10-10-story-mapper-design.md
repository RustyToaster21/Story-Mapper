# Story Mapper — design

## Intent
A locally hosted web app for planning and tracking a choose-your-own-adventure
(CYOA) text game: write scenes, wire choices between them, see the branching
map, find structural problems, and play-test the story in the browser.

**Stated by the user:** story-mapping tracker, web app, hosted locally on this
device, interactive, for a CYOA text-based game.

**Assumptions (made while the user was away — easy to revisit):**
- Single user, single machine. No accounts. Server binds to `127.0.0.1` only.
- Multiple stories, each stored as one JSON file under `data/stories/`.
- Plain-text scene bodies (no markup rendering).
- Lightweight state: a choice may *require* a flag and/or *set* a flag
  (`!flag` negates / clears). No full scripting language.

## Architecture
- `server/` — Node 22 + Express 5. `store.js` (atomic JSON file storage),
  `validate.js` (normalises/limits any story document, incl. imports),
  `app.js` (REST API + security middleware), `index.js` (entry).
- `public/js/analysis.js` — pure ES module shared by browser and tests:
  reachability, dead ends, broken links, endings, cycles, path counts, flags.
- `public/` — vanilla JS frontend. Cytoscape.js (served from `node_modules`,
  no CDN) renders the map; an inspector edits the selected scene; an issues
  panel lists analysis results; a play-test overlay runs the story.

## Data model
```
Story  { id, title, description, startSceneId, scenes[], stats, createdAt, updatedAt }
Scene  { id, title, body, status: draft|review|done, ending: ""|good|bad|neutral,
         tags[], notes, position {x,y}|null, choices[] }
Choice { id, label, target (sceneId), requires (flag|""), sets (flag|"") }
stats  { playthroughs, visits {sceneId:n}, endingsReached {sceneId:n} }
```

## API
`GET/POST /api/stories`, `GET/PUT/DELETE /api/stories/:id`,
`POST /api/stories/import`, `POST /api/stories/:id/playthrough`.
PUT carries `baseUpdatedAt`; a mismatch returns 409 (two tabs editing).

## Security
Everything a story contains is untrusted (imports can come from anywhere):
UI renders via `textContent` only; strict CSP (`script-src 'self'`); Host
header allow-list (DNS-rebinding defence); non-JSON writes rejected; ids
validated against `^[A-Za-z0-9_-]{1,64}$` before touching the filesystem.

## Testing
`node --test`: analysis unit tests, validation tests, API tests against an
ephemeral server on a temp data dir. GUI smoke-checked headlessly.
