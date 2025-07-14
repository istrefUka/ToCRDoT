import {v4 as uuidv4} from 'uuid';
import { uuid, LogEntry, Person, AppendOnlyLog, Operation } from "../main/append_only_log";
import * as fs from "fs"
import {Task, Project, GrowOnlySet, CausalSet } from "../main/Project"

describe("Project Tests", () => {

  it("test charge", () => {
    //changename
    //setTaskStateGUI
    //addTaskAssigneeGUI
    //removeTaskAssigneeGUI
    const projectUUID = uuidv4();
    const personUUID = uuidv4();
    const members = new GrowOnlySet<Person>();
    const displayName = "Istref";
    const displayName2 = "Istrefi";
    const displayName3 = "Arlind";
    const title = "Project 1"
    const taskUUID = uuidv4();
    const path = "/Users/istrefuka/Desktop/4.Semester/Distributed programming and Internet/ToCRDoT/src/main";
    const append_only_log = new AppendOnlyLog(path);
    const personNew = uuidv4();
    const personNew2 = uuidv4();
    const project = new Project(projectUUID, title, append_only_log);
    project.init(personUUID, displayName, true);
    project.addMember(personUUID, displayName2, personNew, true);
    project.addMember(personUUID, displayName3, personNew2, true);
    console.log(project.getOrderedMembers());
    project.createTask(taskUUID, personUUID, title, title, true);
    project.changeName(personUUID, "Pascal", true);
    project.setTaskStateGUI(personUUID, taskUUID, "in Progress");
    project.addTaskAssigneeGUI(personUUID,taskUUID, personNew);
    project.removeTaskAssigneeGUI(personUUID,taskUUID, personNew);
    const project1 = new Project(projectUUID, title, append_only_log);
    project1.charge();
    const person: Person = {displayName: displayName, uuid: personNew};
    const person1: Person = {displayName: displayName, uuid: personNew};
    expect(person).toEqual(person1);
    expect(project1.members).toEqual(project.members);
    expect(project1.tasks).toEqual(project.tasks);
  });
  


})