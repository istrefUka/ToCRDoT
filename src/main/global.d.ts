import { IpcRendererEvent } from "electron"

export {}

declare global {
    interface Window {
        electronAPI: {
            send: (channel: string, data?) => void;
            on: (channel: string, listener: (event: IpcRendererEvent, ...args) => void) => void;
        }
    }    
}