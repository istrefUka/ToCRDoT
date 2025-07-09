import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { Communication } from './communication';

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

  const c = new Communication(9999, undefined, "project1", "Project 1");

  // Comment these two functions out if you don't want the message loop to run
  await c.init();
  c.messageLoop()
  setTimeout(()=>c.setPort(9999), 3000)
})
