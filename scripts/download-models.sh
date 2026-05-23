#!/usr/bin/env bash
# Download ONNX face recognition models for Maige.
# Both models are Apache 2.0 licensed.
#
# face_det.onnx  — Ultraface RFB-320 (github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB)
# face_emb.onnx  — SFace (github.com/opencv/opencv_zoo), 112×112 input, 128-d output

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="${1:-$SCRIPT_DIR/../crates/maige-tauri/models}"

mkdir -p "$MODELS_DIR"

download_model() {
    local url="$1"
    local dest="$2"
    local name="$3"

    if [ -f "$dest" ]; then
        echo "$name already present, skipping."
        return
    fi

    echo "Downloading $name ..."
    curl -fL --retry 3 --progress-bar -o "${dest}.tmp" "$url"
    mv "${dest}.tmp" "$dest"
    size=$(du -h "$dest" | cut -f1)
    echo "  -> $dest ($size)"
}

download_model \
    "https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/raw/master/models/onnx/version-RFB-320.onnx" \
    "$MODELS_DIR/face_det.onnx" \
    "face_det.onnx (Ultraface RFB-320)"

download_model \
    "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx" \
    "$MODELS_DIR/face_emb.onnx" \
    "face_emb.onnx (OpenCV SFace)"

echo ""
echo "Models ready in: $MODELS_DIR"
