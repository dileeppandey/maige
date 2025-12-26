import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

// Image extensions we support
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|bmp|tiff|tif|cr2|arw|dng|nef|orf|rw2)$/i;

export interface ImageMetadata {
    width: number;
    height: number;
    format: string;
    dateTaken?: string;
    cameraMake?: string;
    cameraModel?: string;
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
 * Uses a simplified dHash (difference hash) algorithm
 */
export async function generatePHash(imagePath: string): Promise<string> {
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
 * Extract metadata from an image using sharp
 */
export async function extractMetadata(imagePath: string): Promise<ImageMetadata> {
    const metadata = await sharp(imagePath).metadata();

    let dateTaken: string | undefined;
    let cameraMake: string | undefined;
    let cameraModel: string | undefined;
    let gpsLat: number | undefined;
    let gpsLng: number | undefined;

    // Extract EXIF data if available
    if (metadata.exif) {
        try {
            // Sharp doesn't parse EXIF directly, we'd need exif-reader
            // For now, we'll use file modification time as fallback
            const stats = await fs.stat(imagePath);
            dateTaken = stats.mtime.toISOString();
        } catch {
            // Ignore EXIF parsing errors
        }
    }

    return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        dateTaken,
        cameraMake,
        cameraModel,
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
 * Analyze multiple images with progress reporting
 */
export async function analyzeImages(
    imagePaths: string[],
    onProgress?: (current: number, total: number, file: string) => void
): Promise<AnalyzedImage[]> {
    const results: AnalyzedImage[] = [];
    const total = imagePaths.length;

    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 10;

    for (let i = 0; i < imagePaths.length; i += BATCH_SIZE) {
        const batch = imagePaths.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
            batch.map(async (imagePath, idx) => {
                try {
                    const result = await analyzeImage(imagePath);
                    onProgress?.(i + idx + 1, total, imagePath);
                    return result;
                } catch (error) {
                    console.error('Failed to analyze image:', imagePath, error);
                    onProgress?.(i + idx + 1, total, imagePath);
                    return null;
                }
            })
        );

        results.push(...batchResults.filter((r): r is AnalyzedImage => r !== null));
    }

    return results;
}

/**
 * Calculate Hamming distance between two phashes
 * Returns 0 for identical, higher values for more different
 */
export function hammingDistance(hash1: string, hash2: string): number {
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
 * Threshold of 10 means images with <= 10 bit differences are duplicates
 */
export function areDuplicates(hash1: string, hash2: string, threshold = 10): boolean {
    return hammingDistance(hash1, hash2) <= threshold;
}
