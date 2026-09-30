import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The laptop panel (eDP) sits at +0+0; HDMI is to its right. Pick by bounds, not index.
function laptopDisplay() {
  const displays = screen.getAllDisplays();
  return displays.find((d) => d.bounds.x === 0 && d.bounds.y === 0) ?? screen.getPrimaryDisplay();
}

function createWindow() {
  const { bounds } = laptopDisplay();
  const win = new BrowserWindow({
    ...bounds,
    // _NET_WM_WINDOW_TYPE_DESKTOP: Mutter keeps it below all windows, off the taskbar and alt-tab.
    type: 'desktop',
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    backgroundColor: '#021018',
    webPreferences: { backgroundThrottling: true },
  });

  if (process.env.VITE_DEV_URL) {
    win.loadURL(process.env.VITE_DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
