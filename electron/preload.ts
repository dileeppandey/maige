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
    getLibraryImages: (options?: { limit?: number; offset?: number }) => ipcRenderer.invoke('library:getImages', options),
    getDuplicates: () => ipcRenderer.invoke('library:getDuplicates'),
    getStats: () => ipcRenderer.invoke('library:getStats'),
    deleteImages: (imageIds: number[], deleteFromDisk?: boolean) =>
        ipcRenderer.invoke('library:deleteImages', imageIds, deleteFromDisk ?? true),

    // Tags and search
    getTags: () => ipcRenderer.invoke('library:getTags'),
    getImagesByTag: (tag: string, options?: { limit?: number; offset?: number }) => ipcRenderer.invoke('library:getImagesByTag', tag, options),
    getImageTagsByPath: (filePath: string) => ipcRenderer.invoke('library:getImageTagsByPath', filePath),
    getImageByPath: (filePath: string) => ipcRenderer.invoke('library:getImageByPath', filePath),
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

    // Export operations
    showExportSaveDialog: (defaultPath: string, format: 'jpeg' | 'png') =>
        ipcRenderer.invoke('export:showSaveDialog', defaultPath, format),
    exportImage: (options: { dataUrl: string; outputPath: string; format: 'jpeg' | 'png'; quality: number }) =>
        ipcRenderer.invoke('export:saveImage', options),

    // Preset operations
    loadPresets: () => ipcRenderer.invoke('presets:load'),
    savePresets: (presets: unknown[]) => ipcRenderer.invoke('presets:save', presets),

    // Generic menu action listener
    onMenuAction: (callback: (action: string, data?: unknown) => void) => {
        ipcRenderer.on('menu:openFolder', (_e, data: string) => callback('openFolder', data));
        ipcRenderer.on('menu:importImages', (_e, data: string[]) => callback('importImages', data));
        ipcRenderer.on('menu:closeFolder', () => callback('closeFolder'));
        ipcRenderer.on('menu:export', () => callback('export'));
        ipcRenderer.on('menu:exportAs', () => callback('exportAs'));
        ipcRenderer.on('menu:quickExport', () => callback('quickExport'));
        ipcRenderer.on('menu:showInFinder', () => callback('showInFinder'));
        ipcRenderer.on('menu:moveToTrash', () => callback('moveToTrash'));

        ipcRenderer.on('menu:undo', () => callback('undo'));
        ipcRenderer.on('menu:redo', () => callback('redo'));
        ipcRenderer.on('menu:selectAll', () => callback('selectAll'));
        ipcRenderer.on('menu:deselectAll', () => callback('deselectAll'));
        ipcRenderer.on('menu:invertSelection', () => callback('invertSelection'));

        ipcRenderer.on('menu:newAlbum', () => callback('newAlbum'));
        ipcRenderer.on('menu:addToAlbum', () => callback('addToAlbum'));
        ipcRenderer.on('menu:removeFromAlbum', () => callback('removeFromAlbum'));
        ipcRenderer.on('menu:analyzeFolder', () => callback('analyzeFolder'));
        ipcRenderer.on('menu:findDuplicates', () => callback('findDuplicates'));
        ipcRenderer.on('menu:semanticSearch', () => callback('semanticSearch'));
        ipcRenderer.on('menu:sortBy', (_e, data: string) => callback('sortBy', data));
        ipcRenderer.on('menu:filterBy', (_e, data: string) => callback('filterBy', data));

        ipcRenderer.on('menu:copyAdjustments', () => callback('copyAdjustments'));
        ipcRenderer.on('menu:pasteAdjustments', () => callback('pasteAdjustments'));
        ipcRenderer.on('menu:syncSettings', () => callback('syncSettings'));
        ipcRenderer.on('menu:resetAdjustments', () => callback('resetAdjustments'));
        ipcRenderer.on('menu:revertToOriginal', () => callback('revertToOriginal'));
        ipcRenderer.on('menu:createVirtualCopy', () => callback('createVirtualCopy'));

        ipcRenderer.on('menu:getInfo', () => callback('getInfo'));
        ipcRenderer.on('menu:addKeywords', () => callback('addKeywords'));
        ipcRenderer.on('menu:setRating', (_e, data: number) => callback('setRating', data));
        ipcRenderer.on('menu:setFlag', (_e, data: 'pick' | 'reject' | 'none') => callback('setFlag', data));

        ipcRenderer.on('menu:togglePanel', (_e, data: 'library' | 'develop' | 'filmstrip') => callback('togglePanel', data));
        ipcRenderer.on('menu:zoomIn', () => callback('zoomIn'));
        ipcRenderer.on('menu:zoomOut', () => callback('zoomOut'));
        ipcRenderer.on('menu:zoomFit', () => callback('zoomFit'));
        ipcRenderer.on('menu:zoomActual', () => callback('zoomActual'));
        ipcRenderer.on('menu:compareMode', () => callback('compareMode'));
        ipcRenderer.on('menu:beforeAfter', () => callback('beforeAfter'));

        return () => {
            ipcRenderer.removeAllListeners('menu:openFolder');
            ipcRenderer.removeAllListeners('menu:importImages');
            ipcRenderer.removeAllListeners('menu:closeFolder');
            ipcRenderer.removeAllListeners('menu:export');
            ipcRenderer.removeAllListeners('menu:exportAs');
            ipcRenderer.removeAllListeners('menu:quickExport');
            ipcRenderer.removeAllListeners('menu:showInFinder');
            ipcRenderer.removeAllListeners('menu:moveToTrash');
            ipcRenderer.removeAllListeners('menu:undo');
            ipcRenderer.removeAllListeners('menu:redo');
            ipcRenderer.removeAllListeners('menu:selectAll');
            ipcRenderer.removeAllListeners('menu:deselectAll');
            ipcRenderer.removeAllListeners('menu:invertSelection');
            ipcRenderer.removeAllListeners('menu:newAlbum');
            ipcRenderer.removeAllListeners('menu:addToAlbum');
            ipcRenderer.removeAllListeners('menu:removeFromAlbum');
            ipcRenderer.removeAllListeners('menu:analyzeFolder');
            ipcRenderer.removeAllListeners('menu:findDuplicates');
            ipcRenderer.removeAllListeners('menu:semanticSearch');
            ipcRenderer.removeAllListeners('menu:sortBy');
            ipcRenderer.removeAllListeners('menu:filterBy');
            ipcRenderer.removeAllListeners('menu:copyAdjustments');
            ipcRenderer.removeAllListeners('menu:pasteAdjustments');
            ipcRenderer.removeAllListeners('menu:syncSettings');
            ipcRenderer.removeAllListeners('menu:resetAdjustments');
            ipcRenderer.removeAllListeners('menu:revertToOriginal');
            ipcRenderer.removeAllListeners('menu:createVirtualCopy');
            ipcRenderer.removeAllListeners('menu:getInfo');
            ipcRenderer.removeAllListeners('menu:addKeywords');
            ipcRenderer.removeAllListeners('menu:setRating');
            ipcRenderer.removeAllListeners('menu:setFlag');
            ipcRenderer.removeAllListeners('menu:togglePanel');
            ipcRenderer.removeAllListeners('menu:zoomIn');
            ipcRenderer.removeAllListeners('menu:zoomOut');
            ipcRenderer.removeAllListeners('menu:zoomFit');
            ipcRenderer.removeAllListeners('menu:zoomActual');
            ipcRenderer.removeAllListeners('menu:compareMode');
            ipcRenderer.removeAllListeners('menu:beforeAfter');
        };
    },
});
