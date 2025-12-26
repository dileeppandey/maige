import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
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
} from './database.js';
import {
    scanDirectoryRecursive,
    analyzeImages,
} from './imageAnalyzer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
                date_taken: img.metadata.dateTaken || null,
                camera_make: img.metadata.cameraMake || null,
                camera_model: img.metadata.cameraModel || null,
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
 * Get all images in the library
 */
ipcMain.handle('library:getImages', async () => {
    try {
        return getAllImages();
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
        const filePath = request.url.slice('media://'.length);
        const decodedPath = decodeURIComponent(filePath);

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
