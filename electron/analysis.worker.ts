import { parentPort, workerData } from 'worker_threads';
import { extractMetadata, generatePHash, calculateFileHash } from './imageAnalyzer.js';

async function run() {
    const { filePath } = workerData;

    try {
        const metadata = await extractMetadata(filePath);
        const phash = await generatePHash(filePath);
        const fileHash = await calculateFileHash(filePath);

        parentPort?.postMessage({
            success: true,
            filePath,
            metadata,
            phash,
            fileHash
        });
    } catch (error) {
        parentPort?.postMessage({
            success: false,
            filePath,
            error: String(error)
        });
    }
}

run();
