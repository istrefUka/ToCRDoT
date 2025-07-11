
export {};

declare global {
    interface Window {
        electronAPI: {
            submitOperation: (op: Operation, deps: uuid[]) => void;
            sendFrontier: () => void;
            deleteLocal: () => void;
        }
    }
    interface HTMLElement {
        value: string;
    }
}