import {v4 as uuidv4} from 'uuid';
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