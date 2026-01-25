/**
 * Native Rust Module Wrapper
 * 
 * This module provides a friendly interface to the native Rust maige-core library.
 * Falls back to JavaScript implementations if the native module fails to load.
 */

import path from 'path';
import { fileURLToPath } from 'url';

// Types from the native module
export interface JsLightAdjustments {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    whites: number;
    blacks: number;
}

export interface JsColorAdjustments {
    temperature: number;
    tint: number;
    saturation: number;
    vibrance: number;
}

export interface JsAdjustments {
    light: JsLightAdjustments;
    color: JsColorAdjustments;
}

export interface JsHistogram {
    r: number[];
    g: number[];
    b: number[];
    lum: number[];
}

export interface JsPHash {
    hash: string;
    bits: number;
}

// Native module interface
interface NativeModule {
    NativeImageProcessor: new () => {
        load(path: string): void;
        isLoaded(): boolean;
        dimensions(): number[] | null;
        process(adjustments: JsAdjustments): Buffer;
        histogram(adjustments: JsAdjustments): JsHistogram;
        phash(): JsPHash;
        dhash(): string;
        originalRgba(): Buffer;
    };
    generateDhashFromFile(path: string): string;
    calculateHammingDistance(hash1: string, hash2: string): number;
    areDuplicates(hash1: string, hash2: string, threshold?: number): boolean;
    applyAdjustmentsToBuffer(buffer: Buffer, width: number, height: number, adjustments: JsAdjustments): Buffer;
    generateHistogramFromBuffer(buffer: Buffer): JsHistogram;
}

// Try to load the native module
let nativeModule: NativeModule | null = null;
let nativeModuleError: Error | null = null;

try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // The native module is in rust/maige-core relative to project root
    const nativeModulePath = path.join(__dirname, '..', 'rust', 'maige-core');
    nativeModule = await import(nativeModulePath) as NativeModule;
    console.log('✅ Native Rust module loaded successfully');
} catch (error) {
    nativeModuleError = error as Error;
    console.warn('⚠️ Native Rust module not available, using JavaScript fallback:', (error as Error).message);
}

/**
 * Check if native module is available
 */
export function isNativeModuleAvailable(): boolean {
    return nativeModule !== null;
}

/**
 * Get the native module load error if any
 */
export function getNativeModuleError(): Error | null {
    return nativeModuleError;
}

/**
 * Generate dHash (difference hash) for an image file
 * Uses native Rust implementation if available, otherwise falls back to JS
 */
export async function generateDHash(imagePath: string): Promise<string> {
    if (nativeModule) {
        try {
            return nativeModule.generateDhashFromFile(imagePath);
        } catch (error) {
            console.error('Native dHash failed, falling back to JS:', error);
        }
    }

    // Fallback to JavaScript implementation (imported from imageAnalyzer)
    const { generatePHash } = await import('./imageAnalyzer.js');
    return generatePHash(imagePath);
}

/**
 * Calculate Hamming distance between two hashes
 */
export function hammingDistance(hash1: string, hash2: string): number {
    if (nativeModule) {
        try {
            return nativeModule.calculateHammingDistance(hash1, hash2);
        } catch (error) {
            console.error('Native hammingDistance failed, falling back to JS:', error);
        }
    }

    // Fallback to JavaScript implementation
    if (hash1.length !== hash2.length) return 64;

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
 * Check if two images are duplicates based on hash distance
 */
export function areDuplicates(hash1: string, hash2: string, threshold = 10): boolean {
    if (nativeModule) {
        try {
            return nativeModule.areDuplicates(hash1, hash2, threshold);
        } catch (error) {
            console.error('Native areDuplicates failed, falling back to JS:', error);
        }
    }

    return hammingDistance(hash1, hash2) <= threshold;
}

/**
 * Apply adjustments to an RGBA buffer using native Rust
 * Returns null if native module is not available
 */
export function applyAdjustmentsNative(
    buffer: Buffer,
    width: number,
    height: number,
    adjustments: JsAdjustments
): Buffer | null {
    if (!nativeModule) {
        return null;
    }

    try {
        return nativeModule.applyAdjustmentsToBuffer(buffer, width, height, adjustments);
    } catch (error) {
        console.error('Native applyAdjustments failed:', error);
        return null;
    }
}

/**
 * Generate histogram from RGBA buffer using native Rust
 * Returns null if native module is not available
 */
export function generateHistogramNative(buffer: Buffer): JsHistogram | null {
    if (!nativeModule) {
        return null;
    }

    try {
        return nativeModule.generateHistogramFromBuffer(buffer);
    } catch (error) {
        console.error('Native generateHistogram failed:', error);
        return null;
    }
}

/**
 * Create a native image processor instance
 * Returns null if native module is not available
 */
export function createNativeProcessor() {
    if (!nativeModule) {
        return null;
    }

    return new nativeModule.NativeImageProcessor();
}

// Export the native module directly for advanced usage
export { nativeModule };
