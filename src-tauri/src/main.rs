//! Maige - Professional Image Editor
//!
//! Tauri backend for the Maige image editor application.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod image_processor;

use tauri::{AppHandle, Emitter};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

fn build_menu(app: &tauri::App) -> tauri::Result<Menu<tauri::Wry>> {
    let file_menu = Submenu::with_items(app, "File", true, &[
        &MenuItem::with_id(app, "open_folder", "Open Folder...", true, Some("CmdOrCtrl+O"))?,
        &MenuItem::with_id(app, "import_images", "Import Images...", true, Some("CmdOrCtrl+Shift+I"))?,
        &MenuItem::with_id(app, "close_folder", "Close Folder", true, None::<&str>)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::quit(app, None)?,
    ])?;

    let edit_menu = Submenu::with_items(app, "Edit", true, &[
        &MenuItem::with_id(app, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?,
        &MenuItem::with_id(app, "redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?,
        &PredefinedMenuItem::separator(app)?,
        &MenuItem::with_id(app, "select_all", "Select All", true, Some("CmdOrCtrl+A"))?,
        &MenuItem::with_id(app, "deselect_all", "Deselect All", true, Some("Escape"))?,
        &MenuItem::with_id(app, "invert_selection", "Invert Selection", true, None::<&str>)?,
    ])?;

    let rating_menu = Submenu::with_items(app, "Rating", true, &[
        &MenuItem::with_id(app, "set_rating_0", "No Rating", true, Some("0"))?,
        &MenuItem::with_id(app, "set_rating_1", "1 Star", true, Some("1"))?,
        &MenuItem::with_id(app, "set_rating_2", "2 Stars", true, Some("2"))?,
        &MenuItem::with_id(app, "set_rating_3", "3 Stars", true, Some("3"))?,
        &MenuItem::with_id(app, "set_rating_4", "4 Stars", true, Some("4"))?,
        &MenuItem::with_id(app, "set_rating_5", "5 Stars", true, Some("5"))?,
    ])?;

    let flag_menu = Submenu::with_items(app, "Flag", true, &[
        &MenuItem::with_id(app, "set_flag_pick", "Pick", true, Some("P"))?,
        &MenuItem::with_id(app, "set_flag_reject", "Reject", true, Some("X"))?,
        &MenuItem::with_id(app, "set_flag_none", "Unflag", true, Some("U"))?,
    ])?;

    let photo_menu = Submenu::with_items(app, "Photo", true, &[
        &MenuItem::with_id(app, "copy_adjustments", "Copy Adjustments", true, Some("CmdOrCtrl+Shift+C"))?,
        &MenuItem::with_id(app, "paste_adjustments", "Paste Adjustments", true, Some("CmdOrCtrl+Shift+V"))?,
        &MenuItem::with_id(app, "reset_adjustments", "Reset Adjustments", true, None::<&str>)?,
        &PredefinedMenuItem::separator(app)?,
        &MenuItem::with_id(app, "new_album", "New Album...", true, Some("CmdOrCtrl+N"))?,
        &PredefinedMenuItem::separator(app)?,
        &rating_menu,
        &flag_menu,
    ])?;

    let toggle_panels_menu = Submenu::with_items(app, "Panels", true, &[
        &MenuItem::with_id(app, "toggle_panel_library", "Library Panel", true, Some("CmdOrCtrl+1"))?,
        &MenuItem::with_id(app, "toggle_panel_develop", "Develop Panel", true, Some("CmdOrCtrl+2"))?,
        &MenuItem::with_id(app, "toggle_panel_filmstrip", "Filmstrip", true, Some("CmdOrCtrl+3"))?,
    ])?;

    let view_menu = Submenu::with_items(app, "View", true, &[
        &MenuItem::with_id(app, "zoom_in", "Zoom In", true, Some("CmdOrCtrl+="))?,
        &MenuItem::with_id(app, "zoom_out", "Zoom Out", true, Some("CmdOrCtrl+-"))?,
        &MenuItem::with_id(app, "zoom_fit", "Zoom to Fit", true, Some("CmdOrCtrl+0"))?,
        &PredefinedMenuItem::separator(app)?,
        &MenuItem::with_id(app, "compare_mode", "Compare Mode", true, None::<&str>)?,
        &MenuItem::with_id(app, "before_after", "Before / After", true, None::<&str>)?,
        &PredefinedMenuItem::separator(app)?,
        &toggle_panels_menu,
    ])?;

    Menu::with_items(app, &[&file_menu, &edit_menu, &photo_menu, &view_menu])
}

fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().0.as_str();

    // Open folder: let the frontend handle the dialog (avoids file:// URL issues)
    if id == "open_folder" {
        let _ = app.emit("menu-action", serde_json::json!({ "action": "openFolder" }));
        return;
    }

    let payload = match id {
        "import_images"     => serde_json::json!({ "action": "importImages" }),
        "close_folder"      => serde_json::json!({ "action": "closeFolder" }),
        "undo"              => serde_json::json!({ "action": "undo" }),
        "redo"              => serde_json::json!({ "action": "redo" }),
        "select_all"        => serde_json::json!({ "action": "selectAll" }),
        "deselect_all"      => serde_json::json!({ "action": "deselectAll" }),
        "invert_selection"  => serde_json::json!({ "action": "invertSelection" }),
        "copy_adjustments"  => serde_json::json!({ "action": "copyAdjustments" }),
        "paste_adjustments" => serde_json::json!({ "action": "pasteAdjustments" }),
        "reset_adjustments" => serde_json::json!({ "action": "resetAdjustments" }),
        "new_album"         => serde_json::json!({ "action": "newAlbum" }),
        "set_rating_0"      => serde_json::json!({ "action": "setRating", "data": 0 }),
        "set_rating_1"      => serde_json::json!({ "action": "setRating", "data": 1 }),
        "set_rating_2"      => serde_json::json!({ "action": "setRating", "data": 2 }),
        "set_rating_3"      => serde_json::json!({ "action": "setRating", "data": 3 }),
        "set_rating_4"      => serde_json::json!({ "action": "setRating", "data": 4 }),
        "set_rating_5"      => serde_json::json!({ "action": "setRating", "data": 5 }),
        "set_flag_pick"     => serde_json::json!({ "action": "setFlag", "data": "pick" }),
        "set_flag_reject"   => serde_json::json!({ "action": "setFlag", "data": "reject" }),
        "set_flag_none"     => serde_json::json!({ "action": "setFlag", "data": "none" }),
        "zoom_in"                  => serde_json::json!({ "action": "zoomIn" }),
        "zoom_out"                 => serde_json::json!({ "action": "zoomOut" }),
        "zoom_fit"                 => serde_json::json!({ "action": "zoomFit" }),
        "compare_mode"             => serde_json::json!({ "action": "compareMode" }),
        "before_after"             => serde_json::json!({ "action": "beforeAfter" }),
        "toggle_panel_library"     => serde_json::json!({ "action": "togglePanel", "data": "library" }),
        "toggle_panel_develop"     => serde_json::json!({ "action": "togglePanel", "data": "develop" }),
        "toggle_panel_filmstrip"   => serde_json::json!({ "action": "togglePanel", "data": "filmstrip" }),
        _ => return,
    };

    let _ = app.emit("menu-action", payload);
}

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
            commands::delete_images,
            commands::get_album_images,
            commands::delete_album,
            commands::update_album,
            // Duplicates
            commands::get_duplicates,
            // Tags
            commands::get_tags,
            commands::get_images_by_tag,
            commands::get_image_tags_by_path,
            // People
            commands::get_all_people,
            commands::get_hidden_people,
            commands::get_images_by_person,
            commands::set_person_hidden,
            commands::assign_face_to_person,
            commands::create_person_from_face,
            commands::create_person_from_cluster,
            // Faces
            commands::save_face_detections,
            commands::get_unidentified_faces,
            commands::get_face_stats,
            commands::get_face_info,
            commands::get_face_thumbnail,
            // Presets
            commands::save_presets,
            commands::load_presets,
        ])
        .setup(|app| {
            let menu = build_menu(app)?;
            app.set_menu(menu)?;
            app.on_menu_event(handle_menu_event);

            // Initialize database synchronously so it's ready before the frontend loads
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                if let Err(e) = database::init(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
