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
    // Never set focusable: false here: on Linux it makes the window override-redirect, so it
    // escapes the WM and paints above every app and the GNOME shell.
    skipTaskbar: true,
    // Frameless windows get client-side shadow margins (_GTK_FRAME_EXTENTS) that offset the content.
    hasShadow: false,
    show: false,
    backgroundColor: '#021018',
    webPreferences: { backgroundThrottling: true },
  });
  // Mutter may adjust the requested geometry at map time; pin it back to the full panel.
  win.once('ready-to-show', () => {
    win.show();
    win.setBounds(bounds);
  });

  if (process.env.VITE_DEV_URL) {
    win.loadURL(process.env.VITE_DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
