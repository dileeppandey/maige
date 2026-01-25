//! Maige - Professional Image Editor
//! 
//! Tauri backend for the Maige image editor application.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod image_processor;

// Manager and Emitter traits available if needed

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // Folder operations
            commands::open_folder_dialog,
            commands::scan_folder_for_images,
            commands::import_folder,
            // Image operations
            commands::get_image_metadata,
            commands::generate_phash,
            commands::process_image,
            commands::get_histogram,
            commands::export_image,
            // Database operations
            commands::init_database,
            commands::get_all_images,
            commands::get_image_by_id,
            commands::update_image_adjustments,
            commands::search_images,
            // Album operations
            commands::create_album,
            commands::get_albums,
            commands::add_to_album,
            commands::remove_from_album,
        ])
        .setup(|app| {
            // Initialize database on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = database::init(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
