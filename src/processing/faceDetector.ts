/**
 * MediaPipe Face Detector for the renderer process
 * Detects faces in images using Google MediaPipe
 */

import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceDetection } from '../../shared/types';

let detector: FaceDetector | null = null;
let isInitializing = false;

/**
 * Initialize the face detector
 */
export async function initFaceDetector(): Promise<FaceDetector> {
    if (detector) return detector;
    if (isInitializing) {
        // Wait for initialization to complete
        while (isInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (detector) return detector;
    }

    isInitializing = true;
    try {
        console.log('Loading MediaPipe Face Detector...');

        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
                delegate: 'GPU',
            },
            runningMode: 'IMAGE',
            minDetectionConfidence: 0.5,
            minSuppressionThreshold: 0.3,
        });

        console.log('MediaPipe Face Detector loaded');
        return detector;
    } finally {
        isInitializing = false;
    }
}

/**
 * Detect faces in an image element
 */
export async function detectFacesInImage(imageElement: HTMLImageElement): Promise<FaceDetection[]> {
    const faceDetector = await initFaceDetector();

    const result = faceDetector.detect(imageElement);

    // Convert MediaPipe results to our format
    return result.detections.map(detection => {
        const bbox = detection.boundingBox!;
        const imgWidth = imageElement.naturalWidth;
        const imgHeight = imageElement.naturalHeight;

        return {
            bbox: {
                // Normalize coordinates to 0-1 range
                x: bbox.originX / imgWidth,
                y: bbox.originY / imgHeight,
                width: bbox.width / imgWidth,
                height: bbox.height / imgHeight,
            },
            keypoints: detection.keypoints?.map(kp => ({
                x: kp.x,
                y: kp.y,
                name: (kp as { name?: string }).name || 'unknown',
            })),
            confidence: detection.categories?.[0]?.score ?? 0,
        };
    });
}

/**
 * Detect faces from an image URL
 */
export async function detectFacesFromUrl(imageUrl: string): Promise<FaceDetection[]> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = async () => {
            try {
                const faces = await detectFacesInImage(img);
                resolve(faces);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            reject(new Error(`Failed to load image: ${imageUrl}`));
        };

        img.src = imageUrl;
    });
}

/**
 * Check if face detector is ready
 */
export function isFaceDetectorReady(): boolean {
    return detector !== null;
}

/**
 * Preload the face detector (call during app init)
 */
export async function preloadFaceDetector(): Promise<void> {
    await initFaceDetector();
}
