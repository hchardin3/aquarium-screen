# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A live, realistic aquarium wallpaper (fish, seaweed, bubbles) for the owner's Ubuntu 24.04 laptop. Fish react to the mouse.

## Stack (decided)

- Electron main process + Three.js renderer, bundled with Vite. Node 22 is on PATH; use npm.
- Hybrid rendering: the static aquascape is pre-rendered in Blender Cycles (`assets/src/aquascape.py` -> `public/plates/{back.jpg,front.png,sway.png}`, OptiX on the RTX 3070, ~6 min full, `-- --preview` / `-- --pass front` for quick iterations). Only fish, bubbles, particles, light shimmer and plant sway are live.
- Wood/rock/gravel use CC0 Poly Haven scans: run `python3 assets/src/fetch_textures.py` before rendering (`assets/textures/` is gitignored; commit the plates).
- The Blender camera and `src/scene/tank.js` `CAMERA` must stay identical (fov_y 35, 0.95 m, Blender (x,y,z) -> Three (x,z,-y)), or live fish float off the tank.
- The `front` pass must exclude the Water volume: with a transparent film Cycles turns absorption into alpha and darkens the whole live scene.
- Fish are glTF (`.glb`) from `assets/src/fish.py` (headless Blender, snap install); species look/behavior in `src/scene/species.js`. See the `fish-asset` skill. Swimming is a vertex-shader body wave, not skeletal rigs.
- Fish materials share one `onBeforeCompile` source, so each needs a distinct `customProgramCacheKey` or Three reuses the first species' shader.
- Production Electron loads `app://aquarium/` (custom protocol in `electron/main.js`) because `fetch()` of `file://` fails and GLTFLoader needs fetch.

## Target environment constraints

- The session is **X11** under GNOME 46 (Mutter). The wallpaper is an Electron `BrowserWindow` with `type: 'desktop'`. Don't add Wayland-only or wlr-layer-shell code.
- **Laptop screen only**: the `eDP` output, 1920x1080 at +0+0. The HDMI monitor keeps its normal wallpaper. Pick the display via Electron `screen` by bounds, not by index.
- **Mouse reaction only over bare desktop**: use normal DOM pointer events on the desktop-type window. Do NOT poll the global X11 cursor. That's an explicit decision so fish don't react while the user works in other windows.
- The GPU is hybrid: the AMD iGPU is the default GL renderer and the RTX 3070 is available. Target the iGPU, aiming for 60 fps at 1080p. Throttle or pause when the window is hidden or covered (`visibilitychange` / Electron `backgroundThrottling`).

## Working rules

- The renderer must also run in a plain browser (`npm run dev` / Vite) so it can be screenshotted. Keep Electron-only code in the main/preload process.
- "Realistic" is the bar. Before calling a visual change done, check it in a screenshot (the `/preview` skill), not just by reading the code.
