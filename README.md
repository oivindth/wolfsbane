# Wolfsbane

A Witcher 3–inspired third-person action RPG running in the browser.
Babylon.js + Havok + Svelte 5 + TypeScript. Requires Node LTS (≥22) and pnpm 9+.

**Play it:** https://oivindth.github.io/wolfsbane/ — deployed from `main` via
GitHub Actions (runs tests + checks, then publishes the Vite build).

## Controls

| Input | Action |
|---|---|
| WASD / arrows | Move (camera-relative) |
| Shift | Sprint (drains stamina) |
| Space | Dodge roll (i-frames) |
| F | Light attack (3-hit combo) |
| R | Heavy attack |
| Q | Cast selected sign |
| 1 / 2 / 3 | Select Igni / Aard / Quen |
| Tab | Lock-on to nearest wolf |
| Enter | Respawn after death |
| Mouse drag / wheel | Orbit / zoom camera |

## Develop

```bash
pnpm install
pnpm dev        # dev server
pnpm test       # vitest unit tests
pnpm check      # biome + svelte-check
pnpm build      # production build
```

Design docs live in `docs/superpowers/specs/`, implementation plans in
`docs/superpowers/plans/`.
