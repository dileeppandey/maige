//! Tauri command handlers
//!
//! All image processing is delegated to `maige_core`.
//! This module is a thin IPC boundary: deserialize args → call core → serialize result.

use crate::database::{self, Album, AnalyzedImage, DbImage, FaceCluster, FaceDetectionInput, FaceRecord, FaceStats, ImageTag, Person, Preset, TagInfo};
use crate::{face_recognition, FaceRecognizerState};
use maige_core::{
    scan_directory, file_sha256, extract_metadata,
    Adjustments, Histogram, ImageProcessor,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

/// Result type for commands
type CmdResult<T> = Result<T, String>;

// ============================================================================
// Folder Operations
// ============================================================================

/// Open a folder dialog and return the selected path.
/// (Dialog is handled via the Tauri dialog plugin on the frontend side.)
#[tauri::command]
pub async fn open_folder_dialog() -> CmdResult<Option<String>> {
    Ok(None)
}

/// Scan a folder for image files
#[tauri::command]
pub async fn scan_folder_for_images(folder_path: String) -> CmdResult<Vec<String>> {
    scan_directory(&folder_path).map_err(|e| e.to_string())
}

/// Import a folder: scan, analyze, and store all images
#[tauri::command]
pub async fn import_folder(
    app: AppHandle,
    folder_path: String,
) -> CmdResult<Vec<DbImage>> {
    let image_paths = scan_directory(&folder_path).map_err(|e| e.to_string())?;

    let mut imported = Vec::new();
    let total = image_paths.len();

    for (i, path) in image_paths.iter().enumerate() {
        let _ = app.emit("import-progress", serde_json::json!({
            "current": i + 1,
            "total": total,
            "file": path
        }));

        match analyze_image(path) {
            Ok(analyzed) => {
                match database::insert_image(&app, &analyzed).await {
                    Ok(db_image) => imported.push(db_image),
                    Err(e) => eprintln!("Failed to insert {}: {}", path, e),
                }
            }
            Err(e) => eprintln!("Failed to analyze {}: {}", path, e),
        }
    }

    // Notify frontend so it can trigger per-image face detection
    let pending: Vec<serde_json::Value> = imported.iter().map(|img| {
        serde_json::json!({ "id": img.id, "file_path": img.file_path })
    }).collect();
    let _ = app.emit("face-detection-pending", serde_json::json!({ "images": pending }));

    Ok(imported)
}

fn analyze_image(path: &str) -> Result<AnalyzedImage, String> {
    let meta = extract_metadata(path).map_err(|e| e.to_string())?;

    let file_size = std::fs::metadata(path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    let file_name = std::path::Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_hash = file_sha256(path).unwrap_or_default();

    // Generate perceptual hash via maige-core
    let phash = {
        let mut proc = ImageProcessor::new();
        proc.load(path).map_err(|e| e.to_string())?;
        proc.dhash().unwrap_or_default()
    };

    Ok(AnalyzedImage {
        file_path: path.to_string(),
        file_name,
        file_size,
        file_hash,
        width: meta.width as i32,
        height: meta.height as i32,
        format: meta.format,
        date_taken: meta.date_taken,
        camera_make: meta.camera_make,
        camera_model: meta.camera_model,
        phash,
    })
}

// ============================================================================
// Image Operations
// ============================================================================

/// Get metadata for an image
#[tauri::command]
pub async fn get_image_metadata(path: String) -> CmdResult<maige_core::ImageMetadata> {
    extract_metadata(&path).map_err(|e| e.to_string())
}

/// Generate perceptual hash for an image
#[tauri::command]
pub async fn generate_phash(path: String) -> CmdResult<String> {
    let mut proc = ImageProcessor::new();
    proc.load(&path).map_err(|e| e.to_string())?;
    proc.dhash().map_err(|e| e.to_string())
}

/// Process an image with adjustments and return the raw RGBA buffer
#[tauri::command]
pub async fn process_image(path: String, adjustments: Adjustments) -> CmdResult<Vec<u8>> {
    let mut proc = ImageProcessor::new();
    proc.load(&path).map_err(|e| e.to_string())?;
    proc.process(&adjustments).map_err(|e| e.to_string())
}

/// Get histogram for an image with adjustments applied
#[tauri::command]
pub async fn get_histogram(path: String, adjustments: Adjustments) -> CmdResult<Histogram> {
    let mut proc = ImageProcessor::new();
    proc.load(&path).map_err(|e| e.to_string())?;
    proc.histogram(&adjustments).map_err(|e| e.to_string())
}

/// Export an image with adjustments applied
#[tauri::command]
pub async fn export_image(
    source_path: String,
    output_path: String,
    adjustments: Adjustments,
    format: String,
    quality: u8,
) -> CmdResult<()> {
    let mut proc = ImageProcessor::new();
    proc.load(&source_path).map_err(|e| e.to_string())?;

    let export_format = match format.to_lowercase().as_str() {
        "jpg" | "jpeg" => maige_core::processor::ExportFormat::Jpeg,
        "png" => maige_core::processor::ExportFormat::Png,
        "webp" => maige_core::processor::ExportFormat::WebP,
        other => return Err(format!("Unsupported format: {}", other)),
    };

    proc.export(&output_path, &adjustments, export_format, quality)
        .map_err(|e| e.to_string())
}

// ============================================================================
// Database Operations
// ============================================================================

#[tauri::command]
pub async fn init_database(app: AppHandle) -> CmdResult<()> {
    database::init(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_images(app: AppHandle) -> CmdResult<Vec<DbImage>> {
    database::get_all_images(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_image_by_id(app: AppHandle, id: i64) -> CmdResult<Option<DbImage>> {
    database::get_image_by_id(&app, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_image_adjustments(app: AppHandle, id: i64, adjustments: Adjustments) -> CmdResult<()> {
    database::update_adjustments(&app, id, &adjustments).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_images(app: AppHandle, query: String) -> CmdResult<Vec<DbImage>> {
    database::search(&app, &query).await.map_err(|e| e.to_string())
}

// ============================================================================
// Album Operations
// ============================================================================

#[tauri::command]
pub async fn create_album(app: AppHandle, name: String) -> CmdResult<Album> {
    database::create_album(&app, &name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_albums(app: AppHandle) -> CmdResult<Vec<Album>> {
    database::get_albums(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_to_album(app: AppHandle, album_id: i64, image_id: i64) -> CmdResult<()> {
    database::add_to_album(&app, album_id, image_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_from_album(app: AppHandle, album_id: i64, image_id: i64) -> CmdResult<()> {
    database::remove_from_album(&app, album_id, image_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_images(app: AppHandle, ids: Vec<i64>) -> CmdResult<()> {
    database::delete_images(&app, &ids).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_album_images(app: AppHandle, album_id: i64) -> CmdResult<Vec<DbImage>> {
    database::get_album_images(&app, album_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_album(app: AppHandle, album_id: i64) -> CmdResult<()> {
    database::delete_album(&app, album_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_album(app: AppHandle, album_id: i64, name: Option<String>, description: Option<String>) -> CmdResult<()> {
    database::update_album(&app, album_id, name, description).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_duplicates(app: AppHandle) -> CmdResult<Vec<Vec<String>>> {
    database::get_duplicates(&app).await.map_err(|e| e.to_string())
}

// ============================================================================
// Tag Operations
// ============================================================================

#[tauri::command]
pub async fn get_tags(app: AppHandle) -> CmdResult<Vec<TagInfo>> {
    database::get_tags(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_images_by_tag(app: AppHandle, tag_name: String) -> CmdResult<Vec<DbImage>> {
    database::get_images_by_tag(&app, &tag_name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_image_tags_by_path(app: AppHandle, file_path: String) -> CmdResult<Vec<ImageTag>> {
    database::get_image_tags_by_path(&app, &file_path).await.map_err(|e| e.to_string())
}

// ============================================================================
// People Operations
// ============================================================================

#[tauri::command]
pub async fn get_all_people(app: AppHandle) -> CmdResult<Vec<Person>> {
    database::get_all_people(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_hidden_people(app: AppHandle) -> CmdResult<Vec<Person>> {
    database::get_hidden_people(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_images_by_person(app: AppHandle, person_id: i64) -> CmdResult<Vec<DbImage>> {
    database::get_images_by_person(&app, person_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_person_hidden(app: AppHandle, person_id: i64, hidden: bool) -> CmdResult<()> {
    database::set_person_hidden(&app, person_id, hidden).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn assign_face_to_person(app: AppHandle, face_id: i64, person_id: i64) -> CmdResult<()> {
    database::assign_face_to_person(&app, face_id, person_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_person_from_face(app: AppHandle, face_id: i64, name: String) -> CmdResult<Person> {
    database::create_person_from_face(&app, face_id, &name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_person_from_cluster(app: AppHandle, face_ids: Vec<i64>, name: String) -> CmdResult<Person> {
    database::create_person_from_cluster(&app, &face_ids, &name).await.map_err(|e| e.to_string())
}

// ============================================================================
// Face Operations
// ============================================================================

#[tauri::command]
pub async fn save_face_detections(
    app: AppHandle,
    image_id: i64,
    image_path: String,
    detections: Vec<FaceDetectionInput>,
) -> CmdResult<Vec<FaceRecord>> {
    database::save_face_detections(&app, image_id, &image_path, &detections)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_unidentified_faces(app: AppHandle) -> CmdResult<Vec<FaceRecord>> {
    database::get_unidentified_faces(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_face_stats(app: AppHandle) -> CmdResult<FaceStats> {
    database::get_face_stats(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_face_info(app: AppHandle, face_id: i64) -> CmdResult<Option<FaceRecord>> {
    database::get_face_info(&app, face_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_face_thumbnail(app: AppHandle, face_id: i64) -> CmdResult<Option<String>> {
    database::get_face_thumbnail(&app, face_id).await.map_err(|e| e.to_string())
}

// ============================================================================
// Preset Operations
// ============================================================================

#[tauri::command]
pub async fn save_presets(app: AppHandle, presets: Vec<serde_json::Value>) -> CmdResult<()> {
    database::save_presets(&app, presets).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_presets(app: AppHandle) -> CmdResult<Vec<Preset>> {
    database::load_presets(&app).await.map_err(|e| e.to_string())
}

// ============================================================================
// Face Recognition (ONNX)
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelStatus {
    pub detector: bool,
    pub embedder: bool,
    pub models_dir: String,
}

/// Check whether the ONNX model files are present in the models directory.
#[tauri::command]
pub async fn check_models_status(app: AppHandle) -> CmdResult<ModelStatus> {
    let models_dir = crate::resolve_models_dir(&app);

    Ok(ModelStatus {
        detector: models_dir.join("face_det.onnx").exists(),
        embedder: models_dir.join("face_emb.onnx").exists(),
        models_dir: models_dir.to_string_lossy().to_string(),
    })
}

/// Detect faces in one image, compute embeddings, and persist them to the DB.
/// Returns the saved FaceRecord rows.
#[tauri::command]
pub async fn detect_and_embed_faces(
    app: AppHandle,
    state: tauri::State<'_, FaceRecognizerState>,
    image_id: i64,
    image_path: String,
) -> CmdResult<Vec<FaceRecord>> {
    // Phase 1: ONNX inference (synchronous CPU work — lock held but no awaits)
    let (det_inputs, embeddings) = {
        let mut guard = state.0.lock().await;
        let rec = guard.as_mut().ok_or("Face recognition models not loaded. \
            Run check_models_status to see the required model paths.")?;

        let img = image::open(&image_path).map_err(|e| e.to_string())?;
        let detected = rec.detect(&img).map_err(|e| e.to_string())?;
        if detected.is_empty() {
            return Ok(vec![]);
        }

        let det_inputs: Vec<FaceDetectionInput> = detected.iter().map(|f| FaceDetectionInput {
            bbox: database::BboxInput { x: f.x as f64, y: f.y as f64, width: f.w as f64, height: f.h as f64 },
            confidence: f.confidence as f64,
        }).collect();

        let embeddings: Vec<Option<Vec<f32>>> = detected.iter()
            .map(|f| rec.embed(&img, (f.x, f.y, f.w, f.h)).ok())
            .collect();

        (det_inputs, embeddings)
        // guard is dropped here, before any await
    };

    // Phase 2: async DB writes
    let face_records = database::save_face_detections(&app, image_id, &image_path, &det_inputs)
        .await
        .map_err(|e| e.to_string())?;

    for (record, emb_opt) in face_records.iter().zip(embeddings.iter()) {
        if let Some(emb) = emb_opt {
            if let Err(e) = database::save_face_embedding(&app, record.id, emb).await {
                eprintln!("save_face_embedding error for face {}: {}", record.id, e);
            }
        }
    }

    Ok(face_records)
}

/// Run DBSCAN on all unidentified face embeddings and return clusters.
#[tauri::command]
pub async fn cluster_faces(app: AppHandle) -> CmdResult<Vec<FaceCluster>> {
    let embeddings = database::get_unidentified_face_embeddings(&app)
        .await
        .map_err(|e| e.to_string())?;

    if embeddings.is_empty() {
        return Ok(vec![]);
    }

    // ── Diagnostics ─────────────────────────────────────────────────────────
    eprintln!("[cluster_faces] {} embeddings loaded", embeddings.len());
    for (face_id, emb) in &embeddings {
        let norm: f32 = emb.iter().map(|v| v * v).sum::<f32>().sqrt();
        eprintln!("  face_id={} dim={} norm={:.4} first4={:?}",
            face_id, emb.len(), norm, &emb[..emb.len().min(4)]);
    }
    // Print full pairwise cosine-distance matrix
    eprintln!("[cluster_faces] Pairwise cosine distances (threshold = 0.20):");
    for i in 0..embeddings.len() {
        let mut row = String::new();
        for j in 0..embeddings.len() {
            let dot: f32 = embeddings[i].1.iter().zip(embeddings[j].1.iter()).map(|(a,b)| a*b).sum();
            let dist = (1.0 - dot).max(0.0);
            row.push_str(&format!("{:.3} ", dist));
        }
        eprintln!("  face[{}]: {}", embeddings[i].0, row.trim_end());
    }
    // ────────────────────────────────────────────────────────────────────────

    // Complete-linkage hierarchical clustering:
    //   threshold=0.20  — two clusters merge only when their worst-case pair is < 0.20
    //   min_pts=1       — a single face from an unknown person still shows as its own cluster
    let groups = face_recognition::hierarchical_cluster(&embeddings, 0.20, 1);
    eprintln!("[cluster_faces] {} clusters formed", groups.len());

    let clusters = groups.into_iter().map(|face_ids| FaceCluster {
        centroid_face_id: face_ids[0],
        face_ids,
    }).collect();

    Ok(clusters)
}

/// Clear all face detections and people records so faces can be re-detected with fresh embeddings.
#[tauri::command]
pub async fn reset_face_data(app: AppHandle) -> CmdResult<()> {
    database::reset_face_data(&app).await.map_err(|e| e.to_string())
}

/// Reload face recognition models from disk (useful after the user downloads them).
#[tauri::command]
pub async fn reload_face_models(
    app: AppHandle,
    state: tauri::State<'_, FaceRecognizerState>,
) -> CmdResult<ModelStatus> {
    let models_dir = crate::resolve_models_dir(&app);

    match face_recognition::FaceRecognizer::load(&models_dir) {
        Ok(rec) => { *state.0.lock().await = Some(rec); }
        Err(e) => eprintln!("reload_face_models: {}", e),
    }

    Ok(ModelStatus {
        detector: models_dir.join("face_det.onnx").exists(),
        embedder: models_dir.join("face_emb.onnx").exists(),
        models_dir: models_dir.to_string_lossy().to_string(),
    })
}
