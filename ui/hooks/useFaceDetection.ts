import { useEffect, useRef, useState } from 'react';

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
    // Prevent concurrent runs if a batch is already in-flight
    const isRunning = useRef(false);

    useEffect(() => {
        const cleanup = window.api.onFaceDetectionPending(async (data) => {
            if (isRunning.current) return;
            isRunning.current = true;

            const images = data.images;
            setStatus({ isProcessing: true, current: 0, total: images.length, currentFile: '' });

            for (let i = 0; i < images.length; i++) {
                const { id, file_path } = images[i];
                const fileName = file_path.split(/[\\/]/).pop() ?? file_path;

                setStatus(prev => ({ ...prev, current: i + 1, currentFile: fileName }));

                try {
                    await window.api.detectAndEmbedFaces(id, file_path);
                } catch (err) {
                    console.error(`Face detection failed for ${fileName}:`, err);
                }
            }

            setStatus({ isProcessing: false, current: images.length, total: images.length, currentFile: '' });
            isRunning.current = false;
        });

        return cleanup;
    }, []);

    return status;
}
