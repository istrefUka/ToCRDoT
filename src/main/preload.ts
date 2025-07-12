/* eslint-disable no-unused-labels */
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data?: unknown) => {
    ipcRenderer.send(channel, data);
    console.log('renderer sent on channel', channel, ':', data);
  },
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (event: IpcRendererEvent, ...args: unknown[]) => {
      console.log('renderer received on channel', channel, ':', args);
      listener(event, ...args);
    });
  }
})