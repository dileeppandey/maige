/**
 * Face Detection Hook
 * Listens for face detection requests from main process after import,
 * runs MediaPipe face detection, and sends results back.
 */

import { useEffect, useRef, useState } from 'react';
import { detectFacesFromUrl, preloadFaceDetector } from '../processing/faceDetector';

interface FaceDetectionStatus {
    isProcessing: boolean;
    current: number;
    total: number;
    currentFile: string;
}

export function useFaceDetection() {
    const [status, setStatus] = useState<FaceDetectionStatus>({
        isProcessing: false,
        current: 0,
        total: 0,
        currentFile: '',
    });
    const isInitialized = useRef(false);

    useEffect(() => {
        // Preload the face detector on mount
        if (!isInitialized.current) {
            isInitialized.current = true;
            preloadFaceDetector().catch(err => {
                console.error('Failed to preload face detector:', err);
            });
        }

        // Listen for face detection requests from main process
        const cleanup = window.electronAPI.onStartFaceDetection(async (data) => {
            console.log('Face detection requested for', data.imagePaths.length, 'images');

            setStatus({
                isProcessing: true,
                current: 0,
                total: data.imagePaths.length,
                currentFile: '',
            });

            for (let i = 0; i < data.imagePaths.length; i++) {
                const { filePath, fileName } = data.imagePaths[i];

                setStatus(prev => ({
                    ...prev,
                    current: i + 1,
                    currentFile: fileName,
                }));

                try {
                    // Convert file path to media:// URL for browser loading
                    const mediaUrl = `media://${encodeURIComponent(filePath)}`;

                    // Detect faces using MediaPipe
                    const detections = await detectFacesFromUrl(mediaUrl);

                    if (detections.length > 0) {
                        console.log(`Found ${detections.length} face(s) in ${fileName}`);

                        // Get image ID from database
                        const images = await window.electronAPI.getLibraryImages();
                        const imageRecord = images.find(img => img.file_path === filePath);

                        if (imageRecord) {
                            // Send face detections to main process for storage
                            const results = await window.electronAPI.saveFaceDetections(
                                imageRecord.id,
                                filePath,
                                detections
                            );
                            console.log(`Saved ${results.length} faces for ${fileName}`);
                        }
                    }
                } catch (error) {
                    console.error(`Face detection failed for ${fileName}:`, error);
                }
            }

            setStatus({
                isProcessing: false,
                current: data.imagePaths.length,
                total: data.imagePaths.length,
                currentFile: '',
            });

            console.log('Face detection complete');
        });

        return cleanup;
    }, []);

    return status;
}
