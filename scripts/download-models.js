#!/usr/bin/env node
// Cross-platform model + runtime downloader. Requires Node 18+ (uses built-in fetch).
// Run once before first build: npm run download-models
//
// Downloads:
//   face_det.onnx     — Ultraface RFB-320   (~1.1 MB, Apache 2.0)
//   face_emb.onnx     — OpenCV Zoo SFace    (~37 MB,  Apache 2.0)
//   onnxruntime.dll   — ONNX Runtime 1.24.1 (~7 MB,   MIT)
//     Required because ort crate uses load-dynamic on Windows to avoid
//     MSVC STL symbol incompatibilities in the pre-built static .lib.

import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, copyFileSync, unlinkSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDir = path.join(__dirname, '..', 'crates', 'maige-tauri', 'models');

mkdirSync(modelsDir, { recursive: true });

// ORT 1.24.1 prebuilt for Windows x64 (ort-sys 2.0.0-rc.12 targets ORT 1.24.x)
const ORT_VERSION = '1.24.1';
const ORT_DLL_URL = `https://github.com/microsoft/onnxruntime/releases/download/v${ORT_VERSION}/onnxruntime-win-x64-${ORT_VERSION}.zip`;

const MODELS = [
    {
        name: 'face_det.onnx (SCRFD Face Detection with Landmarks)',
        dest: path.join(modelsDir, 'face_det.onnx'),
        url: 'https://huggingface.co/WePrompt/buffalo_sc/resolve/main/det_500m.onnx',
    },
    {
        name: 'face_emb.onnx (ArcFace State-of-the-Art Recognition)',
        dest: path.join(modelsDir, 'face_emb.onnx'),
        url: 'https://huggingface.co/maze/faceX/resolve/main/w600k_r50.onnx',
    },
];

async function downloadFile(url, dest, label) {
    console.log(`Downloading ${label} ...`);
    const tmp = dest + '.tmp';

    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching: ${url}`);

    const total = parseInt(res.headers.get('content-length') || '0', 10);
    let received = 0;

    const out = createWriteStream(tmp);
    const stream = Readable.fromWeb(res.body);
    stream.on('data', chunk => {
        received += chunk.length;
        if (total > 0) {
            const pct = Math.round((received / total) * 100);
            process.stdout.write(`\r  ${pct}% (${(received / 1e6).toFixed(1)} MB)`);
        }
    });

    try {
        await pipeline(stream, out);
        process.stdout.write('\n');
        renameSync(tmp, dest);
        console.log(`  -> ${dest} (${(received / 1e6).toFixed(1)} MB)`);
    } catch (err) {
        try { unlinkSync(tmp); } catch {}
        throw err;
    }
}

function findFileSync(dir, name) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const r = findFileSync(full, name);
            if (r) return r;
        } else if (entry.name === name) {
            return full;
        }
    }
    return null;
}

async function downloadOrtDll() {
    const dllDest = path.join(modelsDir, 'onnxruntime.dll');
    if (existsSync(dllDest)) {
        console.log(`onnxruntime.dll (ORT ${ORT_VERSION}): already present, skipping.`);
        return;
    }

    // Only needed on Windows; other platforms link against system ORT
    if (process.platform !== 'win32') {
        console.log('onnxruntime.dll: skipping (not Windows).');
        return;
    }

    const zipDest = path.join(modelsDir, 'ort.zip');
    await downloadFile(ORT_DLL_URL, zipDest, `onnxruntime-win-x64-${ORT_VERSION}.zip`);

    console.log('  Extracting onnxruntime.dll...');
    const extractDir = path.join(modelsDir, '_ort_extract');
    mkdirSync(extractDir, { recursive: true });

    try {
        execSync(
            `powershell -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${zipDest}' -DestinationPath '${extractDir}' -Force"`,
            { stdio: 'inherit' }
        );

        // Standard location inside the zip: onnxruntime-win-x64-1.24.1/lib/onnxruntime.dll
        const stdPath = path.join(extractDir, `onnxruntime-win-x64-${ORT_VERSION}`, 'lib', 'onnxruntime.dll');
        const dllSrc = existsSync(stdPath) ? stdPath : findFileSync(extractDir, 'onnxruntime.dll');
        if (!dllSrc) throw new Error('onnxruntime.dll not found inside ORT zip!');

        copyFileSync(dllSrc, dllDest);
        console.log(`  -> ${dllDest}`);
    } finally {
        try { unlinkSync(zipDest); } catch {}
        try {
            execSync(`powershell -ExecutionPolicy Bypass -Command "Remove-Item -Recurse -Force '${extractDir}'"`, { stdio: 'pipe' });
        } catch {}
    }
}

// Download ONNX model files
for (const model of MODELS) {
    if (existsSync(model.dest)) {
        console.log(`${model.name}: already present, skipping.`);
    } else {
        await downloadFile(model.url, model.dest, model.name);
    }
}

// Download onnxruntime.dll (Windows only, for load-dynamic ORT)
await downloadOrtDll();

console.log('\nModels ready in:', modelsDir);
