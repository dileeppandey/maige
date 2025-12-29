/**
 * CLIP Analysis Worker
 * Runs CLIP model inference in a separate thread to avoid blocking the main process
 */

import { parentPort, workerData } from 'worker_threads';
import { pipeline, env } from '@huggingface/transformers';
import fs from 'fs';

// Configure cache directory for models (passed from main thread)
const modelsDir = workerData.modelsDir;
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}
env.cacheDir = modelsDir;

// Tag categories for zero-shot classification
const TAG_LABELS = {
    scene: ['indoor', 'outdoor', 'beach', 'mountain', 'city', 'forest', 'home', 'office', 'street'],
    subject: ['person', 'group of people', 'landscape', 'animal', 'food', 'building', 'vehicle', 'nature'],
    activity: ['portrait', 'candid', 'event', 'travel', 'celebration', 'sport', 'work'],
    mood: ['happy', 'calm', 'dramatic', 'vintage', 'colorful', 'dark', 'bright'],
};

const ALL_LABELS = Object.values(TAG_LABELS).flat();

// Singleton pipelines
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let imageClassifier: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let featureExtractor: any = null;

async function initClassifier() {
    if (imageClassifier) return imageClassifier;
    console.log('[CLIP Worker] Loading classifier model...');
    imageClassifier = await pipeline(
        'zero-shot-image-classification',
        'Xenova/clip-vit-base-patch32',
        { device: 'cpu' }
    );
    console.log('[CLIP Worker] Classifier loaded');
    return imageClassifier;
}

async function initFeatureExtractor() {
    if (featureExtractor) return featureExtractor;
    console.log('[CLIP Worker] Loading feature extractor...');
    featureExtractor = await pipeline(
        'image-feature-extraction',
        'Xenova/clip-vit-base-patch32',
        { device: 'cpu' }
    );
    console.log('[CLIP Worker] Feature extractor loaded');
    return featureExtractor;
}

async function generateTags(imagePath: string, topK = 5): Promise<{ tag: string; score: number }[]> {
    const classifier = await initClassifier();
    try {
        const results = await classifier(imagePath, ALL_LABELS);
        const sorted = (results as { label: string; score: number }[])
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .filter(r => r.score > 0.1)
            .map(r => ({ tag: r.label, score: r.score }));
        return sorted;
    } catch (error) {
        console.error('[CLIP Worker] Failed to generate tags:', error);
        return [];
    }
}

async function generateEmbedding(imagePath: string): Promise<number[] | null> {
    const extractor = await initFeatureExtractor();
    try {
        const result = await extractor(imagePath, { pooling: 'mean', normalize: true });
        const embedding = Array.from(result.data as Float32Array);
        return embedding;
    } catch (error) {
        console.error('[CLIP Worker] Failed to generate embedding:', error);
        return null;
    }
}

async function analyzeImage(imagePath: string) {
    const [tags, embedding] = await Promise.all([
        generateTags(imagePath),
        generateEmbedding(imagePath),
    ]);
    return { tags, embedding };
}

// Listen for messages from main thread
parentPort?.on('message', async (message) => {
    if (message.type === 'analyze') {
        const { imagePath, imageId } = message;
        try {
            const result = await analyzeImage(imagePath);
            parentPort?.postMessage({
                type: 'result',
                success: true,
                imageId,
                imagePath,
                tags: result.tags,
                embedding: result.embedding
            });
        } catch (error) {
            parentPort?.postMessage({
                type: 'result',
                success: false,
                imageId,
                imagePath,
                error: String(error)
            });
        }
    } else if (message.type === 'preload') {
        await Promise.all([initClassifier(), initFeatureExtractor()]);
        parentPort?.postMessage({ type: 'preloaded' });
    }
});

// Signal ready
parentPort?.postMessage({ type: 'ready' });
