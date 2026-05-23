# Download ONNX face recognition models for Maige.
# Both models are Apache 2.0 licensed.
#
# face_det.onnx  — Ultraface RFB-320 (github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB)
# face_emb.onnx  — SFace (github.com/opencv/opencv_zoo), 112×112 input, 128-d output

param(
    [string]$ModelsDir = "$PSScriptRoot\..\crates\maige-tauri\models"
)

$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null

function Download-Model {
    param([string]$Url, [string]$Dest, [string]$Name)

    if (Test-Path $Dest) {
        Write-Host "$Name already present, skipping."
        return
    }

    Write-Host "Downloading $Name ..."
    $tmp = "$Dest.tmp"
    try {
        Invoke-WebRequest -Uri $Url -OutFile $tmp -UseBasicParsing
        Move-Item -Path $tmp -Destination $Dest
        $size = [math]::Round((Get-Item $Dest).Length / 1MB, 1)
        Write-Host "  -> $Dest ($size MB)"
    }
    catch {
        Remove-Item -Path $tmp -ErrorAction SilentlyContinue
        throw
    }
}

Download-Model `
    -Url "https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/raw/master/models/onnx/version-RFB-320.onnx" `
    -Dest "$ModelsDir\face_det.onnx" `
    -Name "face_det.onnx (Ultraface RFB-320)"

Download-Model `
    -Url "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx" `
    -Dest "$ModelsDir\face_emb.onnx" `
    -Name "face_emb.onnx (OpenCV SFace)"

Write-Host "`nModels ready in: $ModelsDir"
