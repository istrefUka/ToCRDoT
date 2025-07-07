import type { uuid, LogEntry, Person, AppendOnlyLog, Operation } from "./append_only_log";
import {v4 as uuidv4} from 'uuid';

export class CausalSet<T> {
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

  remove(x: T): void {
    const val = this.s.get(x) ?? 0;
    if (val % 2 === 0) {
      console.log(`remove: value ${x} already removed`);
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


export class Project { 
    projectUUID: uuid;
    creator: uuid;
    members: CausalSet<Person>;
    tasks: GrowOnlySet<Task>;
    title: string;

    constructor(projectUUID: uuid, creator: uuid,  members: CausalSet<Person>, tasks: GrowOnlySet<Task>, title: string){
        this.projectUUID = projectUUID;
        this.creator = creator;
        this.members = members;
        this.tasks = tasks;
        this.title = title;
      }
}

// state: 0 = not started, 1 = in Progress, 2 = done
export class Task {
    taskUUID: uuid;
    state: number;
    title: string;
    description: string;
    stateCounter: number = 0;
    constructor(taskUUID: uuid, state: number, title: string, description: string){
        this.taskUUID = taskUUID;
        this.state = state;
        this.title = title;
        this.description = description;
      }
    changeState(newState:number):void {
        this.stateCounter = this.stateCounter + this.state + (newState - this.state) + 3;
        this.state = this.stateCounter % 3;
    }
}


export class CRDT{
    private projects = new Map<uuid, Project>();

  createProject(projectUUID: uuid, personUUID: uuid, title: string, append_only_log: AppendOnlyLog): Project {
  let members = new CausalSet<Person>();
  let tasks   = new GrowOnlySet<Task>();
  let project = new Project(projectUUID, personUUID, members, tasks, title);
  this.projects.set(project.projectUUID, project);
  let operation:Operation = {command: "createProject", args: [ projectUUID, personUUID, title ]};
  let dependencies: uuid[] = [];
  append_only_log.add_operation(personUUID, operation, dependencies, projectUUID);
  return project;
}




addMember(creatorId: uuid, projectId: uuid, displayName: string, personUUID: uuid, append_only_log: AppendOnlyLog): void {
    let project = this.projects.get(projectId);
    if (!project) throw new Error(`Projekt ${projectId} nicht gefunden`);
    let newMember: Person = {displayName: displayName,  uuid: personUUID,};
    project.members.add(newMember);
    let operation:Operation = {command: "addMember", args: [creatorId, projectId, displayName, personUUID]}; //TODO: Lösung finden, um Person zu übergeben.
    let dependencies : uuid[] = [projectId];
    append_only_log.add_operation(creatorId, operation, dependencies, personUUID);
  }

changeName(projectId: uuid, personUuid: uuid, newName: string, append_only_log: AppendOnlyLog): void {
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

    // 2) Entferne die alte Version und füge die neue mit geändertem Namen hinzu
    project.members.remove(oldPerson);
    let updatedPerson: Person = {
      uuid: personUuid,
      displayName: newName,
    };
    project.members.add(updatedPerson);

    // 3) Operation fürs Log bauen
    let operation: Operation = {
      command: "changeName",
      args: [projectId, personUuid, newName],
    };

    // 4) Abhängigkeiten – hier einfach das Projekt selbst
    let dependencies: uuid[] = [projectId];

    // 5) Neuen Log-Eintrag mit frischer entryID
    const entryID: uuid = uuidv4();
    append_only_log.add_operation(
      personUuid,
      operation,
      dependencies,
      entryID
    );
  }


  
  createTask(projectUUID:uuid, taskUUID: uuid, personUUID: uuid, displayName: string, title: string, description: string, append_only_log: AppendOnlyLog): Task{
    let project = this.projects.get(projectUUID);
    if (!project) {
      throw new Error(`Projekt ${projectUUID} nicht gefunden`);
    }
    let taskState: number = 0;
    let task = new Task(taskUUID,taskState, title, description);
    project!.tasks.add(task);
    let operation: Operation = {
      command: "createTask",
      args: [projectUUID, personUUID, displayName, title, description],
    };
    let dependencies: uuid[] = [projectUUID];

    append_only_log.add_operation(personUUID, operation, dependencies, taskUUID)
    return task;
  }

  setTaskState(personUUID: uuid, projectUUID:uuid, taskUUID: uuid, newTaskState: number, append_only_log: AppendOnlyLog): void{
    let project = this.projects.get(projectUUID);
    if (!project) {
      throw new Error(`Projekt ${projectUUID} nicht gefunden`);
    }
    if(newTaskState > 2){
        throw new Error(`invalider Taskstate`);
    }
     // 1) Pull out the live set of tasks
    let tasks = project.tasks.get_set();

  // 2) Find the one with our ID
    let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
    if (!task) throw new Error(`Task ${taskUUID} nicht gefunden`);

    // 3) Change its state
    task.changeState(newTaskState);

    let operation: Operation = {
      command: "createTask",
      args: [personUUID, projectUUID, taskUUID, newTaskState.toString()],
    };
    let dependencies: uuid[] = [projectUUID, taskUUID];
    //add_operation(creator: uuid, operation: Operation, dependencies: uuid[], entryID: uuid)
    append_only_log.add_operation(personUUID, operation, dependencies, taskUUID)    
  }



  
  
    
}
