import {v4 as uuidv4} from 'uuid';
import { uuid, LogEntry, Person, AppendOnlyLog, Operation } from "../main/append_only_log";
import * as fs from "fs"
import {Task, Project, GrowOnlySet, CausalSet } from "../main/Project"

describe("Project Tests", () => {

  it("test charge", () => {
    let projectUUID = uuidv4();
    let personUUID = uuidv4();
    let members = new GrowOnlySet<Person>();
    let displayName = "Istref";
    let title = "Project 1"
    let taskUUID = uuidv4();
    let path = "/Users/istrefuka/Desktop/4.Semester/Distributed programming and Internet/ToCRDoT/src/main";
    let append_only_log = new AppendOnlyLog(path);
    let personNew = uuidv4();
    let project = new Project(projectUUID, title, append_only_log, path);
    project.init(personUUID, displayName, true);
    project.addMember(personUUID, displayName, personNew, true);
    project.createTask(taskUUID, personUUID, title, title, true);
    project.changeName(personUUID, "Pascal", true);
    project.setTaskStateGUI(personUUID, taskUUID, "in Progress");
    project.addTaskAssigneeGUI(personUUID,taskUUID, personNew);
    project.removeTaskAssigneeGUI(personUUID,taskUUID, personNew);
    let project1 = new Project(projectUUID, title, append_only_log, path);
    project1.charge();
    let person: Person = {displayName: displayName, uuid: personNew};
    let person1: Person = {displayName: displayName, uuid: personNew};
    expect(person).toEqual(person1);
    expect(project1.members).toEqual(project.members);
    expect(project1.tasks).toEqual(project.tasks);
    expect(project).toEqual(project1);
  });
  


})