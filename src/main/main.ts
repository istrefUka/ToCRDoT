import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { messageLoop, initCommunication, setPort } from './communication';

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

app.whenReady().then(async () => {
  createWindow();

  // Comment these two functions out if you don't want the message loop to run
  await initCommunication();
  await setPort(8888);
  setTimeout(()=>setPort(9999), 3000)
  await messageLoop();
})
