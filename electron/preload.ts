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
    deleteImages: (imageIds: number[], deleteFromDisk?: boolean) =>
        ipcRenderer.invoke('library:deleteImages', imageIds, deleteFromDisk ?? true),

    // Tags and search
    getTags: () => ipcRenderer.invoke('library:getTags'),
    getImagesByTag: (tag: string) => ipcRenderer.invoke('library:getImagesByTag', tag),
    getImageTagsByPath: (filePath: string) => ipcRenderer.invoke('library:getImageTagsByPath', filePath),
    search: (query: string) => ipcRenderer.invoke('library:search', query),

    // Face operations (Phase 3)
    saveFaceDetections: (imageId: number, imagePath: string, detections: unknown[]) =>
        ipcRenderer.invoke('faces:saveDetections', imageId, imagePath, detections),
    getFacesForImage: (imageId: number) => ipcRenderer.invoke('faces:getForImage', imageId),
    getUnidentifiedFaces: () => ipcRenderer.invoke('faces:getUnidentified'),
    clusterFaces: () => ipcRenderer.invoke('faces:cluster'),
    getFaceStats: () => ipcRenderer.invoke('faces:getStats'),
    getFaceThumbnail: (faceId: number) => ipcRenderer.invoke('faces:getThumbnail', faceId),

    // People operations (Phase 3)
    getAllPeople: () => ipcRenderer.invoke('people:getAll'),
    createPersonFromFace: (faceId: number, name: string) =>
        ipcRenderer.invoke('people:createFromFace', faceId, name),
    createPersonFromCluster: (faceIds: number[], name: string) =>
        ipcRenderer.invoke('people:createFromCluster', faceIds, name),
    assignFaceToPerson: (faceId: number, personId: number) =>
        ipcRenderer.invoke('people:assignFace', faceId, personId),
    getImagesByPerson: (personId: number) => ipcRenderer.invoke('people:getImages', personId),
    updatePersonName: (personId: number, name: string) =>
        ipcRenderer.invoke('people:updateName', personId, name),
    setPersonHidden: (personId: number, hidden: boolean) =>
        ipcRenderer.invoke('people:setHidden', personId, hidden),

    // Album operations
    createAlbum: (name: string, description?: string) =>
        ipcRenderer.invoke('albums:create', name, description),
    getAlbums: () => ipcRenderer.invoke('albums:list'),
    getAlbumImages: (albumId: number) => ipcRenderer.invoke('albums:getImages', albumId),
    addPhotosToAlbum: (albumId: number, imageIds: number[]) =>
        ipcRenderer.invoke('albums:addPhotos', albumId, imageIds),
    removePhotosFromAlbum: (albumId: number, imageIds: number[]) =>
        ipcRenderer.invoke('albums:removePhotos', albumId, imageIds),
    updateAlbum: (albumId: number, updates: { name?: string; description?: string; cover_image_id?: number | null }) =>
        ipcRenderer.invoke('albums:update', albumId, updates),
    deleteAlbum: (albumId: number) => ipcRenderer.invoke('albums:delete', albumId),

    // Progress listener (returns cleanup function)
    onImportProgress: (callback: (progress: unknown) => void) => {
        const handler = (_event: unknown, progress: unknown) => callback(progress);
        ipcRenderer.on('library:importProgress', handler);
        return () => ipcRenderer.removeListener('library:importProgress', handler);
    },

    // Face detection event listener (triggered after import)
    onStartFaceDetection: (callback: (data: { imagePaths: { filePath: string; fileName: string }[] }) => void) => {
        const handler = (_event: unknown, data: { imagePaths: { filePath: string; fileName: string }[] }) => callback(data);
        ipcRenderer.on('library:startFaceDetection', handler);
        return () => ipcRenderer.removeListener('library:startFaceDetection', handler);
    },
});
