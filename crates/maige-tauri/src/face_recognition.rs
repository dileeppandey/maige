//! Face detection and embedding via ONNX Runtime.
//!
//! Expected models in `{app_data_dir}/models/`:
//!   face_det.onnx — Ultraface RFB-320 (Apache 2.0)
//!     source: github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB
//!     file:   version-RFB-320.onnx  (rename to face_det.onnx)
//!   face_emb.onnx — OpenCV SFace 112×112 (Apache 2.0)
//!     source: github.com/opencv/opencv_zoo face_recognition_sface_2021dec.onnx
//!     NOTE: SFace expects BGR channel ordering (unlike RGB-standard models).
//!
//! Detection model I/O:
//!   input  "input"   [1, 3, 240, 320]  float32  normalised to [-1, 1]
//!   output [0] scores [1, 4420, 2]     float32  [:, :, 1] = face probability
//!   output [1] boxes  [1, 4420, 4]     float32  [x1, y1, x2, y2] in [0, 1]
//!
//! Embedding model I/O (SFace):
//!   input  [1, 3, 112, 112]  float32  BGR channel order, (pixel − 127.5) / 128.0
//!   output [1, 128]          float32  L2-normalised

use std::path::Path;
use anyhow::{anyhow, Context};
use image::{DynamicImage, imageops::FilterType};
use ndarray::Array4;
use ort::session::Session;
use ort::session::builder::GraphOptimizationLevel;
use ort::value::Tensor;

const DET_W: u32 = 320;
const DET_H: u32 = 240;
const CONF_THRESHOLD: f32 = 0.7;
const NMS_IOU_THRESHOLD: f32 = 0.45;
const EMB_SIZE: u32 = 112;
const FACE_PAD: f32 = 0.10;

#[derive(Debug, Clone)]
pub struct DetectedFace {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    pub confidence: f32,
}

pub struct FaceRecognizer {
    detector: Session,
    embedder: Session,
}

impl FaceRecognizer {
    pub fn load(models_dir: &Path) -> anyhow::Result<Self> {
        let det_path = models_dir.join("face_det.onnx");
        let emb_path = models_dir.join("face_emb.onnx");

        if !det_path.exists() {
            return Err(anyhow!(
                "face_det.onnx not found at {:?}. \
                 Download version-RFB-320.onnx from \
                 github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB \
                 and rename it to face_det.onnx",
                det_path
            ));
        }
        if !emb_path.exists() {
            return Err(anyhow!(
                "face_emb.onnx not found at {:?}. \
                 Download a MobileFaceNet ONNX model and place it there",
                emb_path
            ));
        }

        let detector = Session::builder()
            .map_err(|e| anyhow!("{}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .unwrap_or_else(|e| e.recover())
            .with_intra_threads(2)
            .unwrap_or_else(|e| e.recover())
            .commit_from_file(&det_path)
            .context("Failed to load face_det.onnx")?;

        let embedder = Session::builder()
            .map_err(|e| anyhow!("{}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .unwrap_or_else(|e| e.recover())
            .with_intra_threads(2)
            .unwrap_or_else(|e| e.recover())
            .commit_from_file(&emb_path)
            .context("Failed to load face_emb.onnx")?;

        Ok(Self { detector, embedder })
    }

    /// Detect faces; returns normalised (x, y, w, h) bboxes with NMS applied.
    pub fn detect(&mut self, img: &DynamicImage) -> anyhow::Result<Vec<DetectedFace>> {
        let resized = img.resize_exact(DET_W, DET_H, FilterType::Triangle);
        let rgb = resized.to_rgb8();

        let mut input = Array4::<f32>::zeros((1, 3, DET_H as usize, DET_W as usize));
        for (px, py, pixel) in rgb.enumerate_pixels() {
            input[[0, 0, py as usize, px as usize]] = pixel[0] as f32 / 128.0 - 1.0;
            input[[0, 1, py as usize, px as usize]] = pixel[1] as f32 / 128.0 - 1.0;
            input[[0, 2, py as usize, px as usize]] = pixel[2] as f32 / 128.0 - 1.0;
        }

        let input_name = self.detector.inputs()[0].name().to_string();
        let input_tensor = Tensor::<f32>::from_array(input)?;
        let outputs = self.detector.run(ort::inputs![input_name => input_tensor])?;

        let scores = outputs[0].try_extract_array::<f32>()?;
        let boxes = outputs[1].try_extract_array::<f32>()?;
        let num_anchors = scores.shape()[1];

        let mut faces: Vec<DetectedFace> = Vec::new();
        for i in 0..num_anchors {
            let confidence = scores[[0, i, 1]];
            if confidence < CONF_THRESHOLD { continue; }
            let x1 = boxes[[0, i, 0]].clamp(0.0, 1.0);
            let y1 = boxes[[0, i, 1]].clamp(0.0, 1.0);
            let x2 = boxes[[0, i, 2]].clamp(0.0, 1.0);
            let y2 = boxes[[0, i, 3]].clamp(0.0, 1.0);
            if x2 <= x1 || y2 <= y1 { continue; }
            faces.push(DetectedFace { x: x1, y: y1, w: x2 - x1, h: y2 - y1, confidence });
        }

        nms(&mut faces, NMS_IOU_THRESHOLD);
        Ok(faces)
    }

    /// Return a 128-d L2-normalised embedding for the face described by `bbox`.
    pub fn embed(&mut self, img: &DynamicImage, bbox: (f32, f32, f32, f32)) -> anyhow::Result<Vec<f32>> {
        let (iw, ih) = (img.width() as f32, img.height() as f32);
        let (bx, by, bw, bh) = bbox;

        eprintln!("[embed] img={}x{} bbox=({:.3},{:.3},{:.3},{:.3})", iw, ih, bx, by, bw, bh);

        let x1 = ((bx - bw * FACE_PAD) * iw).max(0.0) as u32;
        let y1 = ((by - bh * FACE_PAD) * ih).max(0.0) as u32;
        let x2 = ((bx + bw * (1.0 + FACE_PAD)) * iw).min(iw) as u32;
        let y2 = ((by + bh * (1.0 + FACE_PAD)) * ih).min(ih) as u32;
        let cw = x2.saturating_sub(x1).max(1);
        let ch = y2.saturating_sub(y1).max(1);

        eprintln!("[embed] crop px: x1={} y1={} cw={} ch={}", x1, y1, cw, ch);

        let face = img
            .crop_imm(x1, y1, cw, ch)
            .resize_exact(EMB_SIZE, EMB_SIZE, FilterType::CatmullRom)
            .to_rgb8();

        // Save crop to temp dir for visual inspection
        if let Ok(tmp) = std::env::var("TEMP").or_else(|_| std::env::var("TMP")) {
            static CROP_IDX: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
            let idx = CROP_IDX.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let path = format!("{}\\face_crop_{:03}.jpg", tmp, idx);
            if let Err(e) = face.save(&path) {
                eprintln!("[embed] failed to save crop: {}", e);
            } else {
                eprintln!("[embed] saved crop → {}", path);
            }
        }

        // Log pixel statistics to verify the crop is meaningful
        let pixels: Vec<u8> = face.pixels().flat_map(|p| [p[0], p[1], p[2]]).collect();
        let mean = pixels.iter().map(|&v| v as f32).sum::<f32>() / pixels.len() as f32;
        let mn = pixels.iter().copied().min().unwrap_or(0);
        let mx = pixels.iter().copied().max().unwrap_or(0);
        eprintln!("[embed] pixel stats: min={} max={} mean={:.1}", mn, mx, mean);

        // SFace (OpenCV FaceRecognizerSF) internally uses swapRB=true → model expects RGB
        let mut input = Array4::<f32>::zeros((1, 3, EMB_SIZE as usize, EMB_SIZE as usize));
        for (px, py, pixel) in face.enumerate_pixels() {
            input[[0, 0, py as usize, px as usize]] = (pixel[0] as f32 - 127.5) / 128.0; // R
            input[[0, 1, py as usize, px as usize]] = (pixel[1] as f32 - 127.5) / 128.0; // G
            input[[0, 2, py as usize, px as usize]] = (pixel[2] as f32 - 127.5) / 128.0; // B
        }

        let input_name = self.embedder.inputs()[0].name().to_string();
        eprintln!("[embed] input_name={:?}", input_name);

        let input_tensor = Tensor::<f32>::from_array(input)?;
        let outputs = self.embedder.run(ort::inputs![input_name => input_tensor])?;

        let raw: Vec<f32> = outputs[0].try_extract_array::<f32>()?.iter().copied().collect();
        let raw_norm: f32 = raw.iter().map(|v| v * v).sum::<f32>().sqrt();
        eprintln!("[embed] output dim={} raw_norm={:.4} first8={:?}",
            raw.len(), raw_norm, &raw[..raw.len().min(8)]);

        // L2-normalise in case the model doesn't do it internally
        let norm = raw_norm.max(1e-10);
        Ok(raw.iter().map(|v| v / norm).collect())
    }
}

// ─── NMS ────────────────────────────────────────────────────────────────────

fn nms(faces: &mut Vec<DetectedFace>, iou_thresh: f32) {
    faces.sort_unstable_by(|a, b| {
        b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal)
    });
    let n = faces.len();
    let mut suppressed = vec![false; n];
    for i in 0..n {
        if suppressed[i] { continue; }
        for j in (i + 1)..n {
            if !suppressed[j] && iou(&faces[i], &faces[j]) > iou_thresh {
                suppressed[j] = true;
            }
        }
    }
    let mut k = 0;
    faces.retain(|_| { let keep = !suppressed[k]; k += 1; keep });
}

fn iou(a: &DetectedFace, b: &DetectedFace) -> f32 {
    let ix1 = a.x.max(b.x);
    let iy1 = a.y.max(b.y);
    let ix2 = (a.x + a.w).min(b.x + b.w);
    let iy2 = (a.y + a.h).min(b.y + b.h);
    if ix2 <= ix1 || iy2 <= iy1 { return 0.0; }
    let inter = (ix2 - ix1) * (iy2 - iy1);
    let union = a.w * a.h + b.w * b.h - inter;
    if union <= 0.0 { 0.0 } else { inter / union }
}

// ─── Complete-linkage Hierarchical Clustering ───────────────────────────────

/// Cluster L2-normalised face embeddings using complete-linkage hierarchical clustering.
///
/// At each step the two clusters whose MAXIMUM pairwise cosine distance is smallest
/// are merged, as long as that distance is below `threshold`.  This prevents the
/// "chaining" problem that plagues DBSCAN when a single ambiguous face bridges
/// two otherwise distinct groups.
///
/// Clusters smaller than `min_pts` are discarded.
pub fn hierarchical_cluster(
    embeddings: &[(i64, Vec<f32>)],
    threshold: f32,
    min_pts: usize,
) -> Vec<Vec<i64>> {
    let n = embeddings.len();
    if n == 0 { return vec![]; }

    // Pre-compute full pairwise cosine-distance matrix (symmetric, diagonal = 0)
    let mut dist = vec![0f32; n * n];
    for i in 0..n {
        for j in 0..n {
            let dot: f32 = embeddings[i].1.iter()
                .zip(embeddings[j].1.iter())
                .map(|(a, b)| a * b)
                .sum();
            dist[i * n + j] = (1.0 - dot).max(0.0);
        }
    }

    // Each point starts in its own cluster (stored as indices into `embeddings`)
    let mut clusters: Vec<Vec<usize>> = (0..n).map(|i| vec![i]).collect();

    loop {
        if clusters.len() <= 1 { break; }

        // Find the pair of clusters with the smallest COMPLETE-LINKAGE distance
        // (i.e. the smallest "worst-case" distance between the two groups)
        let mut best_dist = f32::INFINITY;
        let mut best_i = 0;
        let mut best_j = 1;

        for i in 0..clusters.len() {
            for j in (i + 1)..clusters.len() {
                let max_d = {
                    let d = &dist;
                    clusters[i].iter()
                        .flat_map(|&a| clusters[j].iter().map(move |&b| d[a * n + b]))
                        .fold(0f32, f32::max)
                };

                if max_d < best_dist {
                    best_dist = max_d;
                    best_i = i;
                    best_j = j;
                }
            }
        }

        // Stop when the closest pair still exceeds the threshold
        if best_dist > threshold { break; }

        // Merge cluster j into cluster i (remove j, keep i)
        let merged = clusters.remove(best_j);
        clusters[best_i].extend(merged);
    }

    clusters.into_iter()
        .filter(|c| c.len() >= min_pts)
        .map(|c| c.into_iter().map(|i| embeddings[i].0).collect())
        .collect()
}

#[inline]
fn cosine_dist(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    (1.0 - dot).max(0.0)
}

// Keep DBSCAN for reference — not currently used
#[allow(dead_code)]
pub fn dbscan_cluster(embeddings: &[(i64, Vec<f32>)], eps: f32, min_pts: usize) -> Vec<Vec<i64>> {
    let n = embeddings.len();
    if n == 0 { return vec![]; }

    const UNVISITED: i32 = -1;
    const NOISE: i32 = -2;
    let mut labels = vec![UNVISITED; n];
    let mut cluster_id: i32 = 0;

    for i in 0..n {
        if labels[i] != UNVISITED { continue; }
        let neighbors: Vec<usize> = (0..n)
            .filter(|&j| cosine_dist(&embeddings[i].1, &embeddings[j].1) < eps)
            .collect();
        if neighbors.len() < min_pts { labels[i] = NOISE; continue; }
        labels[i] = cluster_id;
        let mut in_seed = vec![false; n];
        let mut seed_set = neighbors.clone();
        for &nb in &seed_set { in_seed[nb] = true; }
        let mut k = 0;
        while k < seed_set.len() {
            let q = seed_set[k]; k += 1;
            if labels[q] == NOISE { labels[q] = cluster_id; }
            if labels[q] != UNVISITED { continue; }
            labels[q] = cluster_id;
            let q_neighbors: Vec<usize> = (0..n)
                .filter(|&j| cosine_dist(&embeddings[q].1, &embeddings[j].1) < eps)
                .collect();
            if q_neighbors.len() >= min_pts {
                for nb in q_neighbors {
                    if !in_seed[nb] { in_seed[nb] = true; seed_set.push(nb); }
                }
            }
        }
        cluster_id += 1;
    }

    let mut groups: Vec<Vec<i64>> = vec![vec![]; cluster_id as usize];
    for (i, (face_id, _)) in embeddings.iter().enumerate() {
        if labels[i] >= 0 { groups[labels[i] as usize].push(*face_id); }
    }
    groups.into_iter().filter(|g| g.len() >= min_pts).collect()
}
