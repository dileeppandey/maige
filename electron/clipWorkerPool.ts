/**
 * CLIP Worker Pool Manager
 * Manages a pool of CLIP workers for parallel AI analysis
 */

import { Worker } from 'worker_threads';
import { app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

interface ClipTask {
    imageId: number;
    imagePath: string;
    resolve: (result: ClipResult) => void;
    reject: (error: Error) => void;
}

interface ClipResult {
    imageId: number;
    imagePath: string;
    tags: { tag: string; score: number }[];
    embedding: number[] | null;
    success: boolean;
    error?: string;
}

class ClipWorkerPool {
    private worker: Worker | null = null;
    private taskQueue: ClipTask[] = [];
    private isProcessing = false;
    private isReady = false;
    private modelsDir: string;
    private workerPath: string;

    constructor() {
        this.modelsDir = path.join(app.getPath('userData'), 'models');
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        this.workerPath = path.join(__dirname, 'clip.worker.js');
    }

    private initWorker(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.worker && this.isReady) {
                resolve();
                return;
            }

            console.log('[ClipPool] Initializing CLIP worker...');
            this.worker = new Worker(this.workerPath, {
                workerData: { modelsDir: this.modelsDir }
            });

            this.worker.on('message', (message) => {
                if (message.type === 'ready') {
                    console.log('[ClipPool] Worker is ready');
                    this.isReady = true;
                    resolve();
                } else if (message.type === 'preloaded') {
                    console.log('[ClipPool] Models preloaded');
                } else if (message.type === 'result') {
                    this.handleResult(message);
                }
            });

            this.worker.on('error', (err) => {
                console.error('[ClipPool] Worker error:', err);
                reject(err);
            });

            this.worker.on('exit', (code) => {
                console.log('[ClipPool] Worker exited with code:', code);
                this.worker = null;
                this.isReady = false;
            });
        });
    }

    private handleResult(message: { success: boolean; imageId: number; imagePath: string; tags?: { tag: string; score: number }[]; embedding?: number[] | null; error?: string }) {
        this.isProcessing = false;

        // Find and resolve the corresponding task
        const taskIndex = this.taskQueue.findIndex(t => t.imagePath === message.imagePath);
        if (taskIndex !== -1) {
            const task = this.taskQueue.splice(taskIndex, 1)[0];
            if (message.success) {
                task.resolve({
                    imageId: message.imageId,
                    imagePath: message.imagePath,
                    tags: message.tags || [],
                    embedding: message.embedding || null,
                    success: true
                });
            } else {
                task.resolve({
                    imageId: message.imageId,
                    imagePath: message.imagePath,
                    tags: [],
                    embedding: null,
                    success: false,
                    error: message.error
                });
            }
        }

        // Process next task in queue
        this.processNext();
    }

    private processNext() {
        if (this.isProcessing || this.taskQueue.length === 0 || !this.worker) {
            return;
        }

        const task = this.taskQueue[0]; // Don't remove yet, will remove when result comes
        this.isProcessing = true;

        this.worker.postMessage({
            type: 'analyze',
            imageId: task.imageId,
            imagePath: task.imagePath
        });
    }

    async analyze(imageId: number, imagePath: string): Promise<ClipResult> {
        await this.initWorker();

        return new Promise((resolve, reject) => {
            this.taskQueue.push({ imageId, imagePath, resolve, reject });
            this.processNext();
        });
    }

    async preloadModels(): Promise<void> {
        await this.initWorker();
        this.worker?.postMessage({ type: 'preload' });
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isReady = false;
        }
    }
}

// Singleton instance
export const clipWorkerPool = new ClipWorkerPool();

/**
 * Analyze an image with CLIP using the worker pool
 */
export async function analyzeImageWithCLIPWorker(imageId: number, imagePath: string): Promise<ClipResult> {
    return clipWorkerPool.analyze(imageId, imagePath);
}

/**
 * Preload CLIP models in worker
 */
export async function preloadCLIPModels(): Promise<void> {
    return clipWorkerPool.preloadModels();
}
