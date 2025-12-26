/**
 * CLIP Service for image embeddings and zero-shot classification
 * Uses @huggingface/transformers for local inference
 */

import { pipeline, env } from '@huggingface/transformers';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// Configure cache directory for models
const modelsDir = path.join(app.getPath('userData'), 'models');
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}
env.cacheDir = modelsDir;

// Singleton pipelines (use 'any' to avoid complex union types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let imageClassifier: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let featureExtractor: any = null;

// Tag categories for zero-shot classification
export const TAG_LABELS = {
    scene: ['indoor', 'outdoor', 'beach', 'mountain', 'city', 'forest', 'home', 'office', 'street'],
    subject: ['person', 'group of people', 'landscape', 'animal', 'food', 'building', 'vehicle', 'nature'],
    activity: ['portrait', 'candid', 'event', 'travel', 'celebration', 'sport', 'work'],
    mood: ['happy', 'calm', 'dramatic', 'vintage', 'colorful', 'dark', 'bright'],
};

// Flatten all labels for classification
const ALL_LABELS = Object.values(TAG_LABELS).flat();

/**
 * Initialize the zero-shot image classifier
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initClassifier(): Promise<any> {
    if (imageClassifier) return imageClassifier;

    console.log('Loading CLIP classifier model...');
    imageClassifier = await pipeline(
        'zero-shot-image-classification',
        'Xenova/clip-vit-base-patch32',
        { device: 'cpu' } // Use CPU for compatibility
    );
    console.log('CLIP classifier loaded');

    return imageClassifier;
}

/**
 * Initialize the feature extractor for embeddings
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initFeatureExtractor(): Promise<any> {
    if (featureExtractor) return featureExtractor;

    console.log('Loading CLIP feature extractor...');
    featureExtractor = await pipeline(
        'image-feature-extraction',
        'Xenova/clip-vit-base-patch32',
        { device: 'cpu' }
    );
    console.log('CLIP feature extractor loaded');

    return featureExtractor;
}

/**
 * Generate tags for an image using zero-shot classification
 */
export async function generateTags(
    imagePath: string,
    topK = 5
): Promise<{ tag: string; score: number }[]> {
    const classifier = await initClassifier();

    try {
        const results = await classifier(imagePath, ALL_LABELS);

        // Sort by score and take top K
        const sorted = (results as { label: string; score: number }[])
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .filter(r => r.score > 0.1) // Only include tags with decent confidence
            .map(r => ({ tag: r.label, score: r.score }));

        return sorted;
    } catch (error) {
        console.error('Failed to generate tags for:', imagePath, error);
        return [];
    }
}

/**
 * Generate image embedding (512-dim vector)
 */
export async function generateEmbedding(imagePath: string): Promise<number[] | null> {
    const extractor = await initFeatureExtractor();

    try {
        const result = await extractor(imagePath, { pooling: 'mean', normalize: true });

        // Extract the embedding array
        const embedding = Array.from(result.data as Float32Array);
        return embedding;
    } catch (error) {
        console.error('Failed to generate embedding for:', imagePath, error);
        return null;
    }
}

/**
 * Generate text embedding for semantic search
 */
export async function generateTextEmbedding(text: string): Promise<number[] | null> {
    // For text embeddings, we need a text feature extraction pipeline
    // CLIP uses the same model for both, but different input processing
    try {
        const textPipeline = await pipeline(
            'feature-extraction',
            'Xenova/clip-vit-base-patch32',
            { device: 'cpu' }
        );

        const result = await textPipeline(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(result.data as Float32Array);
        return embedding;
    } catch (error) {
        console.error('Failed to generate text embedding:', error);
        return null;
    }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Analyze an image: generate both tags and embedding
 */
export async function analyzeImageWithCLIP(imagePath: string): Promise<{
    tags: { tag: string; score: number }[];
    embedding: number[] | null;
}> {
    // Run both in parallel
    const [tags, embedding] = await Promise.all([
        generateTags(imagePath),
        generateEmbedding(imagePath),
    ]);

    return { tags, embedding };
}

/**
 * Check if CLIP models are loaded
 */
export function isModelLoaded(): boolean {
    return imageClassifier !== null;
}

/**
 * Preload models (call during app init if desired)
 */
export async function preloadModels(): Promise<void> {
    await Promise.all([initClassifier(), initFeatureExtractor()]);
}
