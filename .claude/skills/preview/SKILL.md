---
name: preview
description: Launch the aquarium renderer in a browser, screenshot it, and check console errors and frame rate. Use after any visual, shader, or animation change, and before claiming a visual change works.
---

Check the aquarium scene visually. $ARGUMENTS can name what to focus on (e.g. "caustics", "fish reaction to mouse").

1. Start the Vite dev server in the background (`npm run dev`). Read the local URL from its output. If `package.json` has no `dev` script yet, stop and say so.
2. Load the chrome-devtools MCP tools via ToolSearch (`select:mcp__chrome-devtools-qa__new_page,...take_screenshot,list_console_messages,evaluate_script,hover,resize_page`).
3. Open the URL and resize to 1920x1080, which matches the eDP target.
4. Wait about 2 s for assets and shaders, then take a screenshot. Take a second one about 3 s later to confirm things move.
5. If mouse behavior is in scope, `hover` near a fish, screenshot, and describe how the fish responded.
6. Run `list_console_messages` and report every error or warning.
7. Measure FPS with `evaluate_script`: count `requestAnimationFrame` callbacks over 2 s. Flag anything under 55 fps. The headless/dev GPU may differ from the laptop's AMD iGPU, so treat the number as a relative signal.
8. Judge the screenshot against "realistic underwater" critically. Look at lighting falloff, color depth attenuation (reds fade first), scale, motion, and banding. List concrete defects, not praise.
9. Stop the dev server when done.
