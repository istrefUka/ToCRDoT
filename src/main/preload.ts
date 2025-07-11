/* eslint-disable no-unused-labels */
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data?: unknown) => {
    ipcRenderer.send(channel, data);
  },
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    ipcRenderer.on(channel, listener);
  }
})