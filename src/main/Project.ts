import path from "path";
import * as fs from 'node:fs'
import { uuid, LogEntry, Person, AppendOnlyLog, Operation } from "./append_only_log";
import { v4 as uuidv4 } from 'uuid';

export class CausalSet<T> {
  private s: Map<T, number>;

  constructor() {
    this.s = new Map<T, number>();
  }

  add(x: T): number {

    const val = this.s.get(x) ?? 0;
    if (val % 2 === 1) {
      console.log(`add: value ${x} already in set`);
      return val;
    }
    this.s.set(x, val + 1);
    return val;
  }

  addAOL(x: T, value: number): void {

    const val = this.s.get(x) ?? 0;
    if (val % 2 === 1) {
      console.log(`add: value ${x} already in set`);
      return;
    }
    if (val >= value) {
      return;
    }

    this.s.set(x, value);
    return;
  }

  remove(x: T): number {
    const val = this.s.get(x) ?? 0;
    if (val % 2 === 0) {
      console.log(`remove: value ${x} already removed`);
      return val;
    }
    this.s.set(x, val + 1);
    return val;
  }

  removeAOL(x: T, value: number): void {

    const val = this.s.get(x) ?? 0;
    if (val % 2 === 0) {
      console.log(`remove: value ${x} already removed`);
      return;
    }
    if (val >= value) {
      return;
    }

    this.s.set(x, value);
    return;
  }


  get_set(): Set<T> {
    const output = new Set<T>();
    for (const [key, value] of this.s) {
      if (value % 2 === 1) {
        output.add(key);
      }
    }
    return output;
  }

  debug(): void {
    console.log(this.s);
  }

  print(): void {
    console.log(this.get_set());
  }

  /**
   * Merges in any higher “timestamps” from another causal set.
   */
  merge(other: CausalSet<T>): void {
    // First, update existing keys if other has a bigger counter
    for (const [key, value] of this.s) {
      const otherval = other.s.get(key) ?? 0;
      if (otherval > value) {
        this.s.set(key, otherval);
      }
    }
    // Then add any keys that we didn’t have at all
    for (const [key, value] of other.s) {
      if (!this.s.has(key)) {
        this.s.set(key, value);
      }
    }
  }

  toString(): string {
    const parts: string[] = ["CausalSet: {"];
    let first = true;
    for (const [key, value] of this.s) {
      if (!first) parts.push(", ");
      first = false;
      parts.push(String(key));
      if (value % 2 === 0) {
        parts.push(": REMOVED");
      }
    }
    parts.push("}");
    return parts.join("");
  }
}


export class GrowOnlySet<T> {
  private s: Map<T, number>;

  constructor() {
    this.s = new Map<T, number>();
  }

  add(x: T): void {
    const val = this.s.get(x) ?? 0;
    if (val % 2 === 1) {
      console.log(`add: value ${x} already in set`);
      return;
    }
    this.s.set(x, val + 1);
  }

  get_set(): Set<T> {
    const output = new Set<T>();
    for (const [key, value] of this.s) {
      if (value % 2 === 1) {
        output.add(key);
      }
    }
    return output;
  }

  debug(): void {
    console.log(this.s);
  }

  print(): void {
    console.log(this.get_set());
  }

  /**
   * Merges in any higher “timestamps” from another causal set.
   */
  merge(other: GrowOnlySet<T>): void {
    // First, update existing keys if other has a bigger counter
    for (const [key, value] of this.s) {
      const otherval = other.s.get(key) ?? 0;
      if (otherval > value) {
        this.s.set(key, otherval);
      }
    }
    // Then add any keys that we didn’t have at all
    for (const [key, value] of other.s) {
      if (!this.s.has(key)) {
        this.s.set(key, value);
      }
    }
  }

  toString(): string {
    const parts: string[] = ["CausalSet: {"];
    let first = true;
    for (const [key, value] of this.s) {
      if (!first) parts.push(", ");
      first = false;
      parts.push(String(key));
      if (value % 2 === 0) {
        parts.push(": REMOVED");
      }
    }
    parts.push("}");
    return parts.join("");
  }
}

//TODO: Notification for all Methods to GUI to let the GUI redraw it.
//TODO: 2 Methoden pro Operation, da wo es Sinn macht.
//TODO: ADD and REMOVE ASSIGNEE methods
//TODO: update Methode
//TODO: boolean statt AOL übergeben
export class Project {
  append_only_log: AppendOnlyLog;
  projectUUID: uuid;
  creator: uuid = uuidv4(); //Gute Lösung? Alternative wäre nur anfänglicher Kostruktor und mit init methode.
  members: GrowOnlySet<Person>;
  tasks: GrowOnlySet<Task>;
  title: string;

  /**
   * AOL muss geladen sein bevor er dieser Methode übergeben wird.
   * @param projectUUID 
   * @param title 
   * @param append_only_log 
   */
  constructor(projectUUID: uuid, title: string, append_only_log: AppendOnlyLog, projects_path: string) {
    //The method init needs to be called manually if we enter this method
    this.append_only_log = append_only_log;
    this.projectUUID = projectUUID;
    this.title = title;
    this.members = new GrowOnlySet<Person>;
    this.tasks = new GrowOnlySet<Task>;
    const dir = path.dirname(projects_path) + projectUUID + '/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dir + 'project-title.txt', this.title);
  }

  init(creator: uuid, displayNameCreator: string, writeToAOL: boolean) {
    this.creator = creator;
    if (writeToAOL) {
      let operation: Operation = {
        command: "init",
        args: [creator, displayNameCreator]
      };

      let dependencies: uuid[] = [];
      this.append_only_log.add_operation(creator, operation, dependencies, this.projectUUID);
    }
    this.addMember(creator, displayNameCreator, creator, this.append_only_log);
  }

  save(path: string) {
    this.append_only_log.save();
  }

  charge() { //TODO: Macht das Sinn?
    const ops = this.append_only_log.query_missing_operations_ordered(new Map());
    this.update(ops);
  }

  /*export class LogEntry {
  creator: uuid;
  id: uuid;
  operation: Operation;
  index: number;
  dependencies: uuid[];*/

  update(ops: Operation[]) { //TODO: Auf Operation statt LogEntry wechseln
    for (let i = 0; i < ops.length; i++) {
      let op = ops[i];
      switch (op.command) {
        case "init":
          this.init(op.args[0], op.args[1], false);
          break;
        case "changeName":
          this.changeName(op.args[0], op.args[1]);
          break;
        case "addMember":
          this.addMember(op.args[0], op.args[1], op.args[2]);
          break;
        case "createTask":
          this.createTask(op.args[0], op.args[1], op.args[2], op.args[3]);
          // Noch SetTaskState methode fehlt.
          break;
        case "createTask":
          this.setTaskStateAOL(op.args[0], Number(op.args[1]));
          break;
        case "setTaskStateAOL":
          this.setTaskStateAOL(op.args[0], Number(op.args[1]));
          break;
        case "addTaskAssigneeAOL":
          this.addTaskAssigneeAOL(op.args[0], op.args[1], op.args[2], Number(op.args[3]));
          break;

        case "removeTaskAssigneeAOL":
          this.removeTaskAssigneeAOL(op.args[0], op.args[1], op.args[2], Number(op.args[3]));
          break;


        default:
          throw (new Error("LogEntry with wrong command: " + op.command));
      }
    }
  }

  changeName(personUuid: uuid, newName: string, append_only_log?: AppendOnlyLog): void {
    const currentMembers = this.members.get_set();
    const oldPerson = [...currentMembers].find(p => p.uuid === personUuid);
    if (!oldPerson) {
      throw new Error(`Person ${personUuid} nicht in Projekt ${this.title}`);
    }
    oldPerson.displayName = newName;

    if (!append_only_log) {
      return;
    }
    let operation: Operation = {
      command: "changeName",
      args: [personUuid, newName]
    };
    let entryID = uuidv4();

    let dependencies: uuid[] = [personUuid]; //Welches nehmen? oder beide?
    append_only_log.add_operation(personUuid, operation, dependencies, entryID); //Welche entryID? Ist es Oke newName auch mitzugeben, seitdem auch
  }

  createTask(taskUUID: uuid, personUUID: uuid, title: string, description: string, append_only_log?: AppendOnlyLog): Task { //TODO: Description wahscheinlich wegnehmen.

    let taskState: number = 0;
    let task = new Task(taskUUID, taskState, title, description, personUUID);
    this.tasks.add(task);

    if (!append_only_log) {
      return task;
    }
    let operation: Operation = {
      command: "createTask",
      args: [personUUID, title, description],
    };
    let dependencies: uuid[] = [this.projectUUID];
    append_only_log!.add_operation(personUUID, operation, dependencies, taskUUID)
    return task;
  }

  addMember(creatorId: uuid, displayName: string, personUUID: uuid, append_only_log?: AppendOnlyLog): void { //TODO: Add Event notification for the GUI to tell it that there has been a member added.
    let newMember: Person = { displayName: displayName, uuid: personUUID };
    this.members.add(newMember);

    if (!append_only_log) {
      return;
    }
    let operation: Operation = { command: "addMember", args: [creatorId, displayName, personUUID] }; //TODO: Lösung finden, um Person zu übergeben.
    let dependencies: uuid[] = [this.projectUUID];
    append_only_log.add_operation(creatorId, operation, dependencies, personUUID);
  }

  setTaskStateAOL(taskUUID: uuid, newTaskState: number): void {//ohne AppendOnly Log!
    let tasks = this.tasks.get_set();
    let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
    if (!task) throw new Error(`Task ${taskUUID} nicht gefunden`);
    task.changeState(newTaskState);
  }

  setTaskStateGUI(personUUID: uuid, projectUUID: uuid, taskUUID: uuid, newTaskState: string, append_only_log: AppendOnlyLog): void {
    // 1) Pull out the live set of tasks
    let tasks = this.tasks.get_set();
    let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
    if (!task) throw new Error(`Task ${taskUUID} nicht gefunden`);
    task.changeStateGUI(newTaskState);

    let operation: Operation = {
      command: "setTaskStateAOL",
      args: [taskUUID, task.get_State_Counter().toString()] //Anpassen!!!
    };
    let dependencies: uuid[] = [taskUUID];
    let entryID = uuidv4();

    append_only_log.add_operation(personUUID, operation, dependencies, entryID);   //TODO: Gute EntryID finden, Nur Task als dependency oder gerade alles?
  }
  addTaskAssigneeGUI(creatorID: uuid, taskUUID: uuid, personUUID: uuid, displayName: string) {
    let tasks = this.tasks.get_set();
    let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
    if (!task) throw new Error(`Task ${taskUUID} nicht gefunden`);
    let person: Person = { displayName: displayName, uuid: personUUID };
    let val = task.assignees.add(person);
    let operation: Operation = {
      command: "addTaskAssigneeAOL",
      args: [taskUUID, personUUID, displayName, val.toString()] //Anpassen!!!
    };
    let dependencies: uuid[] = [taskUUID];
    let entryID = uuidv4();

    this.append_only_log.add_operation(creatorID, operation, dependencies, entryID);
  }
  addTaskAssigneeAOL(taskUUID: uuid, personUUID: uuid, displayName: string, value: number) {
    let tasks = this.tasks.get_set();
    let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
    if (!task) throw new Error(`Task ${taskUUID} nicht gefunden`);
    let person: Person = { displayName: displayName, uuid: personUUID }
    task.assignees.addAOL(person, value);
  }
  removeTaskAssigneeGUI(creatorID: uuid, taskUUID: uuid, personUUID: uuid, displayName: string) {
    let tasks = this.tasks.get_set();
    let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
    if (!task) throw new Error(`Task ${taskUUID} nicht gefunden`);
    let person: Person = { displayName: displayName, uuid: personUUID };
    let val = task.assignees.remove(person);
    let operation: Operation = {
      command: "addTaskAssigneeAOL",
      args: [taskUUID, personUUID, displayName, val.toString()] //Anpassen!!!
    };
    let dependencies: uuid[] = [taskUUID];
    let entryID = uuidv4();

    this.append_only_log.add_operation(creatorID, operation, dependencies, entryID);
  }
  removeTaskAssigneeAOL(taskUUID: uuid, personUUID: uuid, displayName: string, value: number) {
    let tasks = this.tasks.get_set();
    let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
    if (!task) throw new Error(`Task ${taskUUID} nicht gefunden`);
    let person: Person = { displayName: displayName, uuid: personUUID }
    task.assignees.removeAOL(person, value);
  }
}

export function loadProject(projectUUID: uuid, append_only_log: AppendOnlyLog, projects_path: string): Project {
  const file = projects_path + projectUUID + '/project-title.txt';
  if (!fs.existsSync(file)) {
    throw new Error('could not load project: file doesnt exist');
  }
  const title = fs.readFileSync(file).toString('utf-8');
  return new Project(projectUUID, title, append_only_log, projects_path);
}

// state: 0 = not started, 1 = in Progress, 2 = done
export class Task {//TODO: assignees hinzufügen, CausalSet
  taskUUID: uuid;
  state: number;
  title: string;
  description: string;
  creator: uuid;
  stateCounter: number = 0;
  assignees: CausalSet<Person>;
  constructor(taskUUID: uuid, state: number, title: string, description: string, creator: uuid) {
    this.taskUUID = taskUUID;
    this.state = state;
    this.title = title;
    this.assignees = new CausalSet<Person>;
    this.description = description;
    this.creator = creator;
  }
  changeState(newState: number): void {
    if (this.stateCounter >= newState) {
      return;
    }
    this.stateCounter = newState;
    this.state = this.stateCounter % 3; //Die 3 steht für die Anzahl states.
  }
  changeStateGUI(newState: string) {
    let newerState = 0;
    switch (newState) {
      case "To Do":
        newerState = 0;
        break;
      case "in Progress":
        newerState = 1;
        break;
      case "done":
        newerState = 2;
        break;
      default:
        break;
    }
    this.stateCounter = newerState + this.stateCounter;
    this.state = newerState;
  }
  get_State_Counter(): number {
    return this.stateCounter;
  }
  get_state(): number {
    return this.state;
  }
}



/*export class CRDT { //TODO: remove operation
  projects = new Map<uuid, Project>();

  /*createProject(projectUUID: uuid, personUUID: uuid, displayName: string, title: string, append_only_log?: AppendOnlyLog): Project {
    let members = new CausalSet<Person>();
    let tasks = new GrowOnlySet<Task>();
    let project = new Project(projectUUID, personUUID, members, tasks, title);
    this.projects.set(project.projectUUID, project);
    let newMember: Person = { displayName: displayName, uuid: personUUID, };
    this.addMember(personUUID, projectUUID, displayName, personUUID, append_only_log); //ACHTUNG CreatorID und personUUID sind Gleich, mögliche Probleme?
    let operation: Operation = { command: "createProject", args: [projectUUID, personUUID, title] };
    let dependencies: uuid[] = [];
    if (!append_only_log) {
      return project;
    }
    append_only_log!.add_operation(personUUID, operation, dependencies, projectUUID);
    return project;
  }*/

/*getProjects(): Map<uuid, Project> {
  return this.projects;
}*/



/*addMember(creatorId: uuid, projectId: uuid, displayName: string, personUUID: uuid, append_only_log?: AppendOnlyLog): void { //TODO: Add Event notification for the GUI to tell it that there has been a member added.
  let project = this.projects.get(projectId);
  if (!project) throw new Error(`Projekt ${projectId} nicht gefunden`);
  let newMember: Person = { displayName: displayName, uuid: personUUID, };
  project.members.add(newMember);
  let operation: Operation = { command: "addMember", args: [creatorId, projectId, displayName, personUUID] }; //TODO: Lösung finden, um Person zu übergeben.
  let dependencies: uuid[] = [projectId];
  if (!append_only_log) {
    return;
  }
  append_only_log.add_operation(creatorId, operation, dependencies, personUUID);
}

changeName(projectId: uuid, personUuid: uuid, newName: string, append_only_log?: AppendOnlyLog): void {
  const project = this.projects.get(projectId);
  if (!project) {
    throw new Error(`Projekt ${projectId} nicht gefunden`);
  }

  // 1) Suche das Person-Objekt in members
  const currentMembers = project.members.get_set();
  const oldPerson = [...currentMembers].find(p => p.uuid === personUuid);
  if (!oldPerson) {
    throw new Error(`Person ${personUuid} nicht in Projekt ${projectId}`);
  }
  oldPerson.displayName = newName;

  // 2) Entferne die alte Version und füge die neue mit geändertem Namen hinzu

  // 3) Operation fürs Log bauen
  let operation: Operation = {
    command: "changeName",
    args: [projectId, personUuid, newName],
  };

  // 4) Abhängigkeiten – hier einfach das Projekt selbst
  let dependencies: uuid[] = [projectId, personUuid]; //Welches nehmen? oder beide?

  // 5) Neuen Log-Eintrag mit frischer entryID
  const entryID: uuid = uuidv4();
  if (!append_only_log) {
    return;
  }
  append_only_log.add_operation(personUuid, operation, dependencies, projectId + personUuid + newName); //Welche entryID? Ist es Oke newName auch mitzugeben, seitdem auch
}



createTask(projectUUID: uuid, taskUUID: uuid, personUUID: uuid, title: string, description: string, append_only_log?: AppendOnlyLog): Task {
  let project = this.projects.get(projectUUID);
  if (!project) {
    throw new Error(`Projekt ${projectUUID} nicht gefunden`);
  }
  let taskState: number = 0;
  let task = new Task(taskUUID, taskState, title, description);
  project!.tasks.add(task);
  let operation: Operation = {
    command: "createTask",
    args: [projectUUID, personUUID, title, description],
  };
  let dependencies: uuid[] = [projectUUID];
  if (!append_only_log) {
    return task;
  }
  append_only_log!.add_operation(personUUID, operation, dependencies, taskUUID)
  return task;
}

//Als eingabe bei TaskState wird stateCounter + neuer State erwartet.
setTaskState(personUUID: uuid, projectUUID: uuid, taskUUID: uuid, newTaskState: number, append_only_log?: AppendOnlyLog): void {
  let project = this.projects.get(projectUUID);
  if (!project) {
    throw new Error(`Projekt ${projectUUID} nicht gefunden`);
  }
  // 1) Pull out the live set of tasks
  let tasks = project.tasks.get_set();
  let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
  if (!task) throw new Error(`Task ${taskUUID} nicht gefunden`);
  task.changeState(newTaskState);

  let operation: Operation = {
    command: "setTaskState",
    args: [personUUID, projectUUID, taskUUID, newTaskState.toString()],
  };
  let dependencies: uuid[] = [taskUUID];
  if (!append_only_log) {
    return;
  }
  //add_operation(creator: uuid, operation: Operation, dependencies: uuid[], entryID: uuid)
  append_only_log.add_operation(personUUID, operation, dependencies, taskUUID + newTaskState.toString())   //TODO: Gute EntryID finden, Nur Task als dependency oder gerade alles?
}






}*/
