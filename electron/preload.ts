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

    // Tags and search
    getTags: () => ipcRenderer.invoke('library:getTags'),
    getImagesByTag: (tag: string) => ipcRenderer.invoke('library:getImagesByTag', tag),
    getImageTagsByPath: (filePath: string) => ipcRenderer.invoke('library:getImageTagsByPath', filePath),
    search: (query: string) => ipcRenderer.invoke('library:search', query),

    // Progress listener (returns cleanup function)
    onImportProgress: (callback: (progress: unknown) => void) => {
        const handler = (_event: unknown, progress: unknown) => callback(progress);
        ipcRenderer.on('library:importProgress', handler);
        return () => ipcRenderer.removeListener('library:importProgress', handler);
    },
});
