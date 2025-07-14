import {v4 as uuidv4} from 'uuid';
import { uuid, LogEntry, Person, AppendOnlyLog, Operation } from "../main/append_only_log";
import * as fs from "fs"
import {Task, Project, GrowOnlySet, CausalSet } from "../main/Project"
import { initializeNewProject } from '../main/file_utils';

describe("index Tests", () => {

  it("test initializeNewProject", () => {
    const projectID = uuidv4();
    const owner = uuidv4();
    const ownerName = "Istref";
    const project_path = "/Users/istrefuka/Desktop/4.Semester/Distributed programming and Internet/ToCRDoT/src/main";
    const projectTitle = "Project 1"; 
    initializeNewProject(owner, ownerName, project_path, projectID, projectTitle);
  });
  


})