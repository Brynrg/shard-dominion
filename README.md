# speedrungames-game-template

Vite + TypeScript starter for games that ship on [speedrungames.net](https://speedrungames.net).

What you get out of the box:

- **Canvas game loop** with deltaTime, DPR-aware resize
- **Millisecond-precision speedrun timer** with pause/resume, splits, finish
- **Personal-best persistence** via `localStorage`
- **HUD overlay** (time, PB, status)
- **CI** that typechecks, builds, and verifies relative paths on every PR
- **Netlify config** that just works — push to `main`, get a live site

A playable demo (click N targets as fast as you can) ships in the template so a new repo deploys to a working game on day one.

## Quickstart

```bash
# 1. Create your game repo from this template:
gh repo create Brynrg/game-<slug> --public \
  --template Brynrg/speedrungames-game-template --clone
cd game-<slug>
npm install

# 2. Set the storage namespace.
# In src/storage.ts, replace SLUG = "REPLACE_ME" with your slug.

# 3. Build your game in src/main.ts (replace the gameplay section).

# 4. Run locally.
npm run dev   # → http://localhost:5173

# 5. Push to main. CI runs (typecheck, build, path lint).
# 6. Connect to Netlify (one-time): netlify.com → Add new site → import this repo → Deploy.
# 7. In Brynrg/speedrungames, add one entry to apps/web/src/lib/games.data.json with proxyTo.

# After that: every push to main on this repo updates the live game on speedrungames.net.
```

See [AGENTS.md](AGENTS.md) for the full build playbook and API quick references.

## Stack

| | |
|---|---|
| Language | TypeScript (strict) |
| Bundler | Vite 5 |
| Runtime | Node 22 (CI + Netlify) |
| Host | Netlify (per-game site) |
| Lint | Built-in path check (`scripts/check-relative-paths.mjs`) |

## Layout

```
.
├── src/
│   ├── main.ts            # Entry — replace gameplay section
│   ├── game.ts            # Canvas + rAF loop
│   ├── speedrun.ts        # Timer, splits, formatTime
│   ├── storage.ts         # PB persistence (CHANGE SLUG!)
│   ├── ui.ts              # HUD overlay
│   └── styles.css
├── scripts/
│   └── check-relative-paths.mjs
├── .github/workflows/ci.yml
├── index.html
├── vite.config.ts          # base: "./" — required
├── tsconfig.json
└── netlify.toml
```

## Going plain-static (no bundler)

Some games (Phaser, hand-rolled HTML+JS) don't need Vite. To switch:

1. Move your `index.html` and assets to the repo root.
2. In `netlify.toml`, comment out `command` and set `publish = "."`.
3. Delete `src/`, `vite.config.ts`, `tsconfig.json`, and the build steps from CI.

Keep all asset paths relative (`./foo.png`).

## See also

- Umbrella repo: [Brynrg/speedrungames](https://github.com/Brynrg/speedrungames)
- Speedrungames playbook: [Brynrg/speedrungames/AGENTS.md](https://github.com/Brynrg/speedrungames/blob/main/AGENTS.md)
