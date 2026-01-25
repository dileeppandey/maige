import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import exifReader from 'exif-reader';
import { Worker } from 'worker_threads';
import os from 'os';
import { fileURLToPath } from 'url';
import {
    generateDHash as nativeGenerateDHash,
    hammingDistance as nativeHammingDistance,
    areDuplicates as nativeAreDuplicates,
    isNativeModuleAvailable
} from './nativeModule.js';

// Image extensions we support
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|bmp|tiff|tif|cr2|arw|dng|nef|orf|rw2)$/i;

export interface ImageMetadata {
    width: number;
    height: number;
    format: string;
    colorSpace?: string;
    colorProfile?: string;
    hasAlpha?: boolean;
    dateTaken?: string;
    cameraMake?: string;
    cameraModel?: string;
    focalLength?: number;
    aperture?: number;
    iso?: number;
    shutterSpeed?: string;
    exposureProgram?: string;
    meteringMode?: string;
    flash?: string;
    whiteBalance?: string;
    gpsLat?: number;
    gpsLng?: number;
}

export interface AnalyzedImage {
    filePath: string;
    fileName: string;
    fileSize: number;
    fileHash: string;
    metadata: ImageMetadata;
    phash: string;
}

/**
 * Generate a perceptual hash for an image
 * Uses native Rust dHash implementation if available (10x faster)
 * Falls back to JavaScript/Sharp implementation otherwise
 */
export async function generatePHash(imagePath: string): Promise<string> {
    // Try native Rust implementation first (much faster)
    if (isNativeModuleAvailable()) {
        try {
            return await nativeGenerateDHash(imagePath);
        } catch (error) {
            console.warn('Native dHash failed, falling back to JS:', error);
        }
    }

    // Fallback to JavaScript/Sharp implementation
    try {
        // Resize to 9x8 grayscale for dHash
        const buffer = await sharp(imagePath)
            .greyscale()
            .resize(9, 8, { fit: 'fill' })
            .raw()
            .toBuffer();

        // Generate difference hash
        let hash = '';
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const left = buffer[y * 9 + x];
                const right = buffer[y * 9 + x + 1];
                hash += left < right ? '1' : '0';
            }
        }

        // Convert binary string to hex
        const hexHash = parseInt(hash, 2).toString(16).padStart(16, '0');
        return hexHash;
    } catch (error) {
        console.error('Failed to generate pHash for:', imagePath, error);
        return '';
    }
}

/**
 * Extract metadata from an image using sharp and exif-reader
 */
export async function extractMetadata(imagePath: string): Promise<ImageMetadata> {
    const metadata = await sharp(imagePath).metadata();

    let dateTaken: string | undefined;
    let cameraMake: string | undefined;
    let cameraModel: string | undefined;
    let focalLength: number | undefined;
    let aperture: number | undefined;
    let iso: number | undefined;
    let shutterSpeed: string | undefined;
    let exposureProgram: string | undefined;
    let meteringMode: string | undefined;
    let flash: string | undefined;
    let whiteBalance: string | undefined;
    let gpsLat: number | undefined;
    let gpsLng: number | undefined;

    // Extract EXIF data if available
    if (metadata.exif) {
        try {
            const exif = exifReader(metadata.exif);

            // Image/Photo data
            if (exif.Image) {
                cameraMake = exif.Image.Make;
                cameraModel = exif.Image.Model;
            }

            if (exif.Photo) {
                // Date taken
                if (exif.Photo.DateTimeOriginal) {
                    dateTaken = exif.Photo.DateTimeOriginal instanceof Date
                        ? exif.Photo.DateTimeOriginal.toISOString()
                        : String(exif.Photo.DateTimeOriginal);
                }

                // Camera settings
                if (exif.Photo.FocalLength) {
                    focalLength = Number(exif.Photo.FocalLength);
                }
                if (exif.Photo.FNumber) {
                    aperture = Number(exif.Photo.FNumber);
                }
                if (exif.Photo.ISOSpeedRatings) {
                    iso = Array.isArray(exif.Photo.ISOSpeedRatings)
                        ? exif.Photo.ISOSpeedRatings[0]
                        : Number(exif.Photo.ISOSpeedRatings);
                }
                if (exif.Photo.ExposureTime) {
                    const expTime = Number(exif.Photo.ExposureTime);
                    if (expTime < 1) {
                        shutterSpeed = `1/${Math.round(1 / expTime)}`;
                    } else {
                        shutterSpeed = `${expTime}s`;
                    }
                }

                // Exposure program
                const exposurePrograms: Record<number, string> = {
                    0: 'Unknown', 1: 'Manual', 2: 'Normal', 3: 'Aperture Priority',
                    4: 'Shutter Priority', 5: 'Creative', 6: 'Action', 7: 'Portrait', 8: 'Landscape'
                };
                if (exif.Photo.ExposureProgram !== undefined) {
                    exposureProgram = exposurePrograms[exif.Photo.ExposureProgram] || 'Unknown';
                }

                // Metering mode
                const meteringModes: Record<number, string> = {
                    0: 'Unknown', 1: 'Average', 2: 'Center-weighted', 3: 'Spot',
                    4: 'Multi-spot', 5: 'Pattern', 6: 'Partial'
                };
                if (exif.Photo.MeteringMode !== undefined) {
                    meteringMode = meteringModes[exif.Photo.MeteringMode] || 'Unknown';
                }

                // Flash
                if (exif.Photo.Flash !== undefined) {
                    const flashFired = (exif.Photo.Flash & 1) === 1;
                    flash = flashFired ? 'Fired' : 'No Flash';
                }

                // White balance
                if (exif.Photo.WhiteBalance !== undefined) {
                    whiteBalance = exif.Photo.WhiteBalance === 0 ? 'Auto' : 'Manual';
                }
            }

            // GPS data
            if (exif.GPSInfo) {
                if (exif.GPSInfo.GPSLatitude && exif.GPSInfo.GPSLatitudeRef) {
                    const lat = exif.GPSInfo.GPSLatitude;
                    if (Array.isArray(lat) && lat.length === 3) {
                        gpsLat = lat[0] + lat[1] / 60 + lat[2] / 3600;
                        if (exif.GPSInfo.GPSLatitudeRef === 'S') gpsLat = -gpsLat;
                    }
                }
                if (exif.GPSInfo.GPSLongitude && exif.GPSInfo.GPSLongitudeRef) {
                    const lng = exif.GPSInfo.GPSLongitude;
                    if (Array.isArray(lng) && lng.length === 3) {
                        gpsLng = lng[0] + lng[1] / 60 + lng[2] / 3600;
                        if (exif.GPSInfo.GPSLongitudeRef === 'W') gpsLng = -gpsLng;
                    }
                }
            }
        } catch (error) {
            console.error('EXIF parsing error:', error);
            // Fallback to file modification time
            try {
                const stats = await fs.stat(imagePath);
                dateTaken = stats.mtime.toISOString();
            } catch {
                // Ignore
            }
        }
    } else {
        // No EXIF, use file modification time as fallback
        try {
            const stats = await fs.stat(imagePath);
            dateTaken = stats.mtime.toISOString();
        } catch {
            // Ignore
        }
    }

    return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        colorSpace: metadata.space,
        colorProfile: metadata.icc ? 'ICC Profile' : undefined,
        hasAlpha: metadata.hasAlpha,
        dateTaken,
        cameraMake,
        cameraModel,
        focalLength,
        aperture,
        iso,
        shutterSpeed,
        exposureProgram,
        meteringMode,
        flash,
        whiteBalance,
        gpsLat,
        gpsLng,
    };
}

/**
 * Calculate file hash (SHA256)
 */
export async function calculateFileHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Analyze a single image
 */
export async function analyzeImage(imagePath: string): Promise<AnalyzedImage> {
    const stats = await fs.stat(imagePath);
    const fileName = path.basename(imagePath);

    const [metadata, phash, fileHash] = await Promise.all([
        extractMetadata(imagePath),
        generatePHash(imagePath),
        calculateFileHash(imagePath),
    ]);

    return {
        filePath: imagePath,
        fileName,
        fileSize: stats.size,
        fileHash,
        metadata,
        phash,
    };
}

/**
 * Recursively scan a directory for images
 */
export async function scanDirectoryRecursive(dirPath: string): Promise<string[]> {
    const images: string[] = [];

    async function scanDir(currentPath: string): Promise<void> {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);

            if (entry.isDirectory()) {
                // Skip hidden directories
                if (!entry.name.startsWith('.')) {
                    await scanDir(fullPath);
                }
            } else if (entry.isFile() && IMAGE_EXTENSIONS.test(entry.name)) {
                images.push(fullPath);
            }
        }
    }

    await scanDir(dirPath);
    return images;
}

/**
 * Analyze multiple images with worker threads for parallelization
 */
export async function analyzeImages(
    imagePaths: string[],
    onProgress?: (current: number, total: number, file: string) => void
): Promise<AnalyzedImage[]> {
    const results: AnalyzedImage[] = [];
    const total = imagePaths.length;

    if (total === 0) return [];

    // Use available CPU cores, but cap it to avoid overwhelming disk I/O
    const numWorkers = Math.min(os.cpus().length, 8);
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const workerPath = path.join(__dirname, 'analysis.worker.js');

    console.log(`Starting analysis with ${numWorkers} workers...`);

    return new Promise((resolve) => {
        let currentIndex = 0;
        let completedCount = 0;

        const spawnWorker = () => {
            if (currentIndex >= imagePaths.length) {
                if (completedCount === total) {
                    resolve(results);
                }
                return;
            }

            const filePath = imagePaths[currentIndex++];
            const fileName = path.basename(filePath);
            const worker = new Worker(workerPath, {
                workerData: { filePath }
            });

            worker.on('message', async (message) => {
                if (message.success) {
                    try {
                        const stats = await fs.stat(filePath);
                        results.push({
                            filePath: message.filePath,
                            fileName: fileName,
                            fileSize: stats.size,
                            fileHash: message.fileHash,
                            metadata: message.metadata,
                            phash: message.phash
                        });
                    } catch (e) {
                        console.error('Failed to get stats for:', filePath, e);
                    }
                } else {
                    console.error(`Worker failed for ${filePath}:`, message.error);
                }

                completedCount++;
                onProgress?.(completedCount, total, filePath);

                if (completedCount === total) {
                    resolve(results);
                } else {
                    spawnWorker();
                }

                worker.terminate();
            });

            worker.on('error', (err) => {
                console.error('Worker error:', err);
                completedCount++;
                onProgress?.(completedCount, total, filePath);
                if (completedCount === total) resolve(results);
                else spawnWorker();
                worker.terminate();
            });
        };

        // Start initial batch of workers
        for (let i = 0; i < Math.min(numWorkers, total); i++) {
            spawnWorker();
        }
    });
}

/**
 * Calculate Hamming distance between two phashes
 * Uses native Rust implementation if available
 * Returns 0 for identical, higher values for more different
 */
export function hammingDistance(hash1: string, hash2: string): number {
    // Use native implementation if available
    if (isNativeModuleAvailable()) {
        try {
            return nativeHammingDistance(hash1, hash2);
        } catch (error) {
            console.warn('Native hammingDistance failed, falling back to JS:', error);
        }
    }

    // Fallback to JavaScript implementation
    if (hash1.length !== hash2.length) return 64; // Max distance

    let distance = 0;
    const n1 = BigInt('0x' + hash1);
    const n2 = BigInt('0x' + hash2);
    let xor = n1 ^ n2;

    while (xor > 0n) {
        distance += Number(xor & 1n);
        xor >>= 1n;
    }

    return distance;
}

/**
 * Check if two images are considered duplicates
 * Uses native Rust implementation if available
 * Threshold of 10 means images with <= 10 bit differences are duplicates
 */
export function areDuplicates(hash1: string, hash2: string, threshold = 10): boolean {
    // Use native implementation if available
    if (isNativeModuleAvailable()) {
        try {
            return nativeAreDuplicates(hash1, hash2, threshold);
        } catch (error) {
            console.warn('Native areDuplicates failed, falling back to JS:', error);
        }
    }

    return hammingDistance(hash1, hash2) <= threshold;
}
