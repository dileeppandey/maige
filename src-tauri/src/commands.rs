//! Tauri command handlers
//! 
//! These commands replace the Electron IPC handlers

use crate::database::{self, Album, DbImage};
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
