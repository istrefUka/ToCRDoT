import { IpcRendererEvent } from "electron"

export { }

declare global {
  type User = { userID: string, userName: string };
  type Scene = 'scene-login' | 'scene-home' | 'scene-project';
  type ProjectPreview = {
    projectID: string;
    projectTitle: string;
  }
  interface HTMLElement {
    value: string;
  }
  interface Window {
    electronAPI: {
      send: (channel: string, data?) => void;
      switchScene: (scene: Scene) => void;

      on: (channel: string, listener: (event: IpcRendererEvent, ...args) => void) => void;
    }
  }
}