import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script loading...');


contextBridge.exposeInMainWorld('electronAPI', {
    // Expose key info or methods
    versions: {
        node: () => process.versions.node,
        chrome: () => process.versions.chrome,
        electron: () => process.versions.electron,
    },
    selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
    readFolder: (path: string) => ipcRenderer.invoke('files:readDirectory', path),

    // Library operations
    importFolder: (path: string) => ipcRenderer.invoke('library:importFolder', path),
    getLibraryImages: () => ipcRenderer.invoke('library:getImages'),
    getDuplicates: () => ipcRenderer.invoke('library:getDuplicates'),
    getStats: () => ipcRenderer.invoke('library:getStats'),

    // Progress listener (returns cleanup function)
    onImportProgress: (callback: (progress: unknown) => void) => {
        const handler = (_event: unknown, progress: unknown) => callback(progress);
        ipcRenderer.on('library:importProgress', handler);
        return () => ipcRenderer.removeListener('library:importProgress', handler);
    },
});
