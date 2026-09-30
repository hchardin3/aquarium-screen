# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A live, realistic aquarium wallpaper (fish, seaweed, bubbles) for the owner's Ubuntu 24.04 laptop. Fish react to the mouse.

## Stack (decided)

- Electron main process + Three.js renderer, bundled with Vite. Node 22 is on PATH; use npm.
- Fish/props are glTF (`.glb`) generated with headless Blender scripts (`blender -b -P <script>.py`, snap install). See the `fish-asset` skill.
- Swimming is a vertex-shader body wave, not skeletal rigs. Water realism comes from shaders (caustics, god rays, depth fog, particles).

## Target environment constraints

- The session is **X11** under GNOME 46 (Mutter). The wallpaper is an Electron `BrowserWindow` with `type: 'desktop'`. Don't add Wayland-only or wlr-layer-shell code.
- **Laptop screen only**: the `eDP` output, 1920x1080 at +0+0. The HDMI monitor keeps its normal wallpaper. Pick the display via Electron `screen` by bounds, not by index.
- **Mouse reaction only over bare desktop**: use normal DOM pointer events on the desktop-type window. Do NOT poll the global X11 cursor. That's an explicit decision so fish don't react while the user works in other windows.
- The GPU is hybrid: the AMD iGPU is the default GL renderer and the RTX 3070 is available. Target the iGPU, aiming for 60 fps at 1080p. Throttle or pause when the window is hidden or covered (`visibilitychange` / Electron `backgroundThrottling`).

## Working rules

- The renderer must also run in a plain browser (`npm run dev` / Vite) so it can be screenshotted. Keep Electron-only code in the main/preload process.
- "Realistic" is the bar. Before calling a visual change done, check it in a screenshot (the `/preview` skill), not just by reading the code.
