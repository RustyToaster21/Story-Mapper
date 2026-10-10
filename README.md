# Story Mapper

A local web app for planning, tracking and play-testing **choose-your-own-adventure** text games.

- **Map** — every scene is a node, every choice an arrow. Drag to arrange, or auto-arrange as a tree from the start scene.
- **Write** — scene text, author notes, tags, and a draft → review → done status per scene.
- **Branch logic** — choices can *require* a flag (`key`, or `!key` for "not set") and *set* one (`key`, or `!key` to clear it).
- **Find problems** — dead ends, unreachable scenes, choices with no target, flags that are required but never set, no reachable ending.
- **Track progress** — % done, word count, number of endings, distinct paths to an ending, longest path, loops.
- **Play-test** — run the story like a player, with flags and a Back button. The path is highlighted on the map. Runs from the start scene are recorded, giving you scene/ending coverage and an optional visit heatmap.
- **Import / export** stories as JSON, and save the map as a PNG.

Runs entirely on this machine: Node + Express, stories stored as JSON files, no CDN or network calls.

## Run it

```sh
cd ~/Projects/story-mapper
npm install        # first time only
npm start
```

Then open <http://localhost:4777>. A demo story ("The Lighthouse at Gull Point") is created on first run.

| Setting | Default | |
|---|---|---|
| `PORT` | `4777` | `PORT=8080 npm start` |
| `HOST` | `127.0.0.1` | Local-only by default. Other hostnames are refused by the Host-header check. |
| `DATA_DIR` | `./data/stories` | One `<id>.json` file per story — easy to back up or put in git. |

`npm run dev` restarts the server when files change; `npm test` runs the test suite.

### Keep it running in the background (optional)

```sh
mkdir -p ~/.config/systemd/user
cp deploy/story-mapper.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now story-mapper
```

## Using it

| Action | How |
|---|---|
| Add a scene | Double-click empty map space, press **N**, or use **+ Scene** |
| Link scenes | Select a scene, then **right-click** the scene it should lead to — or add a choice in the editor and pick a target (or "+ New scene…") |
| Delete a scene | Select it and press **Del**, or use the button in the editor |
| Search | Press **/** — non-matching scenes fade out |
| Play-test | **P** or **▶ Play-test**; "Play from here" in the editor starts at any scene |

On the map, the border color shows status (grey draft, amber review, green done). Endings are filled green/red/slate, the start scene has a double border, a dashed red outline marks a scene with an issue, and a dashed arrow is a choice that needs a flag.

## Layout

```
server/        Express API, JSON file store, input validation, demo story
public/        Frontend (vanilla JS modules + Cytoscape.js served from node_modules)
  js/analysis.js   Story-structure analysis, shared with the tests
test/          node:test suites (analysis + API)
docs/          Design notes
```
