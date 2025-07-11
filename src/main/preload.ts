// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron'
import { Operation, uuid } from './append_only_log'

contextBridge.exposeInMainWorld('electronAPI', {
  submitOperation: (op: Operation, deps: uuid[]) => ipcRenderer.send('submit-operation', op, deps),
  sendFrontier: () => ipcRenderer.send('send-frontier'),
  deleteLocal: () => ipcRenderer.send('delete-local'),
})