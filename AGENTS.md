# AGENTS.md — building a game in this repo

You are iterating on a game that ships to `speedrungames.net/games/<slug>/`.

## How deploy works (read first)

**This repo auto-deploys to the portal on every push to `main`.** You do not
deploy by hand. `.github/workflows/deploy.yml` reads the slug from
`game.manifest.json` and calls the portal's reusable workflow
(`Brynrg/speedrungames/.github/workflows/deploy-game.yml`), which builds, runs
the portal's canonical ingest, and opens an **auto-merging portal PR** that
lands only when CI + the Netlify deploy preview pass.

> ❌ **Never** copy `dist/` into the speedrungames portal yourself
> (`cp -r dist …`), never hand-edit `apps/web/public/games/` in the portal.
> That is exactly the mistake this pipeline prevents — a hand-copied build once
> shipped a "no visible change" deploy. To deploy, **push.** For a manual local
> deploy, run `npm run deploy:portal` (it runs the portal's ingest script — it
> does not copy files).

Requirements for auto-deploy to work:
- `game.manifest.json#slug` is set (not the `__SLUG__` placeholder).
- The repo has the `SPEEDRUNGAMES_TOKEN` secret (set by `pnpm new:game`).

## What you start with

A Vite + TypeScript scaffold consuming [speedrungames-sdk](https://github.com/Brynrg/speedrungames-sdk).

| File | Role |
|---|---|
| `src/main.ts` | Entry. Wires canvas + game loop + timer + HUD + PB storage + leaderboard. **Write your game here.** |
| `src/styles.css` | Theme + canvas styles. |
| `index.html` | Vite entry. Don't add `<script>`s — import from `main.ts`. |
| `game.manifest.json` | Source manifest the portal ingests. **slug/title/description/framework drive the deploy.** |
| `vite.config.ts` | **`base: "./"` is load-bearing** — relative asset URLs survive the `/games/<slug>/` mount. |
| `tests/smoke.spec.ts` | Playwright smoke: built game renders, no console errors. Runs in CI before deploy. |
| `.github/workflows/ci.yml` | Typecheck + build + path lint + smoke on every PR. |
| `.github/workflows/deploy.yml` | Auto-deploy on push to main (calls the portal reusable workflow). |

## Mandatory edits before shipping

1. **`game.manifest.json`** — set `slug`, `title`, `description`, `framework`
   (and `category`, `emoji`, `supportsMobile`). `pnpm new:game` does this for you.
2. **`src/main.ts`** — set `const SLUG` to your slug (enables PB storage +
   leaderboard), then replace the gameplay section with your game.
3. **`index.html`** — update `<title>`.

## Hard rules

1. **Relative asset URLs only.** Source: `./assets/foo.png`. CSS: `url(./foo.png)`.
   Never absolute `/...` paths in HTML/CSS. (`npm run lint:paths` + the portal's
   ingest broken-path scan both enforce this.)
2. **Don't remove `base: "./"`** from `vite.config.ts`.
3. **Keep CI green** — typecheck, build, path lint, smoke must pass, or the
   deploy PR won't auto-merge.
4. **No secrets in the repo.** The bundle ships to every player.
5. **Never deploy by hand into the portal.** Push, or `npm run deploy:portal`.
