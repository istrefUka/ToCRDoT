/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

function switchScene(id: Scene) {
  const scenes = document.querySelectorAll(".scene");
  scenes.forEach(scene => {
    (scene as HTMLElement).style.display = "none";
  })

  const showScene = document.getElementById(id);
  if (showScene) {
    showScene.style.display = "block";
  }

  // toggle some buttons maybe..
}

const btn = document.getElementById('login-btn');
const loginInput = document.getElementById('login-input');
btn?.addEventListener('click', () => {
  const username = loginInput.value;
  if (username.length < 4 || username.length > 20) {
    // TODO impement a label in html to show this message
    console.log('username must be between 4 and 20 characters long');
    return;
  }
  window.electronAPI.send('login-submit', username);
})

window.electronAPI.on('switch-scene', (_, scene: Scene) => {
  switchScene(scene);
})

const projectPreviewList = document.getElementById('project-preview-list');
window.electronAPI.on('update-project-preview', (_, projects: ProjectPreview[]) => {
  console.log('update project preview!!');
  projectPreviewList.innerHTML = '';
  for (const p of projects) {
    const listitem = document.createElement('li');
    listitem.innerHTML = p.projectTitle;
    projectPreviewList.appendChild(listitem);
  }
})

console.log('👋 This message is being logged by "renderer.js", included via webpack');
