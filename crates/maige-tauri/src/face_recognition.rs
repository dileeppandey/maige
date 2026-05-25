//! Face detection and embedding via ONNX Runtime.
//!
//! Expected models in `{app_data_dir}/models/`:
//!   face_det.onnx — SCRFD-500M (InsightFace / buffalo_sc)
//!     source: huggingface.co/WePrompt/buffalo_sc  det_500m.onnx
//!
//!   face_emb.onnx — ArcFace w600k_r50 (InsightFace)
//!     source: huggingface.co/maze/faceX  w600k_r50.onnx
//!
//! Detection model I/O (SCRFD det_500m):
//!   input  "input.1"  [1, 3, H, W]  float32  (pixel − 127.5) / 128.0
//!   outputs (9 tensors at 3 scales — strides 8, 16, 32):
//!     scores:    [N_anchors, 1]   float32   face confidence (sigmoid)
//!     boxes:     [N_anchors, 4]   float32   distance-based regression (l, t, r, b)
//!     landmarks: [N_anchors, 10]  float32   5 keypoints × 2
//!
//! Embedding model I/O (ArcFace w600k_r50):
//!   input  [1, 3, 112, 112]  float32  RGB, (pixel − 127.5) / 128.0
//!   output [1, 512]          float32  L2-normalised embedding

use std::path::Path;
use anyhow::{anyhow, Context};
use image::{DynamicImage, imageops::FilterType};
use ndarray::Array4;
use ort::session::Session;
use ort::session::builder::GraphOptimizationLevel;
use ort::value::Tensor;

/// SCRFD uses 640×640 input
const DET_W: u32 = 640;
const DET_H: u32 = 640;
const CONF_THRESHOLD: f32 = 0.5;
const NMS_IOU_THRESHOLD: f32 = 0.4;
const EMB_SIZE: u32 = 112;
const FACE_PAD: f32 = 0.10;

/// SCRFD feature-map strides: outputs are grouped in sets of 3 (scores, boxes, landmarks)
/// ordered by stride 8, 16, 32 — with 2 anchors per location for det_500m.
const STRIDES: [u32; 3] = [8, 16, 32];
const NUM_ANCHORS_PER_CELL: usize = 2;

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
                 Download det_500m.onnx from \
                 huggingface.co/WePrompt/buffalo_sc \
                 and rename it to face_det.onnx",
                det_path
            ));
        }
        if !emb_path.exists() {
            return Err(anyhow!(
                "face_emb.onnx not found at {:?}. \
                 Download w600k_r50.onnx from \
                 huggingface.co/maze/faceX \
                 and rename it to face_emb.onnx",
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
        // Resize preserving aspect ratio, then letterbox into DET_W×DET_H
        let resized = img.resize(DET_W, DET_H, FilterType::Triangle);
        let rw = resized.width();
        let rh = resized.height();

        let dx = (DET_W - rw) / 2;
        let dy = (DET_H - rh) / 2;

        eprintln!("[detect] original={}x{} resized={}x{} padding=({},{})",
            img.width(), img.height(), rw, rh, dx, dy);

        // Pre-fill with 0.0 (normalised black = (0 - 127.5) / 128 ≈ -0.996)
        let mut input = Array4::<f32>::from_elem((1, 3, DET_H as usize, DET_W as usize), 0.0);
        let rgb = resized.to_rgb8();
        for (px, py, pixel) in rgb.enumerate_pixels() {
            let cx = (px + dx) as usize;
            let cy = (py + dy) as usize;
            input[[0, 0, cy, cx]] = (pixel[0] as f32 - 127.5) / 128.0;
            input[[0, 1, cy, cx]] = (pixel[1] as f32 - 127.5) / 128.0;
            input[[0, 2, cy, cx]] = (pixel[2] as f32 - 127.5) / 128.0;
        }

        let input_name = self.detector.inputs()[0].name().to_string();
        let input_tensor = Tensor::<f32>::from_array(input)?;
        let outputs = self.detector.run(ort::inputs![input_name => input_tensor])?;

        // Log output shapes for debugging
        eprintln!("[detect] model produced {} outputs", outputs.len());
        for (idx, output) in outputs.iter().enumerate() {
            if let Ok(arr) = output.1.try_extract_array::<f32>() {
                eprintln!("[detect]   output[{}]: shape={:?}", idx, arr.shape());
            }
        }

        // SCRFD det_500m produces 9 outputs: 3 strides × (scores, boxes, landmarks)
        // Order: scores_8, scores_16, scores_32, boxes_8, boxes_16, boxes_32, kps_8, kps_16, kps_32
        if outputs.len() < 6 {
            return Err(anyhow!(
                "Expected at least 6 outputs from SCRFD model, got {}",
                outputs.len()
            ));
        }

        let mut faces: Vec<DetectedFace> = Vec::new();

        for scale_idx in 0..3 {
            let scores_arr = outputs[scale_idx].try_extract_array::<f32>()?;
            let boxes_arr = outputs[3 + scale_idx].try_extract_array::<f32>()?;

            let stride = STRIDES[scale_idx] as f32;
            let feat_h = DET_H as f32 / stride;
            let feat_w = DET_W as f32 / stride;
            let fh = feat_h as usize;
            let fw = feat_w as usize;

            let num_rows = scores_arr.shape()[0];
            eprintln!("[detect] scale={} stride={} feat={}x{} anchors={} scores_shape={:?} boxes_shape={:?}",
                scale_idx, stride, fw, fh, num_rows, scores_arr.shape(), boxes_arr.shape());

            for row in 0..num_rows {
                let conf = scores_arr[[row, 0]];
                if conf < CONF_THRESHOLD {
                    continue;
                }

                // Determine grid cell and anchor index
                let anchor_idx = row / NUM_ANCHORS_PER_CELL;
                let gy = anchor_idx / fw;
                let gx = anchor_idx % fw;

                // Anchor centre in pixel coordinates on the DET_W×DET_H canvas
                let anchor_cx = (gx as f32 + 0.5) * stride;
                let anchor_cy = (gy as f32 + 0.5) * stride;

                // SCRFD box outputs are distances: (left, top, right, bottom) from anchor
                let left   = boxes_arr[[row, 0]] * stride;
                let top    = boxes_arr[[row, 1]] * stride;
                let right  = boxes_arr[[row, 2]] * stride;
                let bottom = boxes_arr[[row, 3]] * stride;

                let x1_canvas = anchor_cx - left;
                let y1_canvas = anchor_cy - top;
                let x2_canvas = anchor_cx + right;
                let y2_canvas = anchor_cy + bottom;

                // Map from canvas coords back to the resized image, then normalise to [0, 1]
                let x1 = ((x1_canvas - dx as f32) / rw as f32).clamp(0.0, 1.0);
                let y1 = ((y1_canvas - dy as f32) / rh as f32).clamp(0.0, 1.0);
                let x2 = ((x2_canvas - dx as f32) / rw as f32).clamp(0.0, 1.0);
                let y2 = ((y2_canvas - dy as f32) / rh as f32).clamp(0.0, 1.0);

                if x2 <= x1 || y2 <= y1 {
                    continue;
                }
                faces.push(DetectedFace { x: x1, y: y1, w: x2 - x1, h: y2 - y1, confidence: conf });
            }
        }

        eprintln!("[detect] {} candidates before NMS", faces.len());
        nms(&mut faces, NMS_IOU_THRESHOLD);
        eprintln!("[detect] {} faces after NMS", faces.len());
        Ok(faces)
    }

    /// Return an L2-normalised embedding for the face described by `bbox`.
    /// Output dimension depends on the model (512-d for ArcFace w600k_r50).
    pub fn embed(&mut self, img: &DynamicImage, bbox: (f32, f32, f32, f32)) -> anyhow::Result<Vec<f32>> {
        let iw = img.width() as f32;
        let ih = img.height() as f32;
        let (bx, by, bw, bh) = bbox;

        eprintln!("[embed] img={}x{} bbox=({:.3},{:.3},{:.3},{:.3})", iw, ih, bx, by, bw, bh);

        // Center of the bounding box in pixels
        let cx_px = (bx + bw / 2.0) * iw;
        let cy_px = (by + bh / 2.0) * ih;

        // Bounding box size in pixels
        let bw_px = bw * iw;
        let bh_px = bh * ih;

        // Target crop dimension (square) before padding
        let max_side = bw_px.max(bh_px);

        // Target crop dimension with padding
        let padded_side = max_side * (1.0 + 2.0 * FACE_PAD);
        let half_side = padded_side / 2.0;

        // Initial coordinates of the square crop in pixels
        let x1_px = (cx_px - half_side).round() as i32;
        let y1_px = (cy_px - half_side).round() as i32;
        let x2_px = (cx_px + half_side).round() as i32;
        let y2_px = (cy_px + half_side).round() as i32;

        let cw_init = x2_px - x1_px;
        let ch_init = y2_px - y1_px;
        let side = cw_init.max(ch_init);

        // Adjust bounds to be square and fit within the image boundaries
        let mut x1 = x1_px;
        let mut y1 = y1_px;

        if x1 < 0 {
            x1 = 0;
        }
        let mut x2 = x1 + side;
        if x2 > iw as i32 {
            x2 = iw as i32;
            x1 = (x2 - side).max(0);
        }

        if y1 < 0 {
            y1 = 0;
        }
        let mut y2 = y1 + side;
        if y2 > ih as i32 {
            y2 = ih as i32;
            y1 = (y2 - side).max(0);
        }

        let x1 = x1 as u32;
        let y1 = y1 as u32;
        let x2 = x2 as u32;
        let y2 = y2 as u32;
        let cw = x2.saturating_sub(x1).max(1);
        let ch = y2.saturating_sub(y1).max(1);

        eprintln!("[embed] square crop px: x1={} y1={} cw={} ch={}", x1, y1, cw, ch);

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

        // ArcFace expects RGB input, (pixel - 127.5) / 128.0
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

/// Cluster L2-normalised face embeddings using average-linkage hierarchical clustering.
///
/// At each step the two clusters whose AVERAGE pairwise cosine distance is smallest
/// are merged, as long as that distance is below `threshold`.  Average-linkage is a
/// good balance for face recognition — less prone to over-splitting than complete-linkage
/// while avoiding the chaining effect of single-linkage.
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

        // Find the pair of clusters with the smallest AVERAGE-LINKAGE distance
        // (i.e. the mean of all pairwise distances between the two groups)
        let mut best_dist = f32::INFINITY;
        let mut best_i = 0;
        let mut best_j = 1;

        for i in 0..clusters.len() {
            for j in (i + 1)..clusters.len() {
                let avg_d = {
                    let d = &dist;
                    let pairs = clusters[i].len() * clusters[j].len();
                    let sum: f32 = clusters[i].iter()
                        .flat_map(|&a| clusters[j].iter().map(move |&b| d[a * n + b]))
                        .sum();
                    sum / pairs as f32
                };

                if avg_d < best_dist {
                    best_dist = avg_d;
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
