import path from "path";
import * as fs from 'node:fs'
import { uuid, LogEntry, Person, AppendOnlyLog, Operation } from "./append_only_log";
import { v4 as uuidv4 } from 'uuid';
import { skip } from "node:test";
import { WebContents } from 'electron';

export class CausalSet<T> {
  private s: Map<T, number>;

  constructor() {
    this.s = new Map<T, number>();
  }

  add(x: T): number {

    const val = this.s.get(x) ?? 0;
    if (val % 2 === 1) {
      return val;
    }
    this.s.set(x, val + 1);
    return val + 1;
  }

  addAOL(x: T, value: number): void {

    const val = this.s.get(x) ?? 0;
    if (val % 2 === 1) {
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
      (`remove: value ${x} already removed`);
      return val;
    }
    this.s.set(x, val + 1);
    return val + 1;
  }

  removeAOL(x: T, value: number): void {

    const val = this.s.get(x) ?? 0;
    if (val % 2 === 0) {
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
  }

  print(): void {
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
  private s: T[] = [];

  add(x: T): void {
    this.s.push(x);
  }

  get_Array(): T[] {
    return this.s;
  }
}

//TODO: Notification for all Methods to GUI to let the GUI redraw it.
//TODO: 2 Methoden pro Operation, da wo es Sinn macht.
//TODO: ADD and REMOVE ASSIGNEE methods
//TODO: update Methode
//TODO: boolean statt AOL übergeben

export type TaskView = {
  task: Task,
  bools: boolean[]
}

export type ProjectView = {
  taskViews: TaskView[],
  members: Person[]
}





export class Project {
  append_only_log: AppendOnlyLog;
  projectUUID: uuid;
  creator: uuid | undefined; //Gute Lösung? Alternative wäre nur anfänglicher Kostruktor und mit init methode.
  members: GrowOnlySet<Person>;
  tasks: GrowOnlySet<Task>; // In Array umwandeln, vlt besser
  title: string;

  /**
   * AOL muss geladen sein bevor er dieser Methode übergeben wird. Init bei neu kreiertem Projekt, sonst charge.
   * @param projectUUID 
   * @param title 
   * @param append_only_log 
   */
  constructor(projectUUID: uuid, title: string, append_only_log: AppendOnlyLog) {
    //The method init needs to be called manually if we enter this method
    this.append_only_log = append_only_log;
    this.projectUUID = projectUUID;
    this.title = title;
    this.members = new GrowOnlySet<Person>();
    this.tasks = new GrowOnlySet<Task>();
  }

  init(creator: uuid, displayNameCreator: string, writeToAOL: boolean) {
    this.creator = creator;
    if (writeToAOL) {
      const operation: Operation = {
        command: "init",
        args: [creator, displayNameCreator]
      };

      const dependencies: uuid[] = [];
      this.append_only_log.add_operation(creator, operation, dependencies, this.projectUUID);
      this.addMember(creator, displayNameCreator, creator, true);
    }
  }

  save() {
    this.append_only_log.save();
  }

  charge() {
    const ops = this.append_only_log.query_missing_operations_ordered(new Map());
    console.log(ops);
    this.update(ops);
  }

  update(ops: Operation[], web?: WebContents) { //TODO: GUI-updaten nach dieser Operation
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      switch (op.command) {
        case "init":
          this.init(op.args[0], op.args[1], false);
          if(web){
            web.send('update-project-view', this.getProjectView());
          }
          break;
        case "changeName":
          this.changeName(op.args[0], op.args[1], false);
          if(web){
            web.send('update-project-view', this.getProjectView());
          }
          break;
        case "addMember":
          this.addMember(op.args[0], op.args[1], op.args[2], false);
          if(web){
            web.send('update-project-view', this.getProjectView());
          }
          break;
        case "createTask":
          console.log("Creating Task");
          this.createTask(op.args[0], op.args[1], op.args[2], false);
          if(web){
            web.send('update-project-view', this.getProjectView());
          }
          break;
        case "setTaskStateAOL":
          this.setTaskStateAOL(op.args[0], Number(op.args[1]));
          if(web){
            web.send('update-project-view', this.getProjectView());
          }
          break;
        case "addTaskAssigneeAOL":
          this.addTaskAssigneeAOL(op.args[0], op.args[1], Number(op.args[2]));
          if(web){
            web.send('update-project-view', this.getProjectView());
          }
          break;

        case "removeTaskAssigneeAOL":
          this.removeTaskAssigneeAOL(op.args[0], op.args[1], Number(op.args[2]));
          if(web){
            web.send('update-project-view', this.getProjectView());
          }
          break;


        default:
          throw (new Error("LogEntry with wrong command: " + op.command));
      }
    }
  }

  changeName(personUuid: uuid, newName: string, writeToAOL: boolean): void {
    const currentMembers = this.members.get_Array();
    const oldPerson = [...currentMembers].find(p => p.uuid === personUuid);
    if (!oldPerson) {
      throw new Error(`Person ${personUuid} nicht in Projekt ${this.title}`);
    }
    oldPerson.displayName = newName;

    if (!writeToAOL) {
      return;
    }
    const operation: Operation = {
      command: "changeName",
      args: [personUuid, newName]
    };
    const entryID = uuidv4();

    const dependencies: uuid[] = [personUuid]; //Welches nehmen? oder beide?
    this.append_only_log.add_operation(personUuid, operation, dependencies, entryID); //Welche entryID? Ist es Oke newName auch mitzugeben, seitdem auch
  }

  createTask(taskUUID: uuid, personUUID: uuid, title: string, writeToAOL: boolean): Task { //TODO: Description wahscheinlich wegnehmen.
    console.log("createTask activated");
    const taskState = 0;
    const task = new Task(taskUUID, taskState, title, personUUID);
    this.tasks.add(task);

    if (!writeToAOL) {
      return task;
    }
    const operation: Operation = {
      command: "createTask",
      args: [taskUUID, personUUID, title],
    };
    const dependencies: uuid[] = [this.projectUUID];
    this.append_only_log!.add_operation(personUUID, operation, dependencies, taskUUID)
    return task;
  }

  addMember(creatorId: uuid, displayName: string, personUUID: uuid, writeToAOL: boolean): void { //TODO: Add Event notification for the GUI to tell it that there has been a member added.
    const newMember: Person = { displayName: displayName, uuid: personUUID };
    this.members.add(newMember);

    if (!writeToAOL) {
      return;
    }
    const operation: Operation = { command: "addMember", args: [creatorId, displayName, personUUID] }; //TODO: Lösung finden, um Person zu übergeben.
    const dependencies: uuid[] = [this.projectUUID];
    this.append_only_log.add_operation(creatorId, operation, dependencies, personUUID);
  }

  setTaskStateAOL(taskUUID: uuid, newTaskState: number): void {
    let task = null;
    console.log("Set: " + this.tasks.get_Array());
    for (const t of this.tasks.get_Array()) {
      if (t.taskUUID === taskUUID) {
        task = t;
        break;
      }
    }
    if (!task) {
      console.warn(`Task ${taskUUID} nicht gefunden`);
    }
    task.changeState(newTaskState);
  }

  setTaskStateGUI(personUUID: uuid, taskUUID: uuid, newTaskState: string): void {
    console.log("Set: " + this.tasks.get_Array());
    let task = null;
    for (const t of this.tasks.get_Array()) {
      if (t.taskUUID === taskUUID) {
        task = t;
        break;
      }
    }
    if (!task) {
      console.warn(`Task ${taskUUID} nicht gefunden`);
    }
    task.changeStateGUI(newTaskState);
    const operation: Operation = {
      command: "setTaskStateAOL",
      args: [taskUUID, task.get_State_Counter().toString()] //Anpassen!!!
    };
    const dependencies: uuid[] = [taskUUID];
    const entryID = uuidv4();

    this.append_only_log.add_operation(personUUID, operation, dependencies, entryID);   //TODO: Gute EntryID finden, Nur Task als dependency oder gerade alles?
  }
  addTaskAssigneeGUI(creatorID: uuid, taskUUID: uuid, personUUID: uuid) {
    console.log("Set: " + this.tasks.get_Array());
    let task = null;
    for (const t of this.tasks.get_Array()) {
      if (t.taskUUID === taskUUID) {
        task = t;
        break;
      }
    }
    if (!task) {
      console.warn(`Task ${taskUUID} nicht gefunden`);
    }
    const val = task.assignees.add(personUUID);
    (val);
    const operation: Operation = {
      command: "addTaskAssigneeAOL",
      args: [taskUUID, personUUID, val.toString()]
    };
    const dependencies: uuid[] = [taskUUID];
    const entryID = uuidv4();

    this.append_only_log.add_operation(creatorID, operation, dependencies, entryID);
  }
  addTaskAssigneeAOL(taskUUID: uuid, personUUID: uuid, value: number) {
    console.log("Set: " + this.tasks.get_Array());
    let task = null;
    for (const t of this.tasks.get_Array()) {
      if (t.taskUUID === taskUUID) {
        task = t;
        break;
      }
    }
    if (!task) {
      console.warn(`Task ${taskUUID} nicht gefunden`);
    }
    task.assignees.addAOL(personUUID, value);
  }
  removeTaskAssigneeGUI(creatorID: uuid, taskUUID: uuid, personUUID: uuid) {
    console.log("Set: " + this.tasks.get_Array());
    let task = null;
    for (const t of this.tasks.get_Array()) {
      if (t.taskUUID === taskUUID) {
        task = t;
        break;
      }
    }
    if (!task) {
      console.warn(`Task ${taskUUID} nicht gefunden`);
    }
    const val = task.assignees.remove(personUUID);
    const operation: Operation = {
      command: "removeTaskAssigneeAOL",
      args: [taskUUID, personUUID, val.toString()]
    };
    const dependencies: uuid[] = [taskUUID];
    const entryID = uuidv4();

    this.append_only_log.add_operation(creatorID, operation, dependencies, entryID);
  }
  removeTaskAssigneeAOL(taskUUID: uuid, personUUID: uuid, value: number) {
    let task = null;
    for (const t of this.tasks.get_Array()) {
      if (t.taskUUID === taskUUID) {
        task = t;
        break;
      }
    }
    if (!task) {
      console.warn(`Task ${taskUUID} nicht gefunden`);
    }
    task.assignees.removeAOL(personUUID, value);
  }

  getOrderedMembers(): Person[] {
    const arr = Array.from(this.members.get_Array());
    arr.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return arr;
  }
  getProjectView(): ProjectView { //TODO
    let output: TaskView[] = [];
    let persons = this.getOrderedMembers();
    for (const task of this.tasks.get_Array()) {
      output.push(task.getTaskView(persons));
    }
    let projectView: ProjectView = { taskViews: output, members: persons };
    ("Amount of taskkkkkskskskskskskks " + projectView.taskViews.length);
    return projectView;
  }


}

export function loadProject(projectUUID: uuid, append_only_log: AppendOnlyLog, projects_path: string): Project {
  const file = projects_path + projectUUID + '/project-title.txt';
  if (!fs.existsSync(file)) {
    throw new Error('could not load project: file doesnt exist');
  }
  const title = fs.readFileSync(file).toString('utf-8');
  return new Project(projectUUID, title, append_only_log);
}

// state: 0 = not started, 1 = in Progress, 2 = done
export class Task {//TODO: assignees hinzufügen, CausalSet
  taskUUID: uuid;
  state: number;
  title: string;
  creator: uuid;
  stateCounter = 0;
  assignees: CausalSet<uuid>;
  constructor(taskUUID: uuid, state: number, title: string, creator: uuid) {
    this.taskUUID = taskUUID;
    this.state = state;
    this.title = title;
    this.assignees = new CausalSet<uuid>();
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
      case "todo":
        newerState = 0;
        (newState);
        break;
      case "inprogress":
        newerState = 1;
        (newState);
        break;
      case "done":
        newerState = 2;
        break;
      default:
        break;
    }
    ("newState ausserhalbe switch: " + newState);
    ("newer State" + newerState);
    this.stateCounter = newerState - this.state + this.stateCounter + 3;
    this.state = newerState;
  }
  getTaskView(persons: Person[]): TaskView { //TODO
    let bools: boolean[] = [];
    for (let i = 0; i < persons.length; i++) {
      let isAssigned = this.assignees.get_set().has(persons[i].uuid);
      bools.push(isAssigned);
    }
    return { task: this, bools: bools };
  }
  get_State_Counter(): number {
    return this.stateCounter;
  }
  get_state(): number {
    return this.state;
  }
}