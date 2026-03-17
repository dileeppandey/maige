import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Convert a local file path to a URL the webview can load.
 * Uses Tauri's asset protocol.
 */
export function assetUrl(filePath: string, cacheBuster?: string | number): string {
    const url = convertFileSrc(filePath);
    if (cacheBuster !== undefined && cacheBuster !== null) {
        return `${url}?v=${cacheBuster}`;
    }
    return url;
}
