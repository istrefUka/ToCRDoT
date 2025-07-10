export {};

declare global {
    interface Window {
        electronAPI: {
            submitOperation: (op: Operation) => void;
            sendFrontier: () => void;
            deleteLocal: () => void;
        }
    }
    interface HTMLElement {
        value: string;
    }
}