import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { messageLoop, bindSocket } from './communication';

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '../../dist/preload.js'),
    },
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  // Comment these two functions out if you don't want the message loop to run
  bindSocket();
  messageLoop();
})
