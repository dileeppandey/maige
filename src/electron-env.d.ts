import { FileInfo } from '../shared/types';

export { };

declare global {
    interface Window {
        electronAPI: {
            versions: {
                node: () => string;
                chrome: () => string;
                electron: () => string;
            };
            selectFolder: () => Promise<string | null>;
            readFolder: (path: string) => Promise<FileInfo[]>;
        };
    }
}
