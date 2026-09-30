# Aquarium Screen

A realistic live aquarium wallpaper for Ubuntu 24.04 (GNOME on X11). Fish swim, seaweed sways, bubbles rise, and the fish flee the mouse when it passes over bare desktop.

Built with Electron (a desktop-type window on the laptop screen) and Three.js. 3D assets are generated with headless Blender scripts.

## Run

```bash
npm install
npm run dev            # renderer in a browser at http://localhost:5173
npm run electron:dev   # same renderer as the wallpaper window (with `npm run dev` running)
npm start              # production build as the wallpaper
./scripts/install-autostart.sh   # launch at login
```

## Status

Scaffold: water backdrop with light shafts, caustic-lit sand floor, bubble streams, and placeholder fish that flee the cursor. Next up: real fish models, seaweed, rocks.
