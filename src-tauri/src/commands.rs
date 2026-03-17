//! Tauri command handlers

use crate::database::{self, Album, DbImage, FaceDetectionInput, FaceRecord, FaceStats, ImageTag, Person, Preset, TagInfo};
use crate::image_processor::{self, ImageMetadata, Histogram, Adjustments};
use tauri::{AppHandle, Emitter};

/// Result type for commands
type CmdResult<T> = Result<T, String>;

// ============================================================================
// Folder Operations
// ============================================================================

/// Open a folder dialog and return the selected path
#[tauri::command]
pub async fn open_folder_dialog() -> CmdResult<Option<String>> {
    // Note: In Tauri 2, dialog is handled via the dialog plugin
    // This is a placeholder - actual implementation uses the dialog plugin API
    Ok(None)
}

/// Scan a folder for image files
#[tauri::command]
pub async fn scan_folder_for_images(folder_path: String) -> CmdResult<Vec<String>> {
    image_processor::scan_directory(&folder_path)
        .await
        .map_err(|e| e.to_string())
}

/// Import a folder: scan, analyze, and store all images
#[tauri::command]
pub async fn import_folder(
    app: AppHandle,
    folder_path: String,
) -> CmdResult<Vec<DbImage>> {
    let image_paths = image_processor::scan_directory(&folder_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut imported = Vec::new();
    let total = image_paths.len();

    for (i, path) in image_paths.iter().enumerate() {
        // Emit progress event
        let _ = app.emit("import-progress", serde_json::json!({
            "current": i + 1,
            "total": total,
            "file": path
        }));

        match image_processor::analyze_image(path).await {
            Ok(analyzed) => {
                // Store in database
                match database::insert_image(&app, &analyzed).await {
                    Ok(db_image) => imported.push(db_image),
                    Err(e) => eprintln!("Failed to insert {}: {}", path, e),
                }
            }
            Err(e) => eprintln!("Failed to analyze {}: {}", path, e),
        }
    }

    Ok(imported)
}

// ============================================================================
// Image Operations
// ============================================================================

/// Get metadata for an image
#[tauri::command]
pub async fn get_image_metadata(path: String) -> CmdResult<ImageMetadata> {
    image_processor::get_metadata(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Generate perceptual hash for an image
#[tauri::command]
pub async fn generate_phash(path: String) -> CmdResult<String> {
    image_processor::generate_phash(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Process an image with adjustments
#[tauri::command]
pub async fn process_image(
    path: String,
    adjustments: Adjustments,
) -> CmdResult<Vec<u8>> {
    image_processor::process(&path, &adjustments)
        .await
        .map_err(|e| e.to_string())
}

/// Get histogram for an image
#[tauri::command]
pub async fn get_histogram(
    path: String,
    adjustments: Adjustments,
) -> CmdResult<Histogram> {
    image_processor::get_histogram(&path, &adjustments)
        .await
        .map_err(|e| e.to_string())
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
    image_processor::export(&source_path, &output_path, &adjustments, &format, quality)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Database Operations
// ============================================================================

/// Initialize the database
#[tauri::command]
pub async fn init_database(app: AppHandle) -> CmdResult<()> {
    database::init(&app)
        .await
        .map_err(|e| e.to_string())
}

/// Get all images from the database
#[tauri::command]
pub async fn get_all_images(app: AppHandle) -> CmdResult<Vec<DbImage>> {
    database::get_all_images(&app)
        .await
        .map_err(|e| e.to_string())
}

/// Get a single image by ID
#[tauri::command]
pub async fn get_image_by_id(app: AppHandle, id: i64) -> CmdResult<Option<DbImage>> {
    database::get_image_by_id(&app, id)
        .await
        .map_err(|e| e.to_string())
}

/// Update image adjustments
#[tauri::command]
pub async fn update_image_adjustments(
    app: AppHandle,
    id: i64,
    adjustments: Adjustments,
) -> CmdResult<()> {
    database::update_adjustments(&app, id, &adjustments)
        .await
        .map_err(|e| e.to_string())
}

/// Search images by query (semantic or text)
#[tauri::command]
pub async fn search_images(
    app: AppHandle,
    query: String,
) -> CmdResult<Vec<DbImage>> {
    database::search(&app, &query)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Album Operations
// ============================================================================

/// Create a new album
#[tauri::command]
pub async fn create_album(
    app: AppHandle,
    name: String,
) -> CmdResult<Album> {
    database::create_album(&app, &name)
        .await
        .map_err(|e| e.to_string())
}

/// Get all albums
#[tauri::command]
pub async fn get_albums(app: AppHandle) -> CmdResult<Vec<Album>> {
    database::get_albums(&app)
        .await
        .map_err(|e| e.to_string())
}

/// Add image to album
#[tauri::command]
pub async fn add_to_album(
    app: AppHandle,
    album_id: i64,
    image_id: i64,
) -> CmdResult<()> {
    database::add_to_album(&app, album_id, image_id)
        .await
        .map_err(|e| e.to_string())
}

/// Remove image from album
#[tauri::command]
pub async fn remove_from_album(
    app: AppHandle,
    album_id: i64,
    image_id: i64,
) -> CmdResult<()> {
    database::remove_from_album(&app, album_id, image_id)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// New Commands
// ============================================================================

/// Delete images by IDs
#[tauri::command]
pub async fn delete_images(app: AppHandle, ids: Vec<i64>) -> CmdResult<()> {
    database::delete_images(&app, &ids)
        .await
        .map_err(|e| e.to_string())
}

/// Get images in an album
#[tauri::command]
pub async fn get_album_images(app: AppHandle, album_id: i64) -> CmdResult<Vec<DbImage>> {
    database::get_album_images(&app, album_id)
        .await
        .map_err(|e| e.to_string())
}

/// Delete an album
#[tauri::command]
pub async fn delete_album(app: AppHandle, album_id: i64) -> CmdResult<()> {
    database::delete_album(&app, album_id)
        .await
        .map_err(|e| e.to_string())
}

/// Update an album
#[tauri::command]
pub async fn update_album(app: AppHandle, album_id: i64, name: Option<String>, description: Option<String>) -> CmdResult<()> {
    database::update_album(&app, album_id, name, description)
        .await
        .map_err(|e| e.to_string())
}

/// Find duplicate images
#[tauri::command]
pub async fn get_duplicates(app: AppHandle) -> CmdResult<Vec<Vec<String>>> {
    database::get_duplicates(&app)
        .await
        .map_err(|e| e.to_string())
}

/// Get all tags with counts
#[tauri::command]
pub async fn get_tags(app: AppHandle) -> CmdResult<Vec<TagInfo>> {
    database::get_tags(&app)
        .await
        .map_err(|e| e.to_string())
}

/// Get images by tag name
#[tauri::command]
pub async fn get_images_by_tag(app: AppHandle, tag_name: String) -> CmdResult<Vec<DbImage>> {
    database::get_images_by_tag(&app, &tag_name)
        .await
        .map_err(|e| e.to_string())
}

/// Get tags for an image by file path
#[tauri::command]
pub async fn get_image_tags_by_path(app: AppHandle, file_path: String) -> CmdResult<Vec<ImageTag>> {
    database::get_image_tags_by_path(&app, &file_path)
        .await
        .map_err(|e| e.to_string())
}

/// Get all non-hidden people
#[tauri::command]
pub async fn get_all_people(app: AppHandle) -> CmdResult<Vec<Person>> {
    database::get_all_people(&app)
        .await
        .map_err(|e| e.to_string())
}

/// Get all hidden people
#[tauri::command]
pub async fn get_hidden_people(app: AppHandle) -> CmdResult<Vec<Person>> {
    database::get_hidden_people(&app)
        .await
        .map_err(|e| e.to_string())
}

/// Get images associated with a person
#[tauri::command]
pub async fn get_images_by_person(app: AppHandle, person_id: i64) -> CmdResult<Vec<DbImage>> {
    database::get_images_by_person(&app, person_id)
        .await
        .map_err(|e| e.to_string())
}

/// Set a person's hidden status
#[tauri::command]
pub async fn set_person_hidden(app: AppHandle, person_id: i64, hidden: bool) -> CmdResult<()> {
    database::set_person_hidden(&app, person_id, hidden)
        .await
        .map_err(|e| e.to_string())
}

/// Assign a face to a person
#[tauri::command]
pub async fn assign_face_to_person(app: AppHandle, face_id: i64, person_id: i64) -> CmdResult<()> {
    database::assign_face_to_person(&app, face_id, person_id)
        .await
        .map_err(|e| e.to_string())
}

/// Save face detections for an image
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

/// Get all unidentified faces
#[tauri::command]
pub async fn get_unidentified_faces(app: AppHandle) -> CmdResult<Vec<FaceRecord>> {
    database::get_unidentified_faces(&app)
        .await
        .map_err(|e| e.to_string())
}

/// Get face statistics
#[tauri::command]
pub async fn get_face_stats(app: AppHandle) -> CmdResult<FaceStats> {
    database::get_face_stats(&app)
        .await
        .map_err(|e| e.to_string())
}

/// Get face info by ID
#[tauri::command]
pub async fn get_face_info(app: AppHandle, face_id: i64) -> CmdResult<Option<FaceRecord>> {
    database::get_face_info(&app, face_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get a face thumbnail as base64 JPEG
#[tauri::command]
pub async fn get_face_thumbnail(app: AppHandle, face_id: i64) -> CmdResult<Option<String>> {
    database::get_face_thumbnail(&app, face_id)
        .await
        .map_err(|e| e.to_string())
}

/// Create a person from a single face
#[tauri::command]
pub async fn create_person_from_face(app: AppHandle, face_id: i64, name: String) -> CmdResult<Person> {
    database::create_person_from_face(&app, face_id, &name)
        .await
        .map_err(|e| e.to_string())
}

/// Create a person from a cluster of faces
#[tauri::command]
pub async fn create_person_from_cluster(app: AppHandle, face_ids: Vec<i64>, name: String) -> CmdResult<Person> {
    database::create_person_from_cluster(&app, &face_ids, &name)
        .await
        .map_err(|e| e.to_string())
}

/// Save presets
#[tauri::command]
pub async fn save_presets(app: AppHandle, presets: Vec<serde_json::Value>) -> CmdResult<()> {
    database::save_presets(&app, presets)
        .await
        .map_err(|e| e.to_string())
}

/// Load all presets
#[tauri::command]
pub async fn load_presets(app: AppHandle) -> CmdResult<Vec<Preset>> {
    database::load_presets(&app)
        .await
        .map_err(|e| e.to_string())
}
