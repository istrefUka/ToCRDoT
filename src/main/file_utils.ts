import * as fs from 'fs'
import { toBase64 } from './utils';
import path from 'path';

/**
 * throws an error if the user hasn't logged in yet
 * @param app_path 
 * @returns 
 */
export function loadUser(app_path: string): User {
  const file = path.join(app_path, 'user.txt');
  if (!fs.existsSync(file)) {
    throw new Error('Not logged in yet (file ' + file + ' doesnt exist');
  }
  return decodeUser(fs.readFileSync(file).toString());
}

export function saveUser(app_path: string, u: User) {
  const file = path.join(app_path, 'user.txt');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  fs.writeFileSync(file, encodeUser(u));
}

function encodeUser(u: User): string {
  return [u.userID, toBase64(u.userName)].join(' ')
}

function decodeUser(enc: string): User {
  const t = enc.split(' ')
  if (t.length != 2) {
    throw new Error("userdata saved incorrectly");
  }
  return { userID: t[0], userName: t[1] };
}


export function loadProjectPreviews(projects_path: string): ProjectPreview[] {
  const res = new Array<ProjectPreview>();
  if (!fs.existsSync(projects_path)) {
    fs.mkdirSync(projects_path, { recursive: true });
  }
  const subfolders = fs.readdirSync(projects_path, { withFileTypes: true }).filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
  console.log(subfolders);
  for (const folder of subfolders) {
    const projectID = folder;
    const projectTitle = fs.readFileSync(path.join(projects_path, folder, 'project-title.txt')).toString();
    res.push({ projectID, projectTitle });
  }
  return res;
}