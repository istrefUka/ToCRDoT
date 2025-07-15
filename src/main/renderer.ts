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

import { uuid } from './append_only_log';
import './index.css';
import { ProjectView, TaskView } from './Project';

function switchScene(id: Scene) {
  const scenes = document.querySelectorAll(".scene");
  scenes.forEach(scene => {
    (scene as HTMLElement).style.display = "none";
  })

  const showScenes = document.querySelectorAll("." + id);
  showScenes.forEach(scene => {
    (scene as HTMLElement).style.display = "block";
  });

  // toggle some buttons maybe..
}

const loginInput = document.getElementById('login-input');
loginInput?.addEventListener('keypress', (event) => {
  if (event.key === "Enter") {
    const username = loginInput.value;
    if (username.length < 4 || username.length > 20) {
      // TODO implement a label in html to show this message
      console.log('username must be between 4 and 20 characters long');
      return;
    }
    window.electronAPI.send('login-submit', username);
  }
});

window.electronAPI.on('switch-scene', (_, scene: Scene) => {
  switchScene(scene);
});

window.electronAPI.on('set-project-title', (_,projectTitle: string) => {
  const titleEl = document.getElementById('project-title');
  if (titleEl) {
    titleEl.innerText = projectTitle;
  }
});

const ipInput = document.getElementById('ip-input');
const portInput = document.getElementById('port-input');
ipInput.addEventListener('keypress', (event) => {
  if (event.key === "Enter") {
    window.electronAPI.send('change-ip-address', ipInput.value);
  }
});
portInput?.addEventListener('keypress', (event) => {
  if (event.key === "Enter") {
    window.electronAPI.send('change-port', Number(portInput.value));
  }
});

const projectPreviewList = document.getElementById('project-preview-list');
function updateProjectPreview(projects: ProjectPreview[]) {
  projectPreviewList.innerHTML = ''; // clear contents of list
  for (const p of projects) { // and then fill it back up with content
    // TODO (if there is time) this view is kind of ugly, maybe we can fix that
    const listitem = document.createElement('li');
    const projectButton = document.createElement('button');
    projectButton.textContent = p.projectTitle;
    projectButton.style.float = "left";
    projectButton.addEventListener('click', () => {
      window.electronAPI.send('open-project', p.projectID);
    });
    const projIdDiv = document.createElement('div');
    projIdDiv.appendChild(projectButton);
    const text = document.createElement('p');
    text.textContent = '(ID: ' + p.projectID + ')';
    projIdDiv.appendChild(text);
    listitem.appendChild(projIdDiv);
    projectPreviewList.appendChild(listitem);
  }
}



window.electronAPI.on('update-project-preview', (_, projects: ProjectPreview[]) => {updateProjectPreview(projects);})

window.electronAPI.on('update-project-view', (_, projectView: ProjectView) => {updateProjectView(projectView);})

const STATE_LABELS: Record<string,string> = {
  todo:       'To Do',
  inprogress: 'In Progress',
  done:       'Done',
};


const projectViewList = document.getElementById('project-view-list');


function updateProjectView(projectView: ProjectView) { //TODO: add Members of task.
  projectViewList.innerHTML = ''; // clear contents of list
  for (const p of projectView.taskViews) { // and then fill it back up with content
    const listitem = document.createElement('li');

    const taskIdDiv = document.createElement('div');
    taskIdDiv.style.display = 'flex';
    taskIdDiv.style.alignItems = 'center';   // vertikal mittig
    taskIdDiv.style.gap = '8px'; 
    const taskTitle = document.createElement('p');
    taskTitle.textContent = p.task.title;
    taskIdDiv.appendChild(taskTitle);
    const select = document.createElement('select');
    for (const stateKey of Object.keys(STATE_LABELS)) {
    const opt = document.createElement('option');
    opt.value = stateKey;
    opt.textContent = STATE_LABELS[stateKey];
    let comp:string;
    switch (p!.task.state) {
      case 0:
        comp = 'todo';
        break;
      case 1:
        comp = 'inprogress'
        break;
      case 2:
        comp = 'done'
        break;

      default:
        break;
    }
    // falls du schon einen aktuellen state hast, markiere
    if (stateKey === comp) {
      
      opt.selected = true;
    }
    select.appendChild(opt);
  }

  select.addEventListener('change', (e) => {
    window.electronAPI.send('change-project-task-state', p.task.taskUUID, select.value);
  });

    taskIdDiv.appendChild(select);
    for(let i = 0; i < p.bools.length; i++){ //TODO: Namen besser anzeigen.
      console.log("p.bools.length     HHHHHHHHHHHHHHHHHHHHH::::    " + p.bools.length);//Wieso nur 1?
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = p.bools[i];
      checkbox.id = i.toString();
      console.log(projectView.members[i]);
      console.log("taskUUID.     HHHHHHHHHHHHHHHHHHHHH::::    " + projectView.taskViews[i].task.taskUUID);
      checkbox.addEventListener('change', () => {
        p.bools[i] = checkbox.checked;
        
        window.electronAPI.send('change-assignees', p.bools[i], p.task.taskUUID, projectView.members[i].uuid);
      })
      const labelElement = document.createElement("label");
      labelElement.htmlFor = checkbox.id;
      labelElement.textContent = projectView.members[i].displayName;
      taskIdDiv.appendChild(checkbox);
      taskIdDiv.appendChild(labelElement);
    }
    
    listitem.appendChild(taskIdDiv);
    projectViewList.appendChild(listitem);
    
  }
}

window.electronAPI.on('update-interface', (_, ip: string, port: number) => {
  ipInput.value = ip;
  portInput.value = port.toString();
})

const projectNotification = document.getElementById('project-notification-div');
const notificationText = document.getElementById('project-notification-text')
const addButton = document.getElementById('project-notification-add-btn');
const ignoreButton = document.getElementById('project-notification-ignore-btn');
function showNotification(projectPreview: ProjectPreview, rinfo: MessageInfo) {
  projectNotification.style.display = "block";
  notificationText.innerHTML = 'Project <b>' + projectPreview.projectTitle + '</b> is in network (ID: ' +projectPreview.projectID + ')'
  addButton.addEventListener('click', () => {
    window.electronAPI.send('add-project', projectPreview);
    projectNotification.style.display = "none";
  })
  ignoreButton.addEventListener('click', () => {
    window.electronAPI.send('ignore-project', projectPreview);
    projectNotification.style.display = "none";
  })
  projectNotification.appendChild(addButton);
  projectNotification.appendChild(ignoreButton);
}

const newProjectInput = document.getElementById('new-project-input');
newProjectInput.addEventListener('keypress', (event) => {
  if (event.key === "Enter") {
    const projectTitle = newProjectInput.value;
    if (projectTitle.length < 4 || projectTitle.length > 20) {
      // TODO (if there is time) make this 'error' an element of the GUI
      console.log("project name must be between 4 and 20 characters long");
      return;
    }
    window.electronAPI.send('create-new-project', newProjectInput.value);
  }
})

const newTaskInput = document.getElementById('new-task-input');
newTaskInput.addEventListener('keypress', (event) => {
  if (event.key === "Enter") {
    const taskTitle = newTaskInput.value;
    if (taskTitle.length < 4 || taskTitle.length > 20) {
      // TODO (if there is time) make this 'error' an element of the GUI
      console.log("project name must be between 4 and 20 characters long");
      return;
    }
    window.electronAPI.send('create-new-task', newTaskInput.value);
  }
})

window.electronAPI.on('new-project-in-network', (_, preview: ProjectPreview, rinfo: MessageInfo) => {
  showNotification(preview, rinfo);
})

// Beispiel 1: renderer.ts -> index.ts:
const leaveProjectButton = document.getElementById('leave-project-btn');
leaveProjectButton.addEventListener('click', () => {
  window.electronAPI.send('leave-project');
})

// Beispiel 2:
/*const taskStateDropDown = document.getElementById('task-state-selection');
taskStateDropDown.addEventListener('change', () => {
  window.electronAPI.send('change-project-task-state', "<task-uuid>", taskStateDropDown.value);
})*/

// Beispiel 3:
/*window.electronAPI.on('update-project-view', project: ProjectView) {
  console.log("rendering view", project);
  // TODO
}*/
