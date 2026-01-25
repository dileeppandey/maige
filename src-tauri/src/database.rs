//! Database module using rusqlite
//! 
//! Replaces better-sqlite3 from the Electron version

use rusqlite::{Connection, params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::image_processor::Adjustments;

/// Database image record
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbImage {
    pub id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub file_hash: String,
    pub width: i32,
    pub height: i32,
    pub format: String,
    pub date_taken: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub phash: String,
    pub adjustments: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Album record
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

/// Analyzed image data for insertion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzedImage {
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub file_hash: String,
    pub width: i32,
    pub height: i32,
    pub format: String,
    pub date_taken: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub phash: String,
}

/// Get database path
fn get_db_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("Failed to get app data dir")
        .join("maige.db")
}

/// Initialize the database
pub async fn init(app: &AppHandle) -> anyhow::Result<()> {
    let db_path = get_db_path(app);
    
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    
    let conn = Connection::open(&db_path)?;
    
    // Create tables
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL UNIQUE,
            file_name TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            file_hash TEXT NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            format TEXT NOT NULL,
            date_taken TEXT,
            camera_make TEXT,
            camera_model TEXT,
            phash TEXT NOT NULL,
            adjustments TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS album_images (
            album_id INTEGER NOT NULL,
            image_id INTEGER NOT NULL,
            added_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (album_id, image_id),
            FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
            FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_images_phash ON images(phash);
        CREATE INDEX IF NOT EXISTS idx_images_date_taken ON images(date_taken);
        CREATE INDEX IF NOT EXISTS idx_images_file_hash ON images(file_hash);
        "#,
    )?;
    
    Ok(())
}

/// Insert an analyzed image into the database
pub async fn insert_image(app: &AppHandle, image: &AnalyzedImage) -> anyhow::Result<DbImage> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;
    
    conn.execute(
        r#"
        INSERT OR REPLACE INTO images 
        (file_path, file_name, file_size, file_hash, width, height, format, 
         date_taken, camera_make, camera_model, phash, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'))
        "#,
        params![
            image.file_path,
            image.file_name,
            image.file_size,
            image.file_hash,
            image.width,
            image.height,
            image.format,
            image.date_taken,
            image.camera_make,
            image.camera_model,
            image.phash,
        ],
    )?;
    
    let id = conn.last_insert_rowid();
    
    // Fetch the inserted row
    get_image_by_id(app, id).await?.ok_or_else(|| anyhow::anyhow!("Failed to fetch inserted image"))
}

/// Get all images
pub async fn get_all_images(app: &AppHandle) -> anyhow::Result<Vec<DbImage>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;
    
    let mut stmt = conn.prepare(
        "SELECT id, file_path, file_name, file_size, file_hash, width, height, 
                format, date_taken, camera_make, camera_model, phash, adjustments,
                created_at, updated_at
         FROM images ORDER BY date_taken DESC, created_at DESC"
    )?;
    
    let images = stmt.query_map([], |row| {
        Ok(DbImage {
            id: row.get(0)?,
            file_path: row.get(1)?,
            file_name: row.get(2)?,
            file_size: row.get(3)?,
            file_hash: row.get(4)?,
            width: row.get(5)?,
            height: row.get(6)?,
            format: row.get(7)?,
            date_taken: row.get(8)?,
            camera_make: row.get(9)?,
            camera_model: row.get(10)?,
            phash: row.get(11)?,
            adjustments: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    })?;
    
    Ok(images.filter_map(|r| r.ok()).collect())
}

/// Get image by ID
pub async fn get_image_by_id(app: &AppHandle, id: i64) -> anyhow::Result<Option<DbImage>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;
    
    let mut stmt = conn.prepare(
        "SELECT id, file_path, file_name, file_size, file_hash, width, height, 
                format, date_taken, camera_make, camera_model, phash, adjustments,
                created_at, updated_at
         FROM images WHERE id = ?1"
    )?;
    
    let image = stmt.query_row([id], |row| {
        Ok(DbImage {
            id: row.get(0)?,
            file_path: row.get(1)?,
            file_name: row.get(2)?,
            file_size: row.get(3)?,
            file_hash: row.get(4)?,
            width: row.get(5)?,
            height: row.get(6)?,
            format: row.get(7)?,
            date_taken: row.get(8)?,
            camera_make: row.get(9)?,
            camera_model: row.get(10)?,
            phash: row.get(11)?,
            adjustments: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    }).optional()?;
    
    Ok(image)
}

/// Update image adjustments
pub async fn update_adjustments(app: &AppHandle, id: i64, adjustments: &Adjustments) -> anyhow::Result<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;
    
    let adjustments_json = serde_json::to_string(adjustments)?;
    
    conn.execute(
        "UPDATE images SET adjustments = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![adjustments_json, id],
    )?;
    
    Ok(())
}

/// Search images (simple text search for now)
pub async fn search(app: &AppHandle, query: &str) -> anyhow::Result<Vec<DbImage>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;
    
    let pattern = format!("%{}%", query);
    
    let mut stmt = conn.prepare(
        "SELECT id, file_path, file_name, file_size, file_hash, width, height, 
                format, date_taken, camera_make, camera_model, phash, adjustments,
                created_at, updated_at
         FROM images 
         WHERE file_name LIKE ?1 OR camera_make LIKE ?1 OR camera_model LIKE ?1
         ORDER BY date_taken DESC"
    )?;
    
    let images = stmt.query_map([pattern], |row| {
        Ok(DbImage {
            id: row.get(0)?,
            file_path: row.get(1)?,
            file_name: row.get(2)?,
            file_size: row.get(3)?,
            file_hash: row.get(4)?,
            width: row.get(5)?,
            height: row.get(6)?,
            format: row.get(7)?,
            date_taken: row.get(8)?,
            camera_make: row.get(9)?,
            camera_model: row.get(10)?,
            phash: row.get(11)?,
            adjustments: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    })?;
    
    Ok(images.filter_map(|r| r.ok()).collect())
}

/// Create album
pub async fn create_album(app: &AppHandle, name: &str) -> anyhow::Result<Album> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;
    
    conn.execute(
        "INSERT INTO albums (name) VALUES (?1)",
        params![name],
    )?;
    
    let id = conn.last_insert_rowid();
    
    let album = conn.query_row(
        "SELECT id, name, created_at FROM albums WHERE id = ?1",
        [id],
        |row| Ok(Album {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
        }),
    )?;
    
    Ok(album)
}

/// Get all albums
pub async fn get_albums(app: &AppHandle) -> anyhow::Result<Vec<Album>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;
    
    let mut stmt = conn.prepare("SELECT id, name, created_at FROM albums ORDER BY name")?;
    
    let albums = stmt.query_map([], |row| {
        Ok(Album {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
        })
    })?;
    
    Ok(albums.filter_map(|r| r.ok()).collect())
}

/// Add image to album
pub async fn add_to_album(app: &AppHandle, album_id: i64, image_id: i64) -> anyhow::Result<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;
    
    conn.execute(
        "INSERT OR IGNORE INTO album_images (album_id, image_id) VALUES (?1, ?2)",
        params![album_id, image_id],
    )?;
    
    Ok(())
}

/// Remove image from album
pub async fn remove_from_album(app: &AppHandle, album_id: i64, image_id: i64) -> anyhow::Result<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;
    
    conn.execute(
        "DELETE FROM album_images WHERE album_id = ?1 AND image_id = ?2",
        params![album_id, image_id],
    )?;
    
    Ok(())
}
