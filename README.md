# tank_9 - PlayCanvas RTS Web

A complete, replayable single-player Web RTS (Real-Time Strategy) game built with PlayCanvas and TypeScript.

## Active Production Route

- The repository root is the active Web game project.
- `unity-rts-builder-prototype/` is archived as a design-source reference only.
- `RTS-Sandbox/` is a read-only reference directory only.
- Ongoing delivery work should default to the root Web project unless a task explicitly says otherwise.

## Current Milestone

- Current branch target: `refactor/demo-polish`
- Current milestone: `refactor/demo-polish` for fast, readable RTS demo feel
- Next branch after demo polish: `feature/ci-publish`

## Quick Start

```bash
npm install
npm run play             # Start local play session on http://127.0.0.1:4173/
```

## Scripts

- `npm install` installs dependencies.
- `npm run dev` starts the Vite development server.
- `npm run play` is the preferred fixed local play-session command (`vite --host 127.0.0.1 --port 4173`).
- `npm run dev -- --host 127.0.0.1 --port 4173` remains an equivalent fallback when you need the regular dev alias.
- `npm run lint` runs ESLint on `src/**/*.ts`.
- `npm run typecheck` runs TypeScript checks.
- `npm run test` runs runtime smoke tests with Vitest.
- `npm run build` produces the static Web build in `dist/`.
- `npm run computer-use -- "your task"` runs an OpenAI Computer Use browser session through Playwright.

## Computer Use

- Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
- Run `npm run computer-use -- "Search for PlayCanvas docs"` to launch a local Chromium window and let the model operate it.
- This harness stops if OpenAI returns safety checks, so sensitive actions still need manual review.

## Current Bootstrap Scope

The current root app already boots without PlayCanvas editor bindings and creates the following through code:

- DOM app shell and canvas mount path
- PlayCanvas app instance
- camera
- directional light
- ground placeholder
- visible reference marker

The current milestone also establishes replacement-friendly placeholder content metadata so future art can be swapped without rewriting gameplay logic.

## Project Structure

- `src/core/` shared runtime contracts, state, and config
- `src/bootstrap/` app shell, app bootstrap, asset manifest, and world shell
- `src/platform/playcanvas/` PlayCanvas-specific app wiring
- `docs/` mirrored copies of the root project docs
- `.github/workflows/` CI entry points

## Documentation Policy

- Root docs are authoritative.
- `docs/` is a mirrored publishing copy.
- Keep both in sync in the same branch when updating project guidance.
