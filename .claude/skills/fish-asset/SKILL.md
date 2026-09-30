---
name: fish-asset
description: Create or modify a fish, seaweed, rock, or other 3D asset by writing a headless Blender Python script that exports glTF for the Three.js scene. Use whenever a new model or texture is needed.
---

Assets are made reproducibly from scripts, never by hand in the Blender GUI.

## Layout (default, unless the repo already does it differently)

- Fish: add a body-plan entry to `SPECIES` in `assets/src/fish.py` (one generator for all species), then a matching entry (pattern GLSL + behavior: `school` / `solitary` / `bottom`) in `src/scene/species.js`. Patterns are shader-side from position, so the `.glb` stays geometry-only (`Body` + `Fins`).
- Other props: script at `assets/src/<name>.py`, output `public/models/<name>.glb`.
- Run with: `blender -b --factory-startup -P assets/src/<name>.py`. Blender is the snap at `/snap/bin/blender`. Snap confinement can block paths outside `$HOME`, so keep outputs inside the repo.

## Conventions the renderer relies on

- Units in meters, with a real-world size (e.g. a neon tetra is about 0.03 m, an angelfish about 0.15 m). The scene scales the tank, not the fish.
- In glTF the fish faces **+Z** with **+Y** up (Three.js `lookAt` points +Z along the swim direction), and the origin is at the center of mass. The exporter's Y-up conversion maps Blender -Y to glTF +Z, so model the fish facing **Blender -Y**, with Z up.
- Swimming is a vertex shader. Give the mesh enough segments along its length, and store normalized body position (0 = nose, 1 = tail tip) in a vertex color or UV2 channel so the shader can weight the wave.
- Budget per fish: 3k triangles or fewer, one PBR material, textures at 1024 px or smaller. Dozens of fish have to run on an AMD iGPU.
- Materials: Principled BSDF only (it exports cleanly to glTF). Use subsurface/sheen-like tricks through the Three.js material, not Blender-only nodes.

## Realism checklist

- Start from reference photos of the real species (body profile, fin shape, pattern), and name the species in the script's docstring.
- Put some irregularity in the patterns (noise), not perfect stripes. Keep countershading: dark back, light belly.
- Fins should be thin and semi-transparent (alpha blend or alpha hash).
- After exporting, check the asset in the scene with `/preview`. Don't judge it in Blender.

## Licensing

Only use CC0 inputs, or inputs generated in this repo. Record where any external texture or reference came from in the script's docstring.
