import './index.css';
import { ProjectView } from './Project';
import leaveButtonImage from "./../../assets/leave-button.png";
import gotoProjectButtonImage from "./../../assets/goto-project-button.png";
import addProjectButtonImage from "./../../assets/add-project-button.png";
import ignoreProjectButtonImage from "./../../assets/ignore-project-button.png";

function switchScene(id: Scene) {
  document.querySelectorAll<HTMLElement>('.scene')
    .forEach(el => el.classList.add('is-hidden'));

  document.querySelectorAll<HTMLElement>('.' + id)
    .forEach(el => el.classList.remove('is-hidden'));
}

const loginInput = document.getElementById('login-input');
loginInput?.addEventListener('keypress', (event) => {
  if (event.key === "Enter") {
    const username = loginInput.value;
    window.electronAPI.send('login-submit', username);
  }
});

window.electronAPI.on('switch-scene', (_, scene: Scene) => {
  switchScene(scene);
});

window.electronAPI.on('set-project-title', (_, projectTitle: string) => {
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
  projectPreviewList.innerHTML = '';

  for (const p of projects) {
    const listitem = document.createElement('li');
    listitem.classList.add('list-item');

    const projIdDiv = document.createElement('div');
    projIdDiv.style.display = 'flex';
    projIdDiv.style.alignItems = 'center';
    projIdDiv.style.gap = '10px';

    const projectButton = document.createElement('button');
    projectButton.classList.add('enter-button');

    const img = document.createElement('img');
    img.src = gotoProjectButtonImage;
    img.alt = 'enter project';

    projectButton?.appendChild(img);
    projectButton.addEventListener('click', () => {
      window.electronAPI.send('open-project', p.projectID, p.projectTitle);
    });

    const text = document.createElement('p');
    text.textContent = p.projectTitle;
    text.style.margin = '0';

    projIdDiv.appendChild(projectButton);
    projIdDiv.appendChild(text);
    listitem.appendChild(projIdDiv);
    projectPreviewList.appendChild(listitem);
  }
}

window.electronAPI.on('update-project-preview', (_, projects: ProjectPreview[]) => { updateProjectPreview(projects); })

window.electronAPI.on('update-project-view', (_, projectView: ProjectView) => { updateProjectView(projectView); })

const STATE_LABELS: Record<string, string> = {
  todo: 'To Do',
  inprogress: 'In Progress',
  done: 'Done',
};


const projectViewList = document.getElementById('project-view-list');


function updateProjectView(projectView: ProjectView) { 
  projectViewList.innerHTML = ''; 
  for (const p of projectView.taskViews) { 
    const listitem = document.createElement('li');
    listitem.classList.add('list-item');

    const taskIdDiv = document.createElement('div');
    taskIdDiv.style.display = 'flex';
    taskIdDiv.style.alignItems = 'center'; 
    taskIdDiv.style.gap = '8px';
    const taskTitle = document.createElement('p');
    taskTitle.textContent = p.task.title;
    taskIdDiv.appendChild(taskTitle);
    const select = document.createElement('select');
    for (const stateKey of Object.keys(STATE_LABELS)) {
      const opt = document.createElement('option');
      opt.value = stateKey;
      opt.textContent = STATE_LABELS[stateKey];
      let comp: string;
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
      if (stateKey === comp) {

        opt.selected = true;
      }
      select.appendChild(opt);
    }

    select.addEventListener('change', (e) => {
      window.electronAPI.send('change-project-task-state', p.task.taskUUID, select.value);
    });

    taskIdDiv.appendChild(select);
    for (let i = 0; i < p.bools.length; i++) { 

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = p.bools[i];
      checkbox.id = i.toString();

      checkbox.addEventListener('change', () => {
        p.bools[i] = checkbox.checked;

        window.electronAPI.send('change-assignees', p.bools[i], p.task.taskUUID, projectView.members[i].uuid);
      })
      const labelElement = document.createElement("label");
      labelElement.htmlFor = checkbox.id;
      labelElement.textContent = projectView.members[i].displayName;
      const divCheckboxNamed = document.createElement('div');
      divCheckboxNamed.style.display = 'flex';
      divCheckboxNamed.style.flexDirection = 'column';
      divCheckboxNamed.appendChild(labelElement);
      divCheckboxNamed.appendChild(checkbox);
      taskIdDiv.appendChild(divCheckboxNamed);
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

let addButtonEvent: () => void = null;
let ignoreButtonEvent: () => void = null;

function showNotification(projectPreview: ProjectPreview, rinfo: MessageInfo) {
  if (addButtonEvent != null) {
    addButton.removeEventListener('click', addButtonEvent);
  }
  if (ignoreButtonEvent != null) {
    ignoreButton.removeEventListener('click', ignoreButtonEvent);
  }
  projectNotification.style.display = "block";
  notificationText.innerHTML = 'Project <b>' + projectPreview.projectTitle + '</b> is in network (ID: ' + projectPreview.projectID + ')';
  addButtonEvent = () => {
    window.electronAPI.send('add-project', projectPreview);
    projectNotification.style.display = "none";
  };
  addButton.addEventListener('click', addButtonEvent);
  ignoreButtonEvent = () => {
    window.electronAPI.send('ignore-project', projectPreview);
    projectNotification.style.display = "none";
  };
  ignoreButton.addEventListener('click', ignoreButtonEvent);
  projectNotification.appendChild(addButton);
  projectNotification.appendChild(ignoreButton);
}

const newProjectInput = document.getElementById('new-project-input');
newProjectInput.addEventListener('keypress', (event) => {
  if (event.key === "Enter") {
    const projectTitle = newProjectInput.value;
    window.electronAPI.send('create-new-project', newProjectInput.value);
    newProjectInput.value = '';
  }
})

const newTaskInput = document.getElementById('new-task-input');
newTaskInput.addEventListener('keypress', (event) => {
  if (event.key === "Enter") {
    const taskTitle = newTaskInput.value;
    window.electronAPI.send('create-new-task', newTaskInput.value);
    newTaskInput.value = '';
  }
})

window.electronAPI.on('new-project-in-network', (_, preview: ProjectPreview, rinfo: MessageInfo) => {
  showNotification(preview, rinfo);
})

const leaveProjectButton = document.getElementById('leave-project-btn');
leaveProjectButton.addEventListener('click', () => {
  window.electronAPI.send('leave-project');
})

const changeNameInput = document.getElementById('change-name-input');
changeNameInput?.addEventListener('keypress', (event) => {
  if (event.key === "Enter") {
    const usernameInput = changeNameInput.value;
    window.electronAPI.send('change-username-submit', usernameInput);
    changeNameInput.value = '';
  }
});

const leaveButton = document.getElementById('leave-project-btn');
const img1 = document.createElement('img');
img1.src = leaveButtonImage;
img1.alt = 'leave project';
leaveButton?.appendChild(img1);

const addProjectButton = document.getElementById('project-notification-add-btn');
const img2 = document.createElement('img');
img2.src = addProjectButtonImage;
img2.alt = 'add project';
addProjectButton?.appendChild(img2);

const ignoreProjectButton = document.getElementById('project-notification-ignore-btn');
const img3 = document.createElement('img');
img3.src = ignoreProjectButtonImage;
img3.alt = 'ignore project';
ignoreProjectButton?.appendChild(img3);