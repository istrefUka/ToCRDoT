import {v4 as uuidv4} from 'uuid';
import { uuid, LogEntry, Person, AppendOnlyLog, Operation } from "../main/append_only_log";
import * as fs from "fs"
import {Task, Project, GrowOnlySet, CausalSet } from "../main/Project"

describe("Project Tests", () => {
  /*it("test createProject", () => {
    //createProject(projectUUID: uuid, personUUID: uuid, title: string, append_only_log: AppendOnlyLog)
    let projectUUID = uuidv4();
    let personUUID = uuidv4();
    let title = "Project 1"
    let displayName = "Istref";
    let members = new CausalSet<Person>();
    let tasks   = new GrowOnlySet<Task>();
    let newMember2: Person = {displayName: displayName, uuid: personUUID};
    members.add(newMember2);
    let project1 = crdt.createProject(projectUUID, personUUID, displayName, title);
    let project2 = new Project(projectUUID, personUUID, members, tasks, title);
    expect(project1).toEqual(project2);
    //expect(log._search_entries(entry1)).toEqual(expected_search_res);
  });*/

  it("test addMember", () => {
    let projectUUID = uuidv4();
    let personUUID = uuidv4();
    let members = new GrowOnlySet<Person>();
    let displayName = "Istref";
    let title = "Project 1"
    let project = new Project(projectUUID, personUUID, displayName, title);
    let personNew = uuidv4();
    let newMember: Person = {displayName: displayName,  uuid: personNew,};
    let newMember2: Person = {displayName: displayName, uuid: personUUID};
    members.add(newMember);
    members.add(newMember2);
    project.addMember(personUUID,displayName, personNew);
    expect(project?.members).toEqual(members);
  });

  it("test changeName", () => {
    let projectUUID = uuidv4();
    let personUUID = uuidv4();
    let members = new GrowOnlySet<Person>();
    let displayName = "Istref";
    let title = "Project 1"
    let project = new Project(projectUUID, personUUID, displayName, title);
    let newMember2: Person = {displayName: displayName, uuid: personUUID};
    let newDisplayName = "KIKI";
    newMember2.displayName = newDisplayName;
    members.add(newMember2);
    project.changeName(personUUID, newDisplayName);
    expect(project?.members).toEqual(members);

    //changeName(projectId: uuid, personUuid: uuid, newName: string, append_only_log?: AppendOnlyLog)
  });

  it("test createTask", () => {
   let projectUUID = uuidv4();
    let personUUID = uuidv4();
    let taskUUID = uuidv4();
    let description = "Task 1";
    let displayName = "Istref";
    let title = "Project 1"
    let project = new Project(projectUUID, personUUID, displayName, title);
    let task = new Task(taskUUID, 0, title,description,personUUID);
    let task2 = project.createTask( taskUUID, personUUID, title, description);
    let tasks = project.tasks.get_set();
    let task3 = Array.from(tasks).find(t => t.taskUUID === taskUUID);
    expect(task).toEqual(task2);
    expect(task2).toEqual(task3);
  });

  it("test setTaskState", () => { //HIER WEITER
    let projectUUID = uuidv4();
    let personUUID = uuidv4();
    let members = new GrowOnlySet<Person>();
    let taskUUID = uuidv4();
    let description = "Task 1";
    let displayName = "Istref";
    let title = "Project 1"
    let project = new Project(projectUUID, personUUID, displayName, title);
    let task2 = project.createTask(taskUUID, personUUID, title, description);
    let stateCounter = task2.get_State_Counter();
    let state = task2.get_state();
    let newTaskState = 2; // done with Task
    newTaskState = state + (newTaskState+state)+3+stateCounter; //3 is amount of states there are.
    project.setTaskState(personUUID,projectUUID,taskUUID,newTaskState);
    expect(task2.state).toEqual(2);
    expect(task2.stateCounter).toEqual(5);
  });

  
  


})