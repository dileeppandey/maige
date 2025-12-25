import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { pathToFileURL, fileURLToPath } from 'url';
import sharp from 'sharp';
const __dirname = path.dirname(fileURLToPath(import.meta.url));



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

const createWindow = () => {
    // Create the browser window.
    console.log('Preload path:', path.join(__dirname, 'preload.js'));
    const mainWindow = new BrowserWindow({
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
};

app.whenReady().then(() => {
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
