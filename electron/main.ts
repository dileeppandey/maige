import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, MenuItemConstructorOptions, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { pathToFileURL, fileURLToPath } from 'url';
import sharp from 'sharp';
import {
    initDatabase,
    closeDatabase,
    upsertImage,
    getAllImages,
    getLibraryStats,
    createDuplicateGroups,
    getDuplicateGroups,
    createAlbum,
    getAllAlbums,
    getAlbumImages,
    addPhotosToAlbum,
    removePhotosFromAlbum,
    updateAlbum,
    deleteAlbum,
} from './database.js';
import {
    scanDirectoryRecursive,
    analyzeImages,
} from './imageAnalyzer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicitly set app name for branding
app.name = 'Maige';

// Track main window for sending progress updates
let mainWindow: BrowserWindow | null = null;

ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    });
    if (canceled) {
        return null;
    }
    return filePaths[0];
});

ipcMain.handle('files:readDirectory', async (_, dirPath: string) => {
    try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
            return [];
        }

        const files = await fs.readdir(dirPath, { withFileTypes: true });
        // Support common image formats + simple RAW extensions
        const imageExtensions = /\.(jpg|jpeg|png|webp|gif|bmp|tiff|cr2|arw|dng|nef|orf|rw2)$/i;

        return files
            .filter(dirent => dirent.isFile() && imageExtensions.test(dirent.name))
            .map(dirent => ({
                name: dirent.name,
                path: path.join(dirPath, dirent.name),
                isDirectory: false,
                type: 'image'
            }));
    } catch (err) {
        console.error('Error reading directory:', err);
        return [];
    }
});

// ============================================
// Library IPC Handlers
// ============================================

/**
 * Import a folder into the library with recursive scanning and analysis
 */
ipcMain.handle('library:importFolder', async (_, folderPath: string) => {
    try {
        // Step 1: Scan for images
        mainWindow?.webContents.send('library:importProgress', {
            phase: 'scanning',
            current: 0,
            total: 0,
            file: '',
        });

        const imagePaths = await scanDirectoryRecursive(folderPath);
        const total = imagePaths.length;

        if (total === 0) {
            return { success: true, imported: 0, duplicates: 0 };
        }

        // Step 2: Analyze images
        const analyzed = await analyzeImages(imagePaths, (current, total, file) => {
            mainWindow?.webContents.send('library:importProgress', {
                phase: 'analyzing',
                current,
                total,
                file: path.basename(file),
            });
        });

        // Step 3: Save to database
        mainWindow?.webContents.send('library:importProgress', {
            phase: 'saving',
            current: 0,
            total: analyzed.length,
            file: '',
        });

        for (let i = 0; i < analyzed.length; i++) {
            const img = analyzed[i];
            upsertImage({
                file_path: img.filePath,
                file_name: img.fileName,
                file_hash: img.fileHash,
                file_size: img.fileSize,
                width: img.metadata.width,
                height: img.metadata.height,
                format: img.metadata.format || null,
                color_space: img.metadata.colorSpace || null,
                has_alpha: img.metadata.hasAlpha ? 1 : 0,
                date_taken: img.metadata.dateTaken || null,
                camera_make: img.metadata.cameraMake || null,
                camera_model: img.metadata.cameraModel || null,
                focal_length: img.metadata.focalLength || null,
                aperture: img.metadata.aperture || null,
                iso: img.metadata.iso || null,
                shutter_speed: img.metadata.shutterSpeed || null,
                exposure_program: img.metadata.exposureProgram || null,
                metering_mode: img.metadata.meteringMode || null,
                flash: img.metadata.flash || null,
                white_balance: img.metadata.whiteBalance || null,
                gps_lat: img.metadata.gpsLat || null,
                gps_lng: img.metadata.gpsLng || null,
                phash: img.phash || null,
                analyzed_at: new Date().toISOString(),
            });

            if (i % 10 === 0) {
                mainWindow?.webContents.send('library:importProgress', {
                    phase: 'saving',
                    current: i + 1,
                    total: analyzed.length,
                    file: img.fileName,
                });
            }
        }

        // Step 4: Detect duplicates
        mainWindow?.webContents.send('library:importProgress', {
            phase: 'detecting_duplicates',
            current: 0,
            total: 0,
            file: '',
        });

        const duplicateGroupsCount = createDuplicateGroups();

        // Step 5: AI Tagging (run via worker thread for main-thread offloading)
        mainWindow?.webContents.send('library:importProgress', {
            phase: 'ai_tagging',
            current: 0,
            total: analyzed.length,
            file: '',
        });

        // Import CLIP worker pool and database functions
        const { analyzeImageWithCLIPWorker } = await import('./clipWorkerPool.js');
        const { addImageTags, updateImageEmbedding, getImageByPath } = await import('./database.js');

        for (let i = 0; i < analyzed.length; i++) {
            const img = analyzed[i];

            try {
                // Get the image record from DB to get its ID
                const imageRecord = getImageByPath(img.filePath);
                if (!imageRecord) continue;

                // Run CLIP analysis via worker thread
                const clipResult = await analyzeImageWithCLIPWorker(imageRecord.id, img.filePath);

                // Save tags
                if (clipResult.success && clipResult.tags.length > 0) {
                    addImageTags(imageRecord.id, clipResult.tags);
                }

                // Save embedding
                if (clipResult.success && clipResult.embedding) {
                    updateImageEmbedding(imageRecord.id, clipResult.embedding);
                }

                if (i % 5 === 0) {
                    mainWindow?.webContents.send('library:importProgress', {
                        phase: 'ai_tagging',
                        current: i + 1,
                        total: analyzed.length,
                        file: img.fileName,
                    });
                }
            } catch (clipError) {
                console.error('CLIP analysis failed for:', img.filePath, clipError);
                // Continue with next image
            }
        }

        // Step 6: Face Detection
        // Note: MediaPipe runs in renderer. We'll request the renderer to detect faces
        // and send results back via IPC. For now, send a notification to trigger detection.
        mainWindow?.webContents.send('library:importProgress', {
            phase: 'face_detection',
            current: 0,
            total: analyzed.length,
            file: '',
        });

        // Send message to renderer to start face detection on imported images
        // The renderer will use MediaPipe and call back with results
        mainWindow?.webContents.send('library:startFaceDetection', {
            imagePaths: analyzed.map(img => ({
                filePath: img.filePath,
                fileName: img.fileName,
            })),
        });

        mainWindow?.webContents.send('library:importProgress', {
            phase: 'complete',
            current: analyzed.length,
            total: analyzed.length,
            file: '',
        });

        return {
            success: true,
            imported: analyzed.length,
            duplicates: duplicateGroupsCount,
        };
    } catch (error) {
        console.error('Import failed:', error);
        return {
            success: false,
            error: String(error),
            imported: 0,
            duplicates: 0,
        };
    }
});

/**
 * Get all images in the library with pagination
 */
ipcMain.handle('library:getImages', async (_, options?: { limit?: number; offset?: number }) => {
    try {
        const limit = options?.limit ?? 100;
        const offset = options?.offset ?? 0;
        return getAllImages(limit, offset);
    } catch (error) {
        console.error('Failed to get images:', error);
        return [];
    }
});

/**
 * Get duplicate groups
 */
ipcMain.handle('library:getDuplicates', async () => {
    try {
        return getDuplicateGroups();
    } catch (error) {
        console.error('Failed to get duplicates:', error);
        return [];
    }
});

/**
 * Get library statistics
 */
ipcMain.handle('library:getStats', async () => {
    try {
        return getLibraryStats();
    } catch (error) {
        console.error('Failed to get stats:', error);
        return { totalImages: 0, duplicateGroups: 0 };
    }
});

/**
 * Get all unique tags
 */
ipcMain.handle('library:getTags', async () => {
    try {
        const { getAllTags } = await import('./database.js');
        return getAllTags();
    } catch (error) {
        console.error('Failed to get tags:', error);
        return [];
    }
});

/**
 * Get images by tag with pagination
 */
ipcMain.handle('library:getImagesByTag', async (_, tagName: string, options?: { limit?: number; offset?: number }) => {
    try {
        const { getImagesByTag } = await import('./database.js');
        const limit = options?.limit ?? 100;
        const offset = options?.offset ?? 0;
        return getImagesByTag(tagName, limit, offset);
    } catch (error) {
        console.error('Failed to get images by tag:', error);
        return [];
    }
});

/**
 * Delete images from library (and optionally from filesystem)
 */
ipcMain.handle('library:deleteImages', async (_, imageIds: number[], deleteFromDisk: boolean = true) => {
    try {
        const { deleteImagesFromLibrary } = await import('./database.js');
        const fs = await import('fs/promises');
        const { getDatabase } = await import('./database.js');
        const db = getDatabase();

        // Get file paths before deletion
        const pathsToDelete: string[] = [];
        if (deleteFromDisk) {
            const placeholders = imageIds.map(() => '?').join(',');
            const images = db.prepare(`SELECT file_path FROM images WHERE id IN (${placeholders})`).all(...imageIds) as { file_path: string }[];
            pathsToDelete.push(...images.map(img => img.file_path));
        }

        // Delete from database
        const result = deleteImagesFromLibrary(imageIds);

        // Delete from filesystem if requested
        let filesDeleted = 0;
        if (deleteFromDisk) {
            for (const filePath of pathsToDelete) {
                try {
                    await fs.unlink(filePath);
                    filesDeleted++;
                } catch (err) {
                    console.error(`Failed to delete file ${filePath}:`, err);
                }
            }
        }

        return {
            success: true,
            deletedFromDb: result.deletedCount,
            deletedFromDisk: filesDeleted
        };
    } catch (error) {
        console.error('Failed to delete images:', error);
        return { success: false, error: String(error) };
    }
});

/**
 * Semantic search by text query
 */
ipcMain.handle('library:search', async (_, query: string) => {
    try {
        const { generateTextEmbedding, cosineSimilarity } = await import('./clipService.js');
        const { getImagesWithEmbeddings } = await import('./database.js');

        // Generate embedding for search query
        const queryEmbedding = await generateTextEmbedding(query);
        if (!queryEmbedding) {
            return [];
        }

        // Get all images with embeddings
        const images = getImagesWithEmbeddings();

        // Calculate similarity and rank
        const results = images
            .map(img => ({
                ...img,
                similarity: cosineSimilarity(queryEmbedding, img.embedding),
            }))
            .filter(img => img.similarity > 0.2) // Threshold for relevance
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 50); // Top 50 results

        return results.map(({ id, file_path, similarity }) => ({
            id,
            file_path,
            similarity,
        }));
    } catch (error) {
        console.error('Search failed:', error);
        return [];
    }
});

/**
 * Get tags for a specific image by file path
 */
ipcMain.handle('library:getImageTagsByPath', async (_, filePath: string) => {
    try {
        const { getImageByPath, getImageTags } = await import('./database.js');
        const image = getImageByPath(filePath);
        if (!image) {
            return [];
        }
        return getImageTags(image.id);
    } catch (error) {
        console.error('Failed to get image tags:', error);
        return [];
    }
});

/**
 * Get image details by file path
 */
ipcMain.handle('library:getImageByPath', async (_, filePath: string) => {
    try {
        const { getImageByPath } = await import('./database.js');
        return getImageByPath(filePath) || null;
    } catch (error) {
        console.error('Failed to get image by path:', error);
        return null;
    }
});

// ============================================
// Face Recognition IPC Handlers (Phase 3)
// ============================================

/**
 * Process face detections from MediaPipe (renderer sends results here)
 */
ipcMain.handle('faces:saveDetections', async (_, imageId: number, imagePath: string, detections: { bbox: { x: number; y: number; width: number; height: number }; confidence: number }[]) => {
    try {
        const { processFaceDetections } = await import('./faceService.js');
        return await processFaceDetections(imageId, imagePath, detections);
    } catch (error) {
        console.error('Failed to save face detections:', error);
        return [];
    }
});

/**
 * Get faces for an image
 */
ipcMain.handle('faces:getForImage', async (_, imageId: number) => {
    try {
        const { getFacesForImage } = await import('./database.js');
        return getFacesForImage(imageId);
    } catch (error) {
        console.error('Failed to get faces:', error);
        return [];
    }
});

/**
 * Get all unidentified faces
 */
ipcMain.handle('faces:getUnidentified', async () => {
    try {
        const { getUnidentifiedFaces } = await import('./database.js');
        return getUnidentifiedFaces();
    } catch (error) {
        console.error('Failed to get unidentified faces:', error);
        return [];
    }
});

/**
 * Cluster unidentified faces
 */
ipcMain.handle('faces:cluster', async () => {
    try {
        const { clusterUnidentifiedFaces } = await import('./faceService.js');
        return clusterUnidentifiedFaces();
    } catch (error) {
        console.error('Failed to cluster faces:', error);
        return [];
    }
});

/**
 * Get face statistics
 */
ipcMain.handle('faces:getStats', async () => {
    try {
        const { getFaceStats } = await import('./faceService.js');
        return getFaceStats();
    } catch (error) {
        console.error('Failed to get face stats:', error);
        return { totalFaces: 0, identifiedFaces: 0, unidentifiedFaces: 0, totalPeople: 0 };
    }
});

/**
 * Clean up duplicate face entries
 */
ipcMain.handle('faces:cleanup', async () => {
    try {
        const { cleanupDuplicateFaces } = await import('./database.js');
        return cleanupDuplicateFaces();
    } catch (error) {
        console.error('Failed to cleanup duplicate faces:', error);
        return { duplicatesRemoved: 0, imagesAffected: 0 };
    }
});

// ============================================
// People IPC Handlers (Phase 3)
// ============================================

/**
 * Get all people with face counts
 */
ipcMain.handle('people:getAll', async () => {
    try {
        const { getAllPeople } = await import('./database.js');
        return getAllPeople();
    } catch (error) {
        console.error('Failed to get people:', error);
        return [];
    }
});

/**
 * Create a new person from an unidentified face
 */
ipcMain.handle('people:createFromFace', async (_, faceId: number, name: string) => {
    try {
        const { createPersonFromFace } = await import('./faceService.js');
        return await createPersonFromFace(faceId, name);
    } catch (error) {
        console.error('Failed to create person:', error);
        return null;
    }
});

/**
 * Create a person from a cluster of faces (assigns ALL faces to one person)
 */
ipcMain.handle('people:createFromCluster', async (_, faceIds: number[], name: string) => {
    try {
        const { createPersonFromCluster } = await import('./faceService.js');
        return await createPersonFromCluster(faceIds, name);
    } catch (error) {
        console.error('Failed to create person from cluster:', error);
        return null;
    }
});


/**
 * Assign a face to an existing person
 */
ipcMain.handle('people:assignFace', async (_, faceId: number, personId: number) => {
    try {
        const { assignFaceToPerson } = await import('./faceService.js');
        await assignFaceToPerson(faceId, personId);
        return true;
    } catch (error) {
        console.error('Failed to assign face:', error);
        return false;
    }
});

/**
 * Get images by person
 */
ipcMain.handle('people:getImages', async (_, personId: number) => {
    try {
        const { getImagesByPerson } = await import('./database.js');
        return getImagesByPerson(personId);
    } catch (error) {
        console.error('Failed to get images by person:', error);
        return [];
    }
});

/**
 * Update person name
 */
ipcMain.handle('people:updateName', async (_, personId: number, name: string) => {
    try {
        const { updatePersonName } = await import('./database.js');
        updatePersonName(personId, name);
        return true;
    } catch (error) {
        console.error('Failed to update person name:', error);
        return false;
    }
});

/**
 * Hide/unhide a person
 */
ipcMain.handle('people:setHidden', async (_, personId: number, hidden: boolean) => {
    try {
        const { setPersonHidden } = await import('./database.js');
        setPersonHidden(personId, hidden);
        return true;
    } catch (error) {
        console.error('Failed to set person hidden:', error);
        return false;
    }
});

/**
 * Get hidden people
 */
ipcMain.handle('people:getHidden', async () => {
    try {
        const { getHiddenPeople } = await import('./database.js');
        return getHiddenPeople();
    } catch (error) {
        console.error('Failed to get hidden people:', error);
        return [];
    }
});

/**
 * Get face info (for cluster view)
 */
ipcMain.handle('faces:getInfo', async (_, faceId: number) => {
    try {
        const { getFaceInfo } = await import('./database.js');
        return getFaceInfo(faceId);
    } catch (error) {
        console.error('Failed to get face info:', error);
        return null;
    }
});

/**
 * Get a cropped face thumbnail as base64 data URL
 */
ipcMain.handle('faces:getThumbnail', async (_, faceId: number) => {
    try {
        const { getDatabase } = await import('./database.js');
        const db = getDatabase();

        // Get face and associated image path
        const face = db.prepare(`
            SELECT f.*, i.file_path
            FROM faces f
            JOIN images i ON f.image_id = i.id
            WHERE f.id = ?
        `).get(faceId) as {
            bbox_x: number;
            bbox_y: number;
            bbox_w: number;
            bbox_h: number;
            file_path: string;
        } | undefined;

        if (!face) {
            return null;
        }

        // Crop the face from the image
        const image = sharp(face.file_path);
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) {
            return null;
        }

        // Convert normalized coords to pixels with padding
        const padding = 0.15;
        const left = Math.max(0, Math.floor((face.bbox_x - padding) * metadata.width));
        const top = Math.max(0, Math.floor((face.bbox_y - padding) * metadata.height));
        const width = Math.min(
            metadata.width - left,
            Math.floor((face.bbox_w + padding * 2) * metadata.width)
        );
        const height = Math.min(
            metadata.height - top,
            Math.floor((face.bbox_h + padding * 2) * metadata.height)
        );

        const buffer = await image
            .extract({ left, top, width, height })
            .resize(80, 80, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();

        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error('Failed to get face thumbnail:', error);
        return null;
    }
});

// ============================================
// Album IPC Handlers
// ============================================

/**
 * Create a new album
 */
ipcMain.handle('albums:create', async (_, name: string, description?: string) => {
    try {
        return createAlbum(name, description);
    } catch (error) {
        console.error('Failed to create album:', error);
        return null;
    }
});

/**
 * Get all albums
 */
ipcMain.handle('albums:list', async () => {
    try {
        return getAllAlbums();
    } catch (error) {
        console.error('Failed to list albums:', error);
        return [];
    }
});

/**
 * Get images in an album
 */
ipcMain.handle('albums:getImages', async (_, albumId: number) => {
    try {
        return getAlbumImages(albumId);
    } catch (error) {
        console.error('Failed to get album images:', error);
        return [];
    }
});

/**
 * Add photos to an album
 */
ipcMain.handle('albums:addPhotos', async (_, albumId: number, imageIds: number[]) => {
    try {
        return addPhotosToAlbum(albumId, imageIds);
    } catch (error) {
        console.error('Failed to add photos to album:', error);
        return { added: 0 };
    }
});

/**
 * Remove photos from an album
 */
ipcMain.handle('albums:removePhotos', async (_, albumId: number, imageIds: number[]) => {
    try {
        return removePhotosFromAlbum(albumId, imageIds);
    } catch (error) {
        console.error('Failed to remove photos from album:', error);
        return { removed: 0 };
    }
});

/**
 * Update album details
 */
ipcMain.handle('albums:update', async (_, albumId: number, updates: { name?: string; description?: string; cover_image_id?: number | null }) => {
    try {
        updateAlbum(albumId, updates);
        return true;
    } catch (error) {
        console.error('Failed to update album:', error);
        return false;
    }
});

/**
 * Delete an album
 */
ipcMain.handle('albums:delete', async (_, albumId: number) => {
    try {
        deleteAlbum(albumId);
        return true;
    } catch (error) {
        console.error('Failed to delete album:', error);
        return false;
    }
});

// ============================================
// Export & Preset IPC Handlers
// ============================================

const PRESETS_FILE = path.join(app.getPath('userData'), 'presets.json');

/**
 * Show save dialog for export
 */
ipcMain.handle('export:showSaveDialog', async (_, defaultPath: string, format: 'jpeg' | 'png') => {
    const filters = format === 'jpeg'
        ? [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }]
        : [{ name: 'PNG Image', extensions: ['png'] }];

    const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath,
        filters,
    });

    if (canceled || !filePath) return null;
    return filePath;
});

/**
 * Export image with edits baked in
 */
ipcMain.handle('export:saveImage', async (_, options: {
    dataUrl: string;
    outputPath: string;
    format: 'jpeg' | 'png';
    quality: number;
}) => {
    try {
        const { dataUrl, outputPath, format, quality } = options;

        // Convert data URL to buffer
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Process with sharp for format conversion and quality
        let sharpInstance = sharp(buffer);

        if (format === 'jpeg') {
            sharpInstance = sharpInstance.jpeg({ quality });
        } else {
            sharpInstance = sharpInstance.png();
        }

        await sharpInstance.toFile(outputPath);

        // Check if this is a new file (not in database) and auto-import it
        try {
            const { getImageByPath, upsertImage } = await import('./database.js');
            const existingImage = getImageByPath(outputPath);

            if (!existingImage) {
                // New file - analyze and add to database
                const { extractMetadata, generatePHash, calculateFileHash } = await import('./imageAnalyzer.js');

                const metadata = await extractMetadata(outputPath);
                const phash = await generatePHash(outputPath);
                const fileHash = await calculateFileHash(outputPath);
                const fileName = path.basename(outputPath);
                const fileStat = await fs.stat(outputPath);

                upsertImage({
                    file_path: outputPath,
                    file_name: fileName,
                    file_hash: fileHash,
                    file_size: fileStat.size,
                    format: metadata.format || format,
                    color_space: metadata.colorSpace || null,
                    has_alpha: metadata.hasAlpha ? 1 : 0,
                    width: metadata.width || 0,
                    height: metadata.height || 0,
                    camera_make: metadata.cameraMake || null,
                    camera_model: metadata.cameraModel || null,
                    focal_length: metadata.focalLength || null,
                    aperture: metadata.aperture || null,
                    iso: metadata.iso || null,
                    shutter_speed: metadata.shutterSpeed || null,
                    exposure_program: metadata.exposureProgram || null,
                    metering_mode: metadata.meteringMode || null,
                    flash: metadata.flash || null,
                    white_balance: metadata.whiteBalance || null,
                    date_taken: metadata.dateTaken || new Date().toISOString(),
                    gps_lat: metadata.gpsLat || null,
                    gps_lng: metadata.gpsLng || null,
                    phash: phash || null,
                    analyzed_at: new Date().toISOString(),
                });

                console.log('Auto-imported exported image:', outputPath);
            }
        } catch (importError) {
            // Non-fatal: file was saved but auto-import failed
            console.warn('Auto-import of exported image failed:', importError);
        }

        return { success: true, path: outputPath };
    } catch (error) {
        console.error('Export failed:', error);
        return { success: false, error: String(error) };
    }
});

/**
 * Load presets from disk
 */
ipcMain.handle('presets:load', async () => {
    try {
        const data = await fs.readFile(PRESETS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        // File doesn't exist or is invalid, return empty array
        return [];
    }
});

/**
 * Save presets to disk
 */
ipcMain.handle('presets:save', async (_, presets: unknown[]) => {
    try {
        await fs.writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('Failed to save presets:', error);
        return { success: false, error: String(error) };
    }
});

const createWindow = () => {
    // Create the browser window.
    console.log('Preload path:', path.join(__dirname, 'preload.js'));
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            sandbox: false // Disable sandbox to ensure preload works with current setup
        },
    });

    // and load the index.html of the app.
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

app.whenReady().then(() => {
    // Initialize database
    initDatabase();

    // Register protocol to view local files safely
    protocol.handle('media', async (request) => {
        // Extract file path and strip query parameters for cache busting
        let rawPath = request.url.slice('media://'.length);
        // Remove query string (e.g., ?v=0)
        const queryIndex = rawPath.indexOf('?');
        if (queryIndex !== -1) {
            rawPath = rawPath.slice(0, queryIndex);
        }
        const decodedPath = decodeURIComponent(rawPath);

        const ext = path.extname(decodedPath).toLowerCase();
        // Common RAW formats + others sharp can handle but browsers might not
        const rawExtensions = ['.cr2', '.arw', '.dng', '.nef', '.orf', '.rw2', '.raf', '.tif', '.tiff'];

        if (rawExtensions.includes(ext)) {
            try {
                const buffer = await sharp(decodedPath)
                    .rotate() // Auto-rotate based on EXIF
                    .toFormat('jpeg', { quality: 80 })
                    .toBuffer();

                return new Response(buffer as unknown as BodyInit, {
                    headers: { 'content-type': 'image/jpeg' }
                });
            } catch (err) {
                console.error('Failed to convert RAW image:', decodedPath, err);
                // Fallback to trying to serve it directly (likely won't work in img tag but good for debug)
                return net.fetch(pathToFileURL(decodedPath).toString());
            }
        }

        return net.fetch(pathToFileURL(decodedPath).toString());
    });

    setupMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    closeDatabase();
});

// ============================================
// Menu Template & Implementation
// ============================================

/**
 * Build the Professional Mac Menu Bar
 */
const setupMenu = () => {
    const isMac = process.platform === 'darwin';

    const template: MenuItemConstructorOptions[] = [
        // { role: 'appMenu' }
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] as MenuItemConstructorOptions[] : []),
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Folder...',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const { canceled, filePaths } = await dialog.showOpenDialog({
                            properties: ['openDirectory'],
                        });
                        if (!canceled && filePaths[0]) {
                            mainWindow?.webContents.send('menu:openFolder', filePaths[0]);
                        }
                    }
                },
                { label: 'Open Recent', role: 'recentDocuments' },
                { type: 'separator' },
                {
                    label: 'Close Folder',
                    accelerator: 'Shift+CmdOrCtrl+W',
                    click: () => mainWindow?.webContents.send('menu:closeFolder')
                },
                { label: 'Close Window', accelerator: 'CmdOrCtrl+W', role: 'close' },
                { type: 'separator' },
                {
                    label: 'Import Images...',
                    accelerator: 'Shift+CmdOrCtrl+I',
                    click: async () => {
                        const { canceled, filePaths } = await dialog.showOpenDialog({
                            properties: ['openFile', 'multiSelections'],
                            filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'cr2', 'arw', 'dng', 'nef'] }]
                        });
                        if (!canceled && filePaths.length > 0) {
                            mainWindow?.webContents.send('menu:importImages', filePaths);
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Export...',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => mainWindow?.webContents.send('menu:export')
                },
                {
                    label: 'Export As...',
                    accelerator: 'Shift+CmdOrCtrl+E',
                    click: () => mainWindow?.webContents.send('menu:exportAs')
                },
                {
                    label: 'Quick Export (JPEG)',
                    accelerator: 'Alt+Shift+J',
                    click: () => mainWindow?.webContents.send('menu:quickExport')
                },
                { type: 'separator' },
                {
                    label: 'Show in Finder',
                    accelerator: 'Shift+CmdOrCtrl+R',
                    click: () => mainWindow?.webContents.send('menu:showInFinder')
                },
                {
                    label: 'Move to Trash',
                    accelerator: 'CmdOrCtrl+Backspace',
                    click: () => mainWindow?.webContents.send('menu:moveToTrash')
                },
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow?.webContents.send('menu:undo') },
                { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', click: () => mainWindow?.webContents.send('menu:redo') },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { type: 'separator' },
                { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => mainWindow?.webContents.send('menu:selectAll') },
                { label: 'Deselect All', accelerator: 'Shift+CmdOrCtrl+A', click: () => mainWindow?.webContents.send('menu:deselectAll') },
                {
                    label: 'Invert Selection',
                    accelerator: 'CmdOrCtrl+I',
                    click: () => mainWindow?.webContents.send('menu:invertSelection')
                },
            ]
        },
        {
            label: 'Library',
            submenu: [
                {
                    label: 'New Album',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow?.webContents.send('menu:newAlbum')
                },
                {
                    label: 'Add to Album...',
                    accelerator: 'Alt+CmdOrCtrl+A',
                    click: () => mainWindow?.webContents.send('menu:addToAlbum')
                },
                {
                    label: 'Remove from Album',
                    accelerator: 'Alt+CmdOrCtrl+Backspace',
                    click: () => mainWindow?.webContents.send('menu:removeFromAlbum')
                },
                { type: 'separator' },
                {
                    label: 'Analyze Folder...',
                    accelerator: 'Alt+Shift+A',
                    click: () => mainWindow?.webContents.send('menu:analyzeFolder')
                },
                {
                    label: 'Find Duplicates...',
                    click: () => mainWindow?.webContents.send('menu:findDuplicates')
                },
                {
                    label: 'Semantic Search',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => mainWindow?.webContents.send('menu:semanticSearch')
                },
                { type: 'separator' },
                {
                    label: 'Sort By',
                    submenu: [
                        { label: 'Date', click: () => mainWindow?.webContents.send('menu:sortBy', 'date') },
                        { label: 'Name', click: () => mainWindow?.webContents.send('menu:sortBy', 'name') },
                        { label: 'Rating', click: () => mainWindow?.webContents.send('menu:sortBy', 'rating') },
                    ]
                },
                {
                    label: 'Filter By',
                    submenu: [
                        { label: 'Flagged', click: () => mainWindow?.webContents.send('menu:filterBy', 'flagged') },
                        { label: 'Unflagged', click: () => mainWindow?.webContents.send('menu:filterBy', 'unflagged') },
                        { label: 'Clear Filters', click: () => mainWindow?.webContents.send('menu:filterBy', 'none') },
                    ]
                }
            ]
        },
        {
            label: 'Develop',
            submenu: [
                {
                    label: 'Copy Adjustments',
                    accelerator: 'Alt+CmdOrCtrl+C',
                    click: () => mainWindow?.webContents.send('menu:copyAdjustments')
                },
                {
                    label: 'Paste Adjustments',
                    accelerator: 'Alt+CmdOrCtrl+V',
                    click: () => mainWindow?.webContents.send('menu:pasteAdjustments')
                },
                { type: 'separator' },
                {
                    label: 'Sync Settings to Selected',
                    accelerator: 'Shift+CmdOrCtrl+S',
                    click: () => mainWindow?.webContents.send('menu:syncSettings')
                },
                {
                    label: 'Reset All Adjustments',
                    accelerator: 'Shift+CmdOrCtrl+R',
                    click: () => mainWindow?.webContents.send('menu:resetAdjustments')
                },
                {
                    label: 'Revert to Original',
                    click: () => mainWindow?.webContents.send('menu:revertToOriginal')
                },
                { type: 'separator' },
                {
                    label: 'Create Virtual Copy',
                    accelerator: "CmdOrCtrl+'",
                    click: () => mainWindow?.webContents.send('menu:createVirtualCopy')
                },
            ]
        },
        {
            label: 'Metadata',
            submenu: [
                {
                    label: 'Get Info',
                    accelerator: 'CmdOrCtrl+I',
                    click: () => mainWindow?.webContents.send('menu:getInfo')
                },
                { type: 'separator' },
                {
                    label: 'Add Keywords...',
                    accelerator: 'CmdOrCtrl+K',
                    click: () => mainWindow?.webContents.send('menu:addKeywords')
                },
                { type: 'separator' },
                {
                    label: 'Set Rating',
                    submenu: [
                        { label: '0 Stars', accelerator: '0', click: () => mainWindow?.webContents.send('menu:setRating', 0) },
                        { label: '1 Star', accelerator: '1', click: () => mainWindow?.webContents.send('menu:setRating', 1) },
                        { label: '2 Stars', accelerator: '2', click: () => mainWindow?.webContents.send('menu:setRating', 2) },
                        { label: '3 Stars', accelerator: '3', click: () => mainWindow?.webContents.send('menu:setRating', 3) },
                        { label: '4 Stars', accelerator: '4', click: () => mainWindow?.webContents.send('menu:setRating', 4) },
                        { label: '5 Stars', accelerator: '5', click: () => mainWindow?.webContents.send('menu:setRating', 5) },
                    ]
                },
                {
                    label: 'Set Flag',
                    submenu: [
                        { label: 'Pick', accelerator: 'P', click: () => mainWindow?.webContents.send('menu:setFlag', 'pick') },
                        { label: 'Unflagged', accelerator: 'U', click: () => mainWindow?.webContents.send('menu:setFlag', 'none') },
                        { label: 'Reject', accelerator: 'X', click: () => mainWindow?.webContents.send('menu:setFlag', 'reject') },
                    ]
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Show/Hide Library',
                    accelerator: 'CmdOrCtrl+1',
                    click: () => mainWindow?.webContents.send('menu:togglePanel', 'library')
                },
                {
                    label: 'Show/Hide Develop',
                    accelerator: 'CmdOrCtrl+2',
                    click: () => mainWindow?.webContents.send('menu:togglePanel', 'develop')
                },
                {
                    label: 'Show/Hide Filmstrip',
                    accelerator: 'CmdOrCtrl+3',
                    click: () => mainWindow?.webContents.send('menu:togglePanel', 'filmstrip')
                },
                { type: 'separator' },
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+=',
                    click: () => mainWindow?.webContents.send('menu:zoomIn')
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => mainWindow?.webContents.send('menu:zoomOut')
                },
                {
                    label: 'Fit to Window',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => mainWindow?.webContents.send('menu:zoomFit')
                },
                {
                    label: 'Actual Size',
                    accelerator: 'Alt+CmdOrCtrl+0',
                    click: () => mainWindow?.webContents.send('menu:zoomActual')
                },
                { type: 'separator' },
                {
                    label: 'Compare Mode',
                    accelerator: 'C',
                    click: () => mainWindow?.webContents.send('menu:compareMode')
                },
                {
                    label: 'Before/After',
                    accelerator: '\\',
                    click: () => mainWindow?.webContents.send('menu:beforeAfter')
                },
            ]
        },
        { role: 'windowMenu' },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        await shell.openExternal('https://electronjs.org');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
};
