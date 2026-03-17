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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Person {
    pub id: i64,
    pub name: String,
    pub representative_face_id: Option<i64>,
    pub is_hidden: bool,
    pub face_count: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceRecord {
    pub id: i64,
    pub image_id: i64,
    pub image_path: String,
    pub bbox_x: f64,
    pub bbox_y: f64,
    pub bbox_w: f64,
    pub bbox_h: f64,
    pub confidence: Option<f64>,
    pub person_id: Option<i64>,
    pub person_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagInfo {
    pub tag: String,
    pub count: i64,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageTag {
    pub tag: String,
    pub score: f64,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub adjustments: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceStats {
    pub total_faces: i64,
    pub identified_faces: i64,
    pub unidentified_faces: i64,
    pub total_people: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceDetectionInput {
    pub bbox: BboxInput,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BboxInput {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Get database path
fn get_db_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("Failed to get app data dir")
        .join("maige.db")
}

/// Helper to map a rusqlite row to DbImage (columns 0..14)
fn row_to_db_image(row: &rusqlite::Row) -> rusqlite::Result<DbImage> {
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

        CREATE TABLE IF NOT EXISTS people (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            representative_face_id INTEGER,
            is_hidden INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS faces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id INTEGER NOT NULL,
            image_path TEXT NOT NULL,
            bbox_x REAL NOT NULL,
            bbox_y REAL NOT NULL,
            bbox_w REAL NOT NULL,
            bbox_h REAL NOT NULL,
            confidence REAL,
            person_id INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
            FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            category TEXT
        );

        CREATE TABLE IF NOT EXISTS image_tags (
            image_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            score REAL NOT NULL DEFAULT 1.0,
            PRIMARY KEY (image_id, tag_id),
            FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS presets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            adjustments TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_faces_image_id ON faces(image_id);
        CREATE INDEX IF NOT EXISTS idx_faces_person_id ON faces(person_id);
        CREATE INDEX IF NOT EXISTS idx_image_tags_image_id ON image_tags(image_id);
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

    let images = stmt.query_map([], row_to_db_image)?;

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

    let image = stmt.query_row([id], row_to_db_image).optional()?;

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

    let images = stmt.query_map([pattern], row_to_db_image)?;

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

/// Delete images by IDs
pub async fn delete_images(app: &AppHandle, ids: &[i64]) -> anyhow::Result<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    for id in ids {
        conn.execute("DELETE FROM images WHERE id = ?1", params![id])?;
    }

    Ok(())
}

/// Get images in an album
pub async fn get_album_images(app: &AppHandle, album_id: i64) -> anyhow::Result<Vec<DbImage>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let mut stmt = conn.prepare(
        "SELECT i.id, i.file_path, i.file_name, i.file_size, i.file_hash,
                i.width, i.height, i.format, i.date_taken, i.camera_make,
                i.camera_model, i.phash, i.adjustments, i.created_at, i.updated_at
         FROM images i
         JOIN album_images ai ON ai.image_id = i.id
         WHERE ai.album_id = ?1
         ORDER BY ai.added_at DESC"
    )?;

    let images = stmt.query_map([album_id], row_to_db_image)?;

    Ok(images.filter_map(|r| r.ok()).collect())
}

/// Delete an album
pub async fn delete_album(app: &AppHandle, album_id: i64) -> anyhow::Result<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    conn.execute("DELETE FROM albums WHERE id = ?1", params![album_id])?;

    Ok(())
}

/// Update an album's name
pub async fn update_album(app: &AppHandle, album_id: i64, name: Option<String>, _description: Option<String>) -> anyhow::Result<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    conn.execute(
        "UPDATE albums SET name = COALESCE(?1, name) WHERE id = ?2",
        params![name, album_id],
    )?;

    Ok(())
}

/// Find duplicate images using perceptual hash Hamming distance
pub async fn get_duplicates(app: &AppHandle) -> anyhow::Result<Vec<Vec<String>>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    // Fetch all images with non-empty phash
    let mut stmt = conn.prepare(
        "SELECT id, file_path, phash FROM images WHERE phash != '' ORDER BY id"
    )?;

    struct ImageEntry {
        _id: i64,
        file_path: String,
        phash: String,
    }

    let entries: Vec<ImageEntry> = stmt
        .query_map([], |row| {
            Ok(ImageEntry {
                _id: row.get(0)?,
                file_path: row.get(1)?,
                phash: row.get(2)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    let n = entries.len();

    // Union-Find
    let mut parent: Vec<usize> = (0..n).collect();

    fn find(parent: &mut Vec<usize>, x: usize) -> usize {
        if parent[x] != x {
            parent[x] = find(parent, parent[x]);
        }
        parent[x]
    }

    fn union(parent: &mut Vec<usize>, x: usize, y: usize) {
        let rx = find(parent, x);
        let ry = find(parent, y);
        if rx != ry {
            parent[rx] = ry;
        }
    }

    for i in 0..n {
        let hash_i = u64::from_str_radix(&entries[i].phash, 16).unwrap_or(0);
        for j in (i + 1)..n {
            let hash_j = u64::from_str_radix(&entries[j].phash, 16).unwrap_or(0);
            let distance = (hash_i ^ hash_j).count_ones();
            if distance <= 8 {
                union(&mut parent, i, j);
            }
        }
    }

    // Group by root
    let mut groups: std::collections::HashMap<usize, Vec<String>> = std::collections::HashMap::new();
    for i in 0..n {
        let root = find(&mut parent, i);
        groups.entry(root).or_default().push(entries[i].file_path.clone());
    }

    // Only return groups with 2+ images
    let result: Vec<Vec<String>> = groups
        .into_values()
        .filter(|g| g.len() >= 2)
        .collect();

    Ok(result)
}

/// Get all tags with counts
pub async fn get_tags(app: &AppHandle) -> anyhow::Result<Vec<TagInfo>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let mut stmt = conn.prepare(
        "SELECT t.name, COUNT(it.image_id) as count, t.category
         FROM tags t
         LEFT JOIN image_tags it ON t.id = it.tag_id
         GROUP BY t.id
         ORDER BY count DESC"
    )?;

    let tags = stmt.query_map([], |row| {
        Ok(TagInfo {
            tag: row.get(0)?,
            count: row.get(1)?,
            category: row.get(2)?,
        })
    })?;

    Ok(tags.filter_map(|r| r.ok()).collect())
}

/// Get images by tag name
pub async fn get_images_by_tag(app: &AppHandle, tag_name: &str) -> anyhow::Result<Vec<DbImage>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let mut stmt = conn.prepare(
        "SELECT i.id, i.file_path, i.file_name, i.file_size, i.file_hash,
                i.width, i.height, i.format, i.date_taken, i.camera_make,
                i.camera_model, i.phash, i.adjustments, i.created_at, i.updated_at
         FROM images i
         JOIN image_tags it ON it.image_id = i.id
         JOIN tags t ON t.id = it.tag_id
         WHERE t.name = ?1
         ORDER BY i.date_taken DESC, i.created_at DESC"
    )?;

    let images = stmt.query_map([tag_name], row_to_db_image)?;

    Ok(images.filter_map(|r| r.ok()).collect())
}

/// Get tags for an image by file path
pub async fn get_image_tags_by_path(app: &AppHandle, file_path: &str) -> anyhow::Result<Vec<ImageTag>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let mut stmt = conn.prepare(
        "SELECT t.name, it.score, t.category
         FROM image_tags it
         JOIN tags t ON t.id = it.tag_id
         JOIN images i ON i.id = it.image_id
         WHERE i.file_path = ?1
         ORDER BY it.score DESC"
    )?;

    let tags = stmt.query_map([file_path], |row| {
        Ok(ImageTag {
            tag: row.get(0)?,
            score: row.get(1)?,
            category: row.get(2)?,
        })
    })?;

    Ok(tags.filter_map(|r| r.ok()).collect())
}

/// Get all non-hidden people
pub async fn get_all_people(app: &AppHandle) -> anyhow::Result<Vec<Person>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.representative_face_id, p.is_hidden,
                COUNT(f.id) as face_count, p.created_at
         FROM people p
         LEFT JOIN faces f ON f.person_id = p.id
         WHERE p.is_hidden = 0
         GROUP BY p.id
         ORDER BY p.name"
    )?;

    let people = stmt.query_map([], |row| {
        Ok(Person {
            id: row.get(0)?,
            name: row.get(1)?,
            representative_face_id: row.get(2)?,
            is_hidden: row.get::<_, i64>(3)? != 0,
            face_count: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;

    Ok(people.filter_map(|r| r.ok()).collect())
}

/// Get all hidden people
pub async fn get_hidden_people(app: &AppHandle) -> anyhow::Result<Vec<Person>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.representative_face_id, p.is_hidden,
                COUNT(f.id) as face_count, p.created_at
         FROM people p
         LEFT JOIN faces f ON f.person_id = p.id
         WHERE p.is_hidden = 1
         GROUP BY p.id
         ORDER BY p.name"
    )?;

    let people = stmt.query_map([], |row| {
        Ok(Person {
            id: row.get(0)?,
            name: row.get(1)?,
            representative_face_id: row.get(2)?,
            is_hidden: row.get::<_, i64>(3)? != 0,
            face_count: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;

    Ok(people.filter_map(|r| r.ok()).collect())
}

/// Get images associated with a person
pub async fn get_images_by_person(app: &AppHandle, person_id: i64) -> anyhow::Result<Vec<DbImage>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let mut stmt = conn.prepare(
        "SELECT DISTINCT i.id, i.file_path, i.file_name, i.file_size, i.file_hash,
                i.width, i.height, i.format, i.date_taken, i.camera_make,
                i.camera_model, i.phash, i.adjustments, i.created_at, i.updated_at
         FROM images i
         JOIN faces f ON f.image_id = i.id
         WHERE f.person_id = ?1
         ORDER BY i.date_taken DESC, i.created_at DESC"
    )?;

    let images = stmt.query_map([person_id], row_to_db_image)?;

    Ok(images.filter_map(|r| r.ok()).collect())
}

/// Set a person's hidden status
pub async fn set_person_hidden(app: &AppHandle, person_id: i64, hidden: bool) -> anyhow::Result<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    conn.execute(
        "UPDATE people SET is_hidden = ?1 WHERE id = ?2",
        params![hidden as i64, person_id],
    )?;

    Ok(())
}

/// Assign a face to a person
pub async fn assign_face_to_person(app: &AppHandle, face_id: i64, person_id: i64) -> anyhow::Result<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    conn.execute(
        "UPDATE faces SET person_id = ?1 WHERE id = ?2",
        params![person_id, face_id],
    )?;

    Ok(())
}

/// Save face detections for an image
pub async fn save_face_detections(
    app: &AppHandle,
    image_id: i64,
    image_path: &str,
    detections: &[FaceDetectionInput],
) -> anyhow::Result<Vec<FaceRecord>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    for det in detections {
        conn.execute(
            "INSERT OR IGNORE INTO faces (image_id, image_path, bbox_x, bbox_y, bbox_w, bbox_h, confidence)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                image_id,
                image_path,
                det.bbox.x,
                det.bbox.y,
                det.bbox.width,
                det.bbox.height,
                det.confidence,
            ],
        )?;
    }

    // Fetch records for this image
    let mut stmt = conn.prepare(
        "SELECT f.id, f.image_id, f.image_path, f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h,
                f.confidence, f.person_id, p.name as person_name, f.created_at
         FROM faces f
         LEFT JOIN people p ON p.id = f.person_id
         WHERE f.image_id = ?1
         ORDER BY f.id"
    )?;

    let faces = stmt.query_map([image_id], |row| {
        Ok(FaceRecord {
            id: row.get(0)?,
            image_id: row.get(1)?,
            image_path: row.get(2)?,
            bbox_x: row.get(3)?,
            bbox_y: row.get(4)?,
            bbox_w: row.get(5)?,
            bbox_h: row.get(6)?,
            confidence: row.get(7)?,
            person_id: row.get(8)?,
            person_name: row.get(9)?,
            created_at: row.get(10)?,
        })
    })?;

    Ok(faces.filter_map(|r| r.ok()).collect())
}

/// Get all unidentified faces
pub async fn get_unidentified_faces(app: &AppHandle) -> anyhow::Result<Vec<FaceRecord>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let mut stmt = conn.prepare(
        "SELECT f.id, f.image_id, f.image_path, f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h,
                f.confidence, f.person_id, p.name as person_name, f.created_at
         FROM faces f
         LEFT JOIN people p ON p.id = f.person_id
         WHERE f.person_id IS NULL
         ORDER BY f.created_at DESC"
    )?;

    let faces = stmt.query_map([], |row| {
        Ok(FaceRecord {
            id: row.get(0)?,
            image_id: row.get(1)?,
            image_path: row.get(2)?,
            bbox_x: row.get(3)?,
            bbox_y: row.get(4)?,
            bbox_w: row.get(5)?,
            bbox_h: row.get(6)?,
            confidence: row.get(7)?,
            person_id: row.get(8)?,
            person_name: row.get(9)?,
            created_at: row.get(10)?,
        })
    })?;

    Ok(faces.filter_map(|r| r.ok()).collect())
}

/// Get face statistics
pub async fn get_face_stats(app: &AppHandle) -> anyhow::Result<FaceStats> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let total_faces: i64 = conn.query_row(
        "SELECT COUNT(*) FROM faces",
        [],
        |row| row.get(0),
    )?;

    let identified_faces: i64 = conn.query_row(
        "SELECT COUNT(*) FROM faces WHERE person_id IS NOT NULL",
        [],
        |row| row.get(0),
    )?;

    let total_people: i64 = conn.query_row(
        "SELECT COUNT(*) FROM people WHERE is_hidden = 0",
        [],
        |row| row.get(0),
    )?;

    Ok(FaceStats {
        total_faces,
        identified_faces,
        unidentified_faces: total_faces - identified_faces,
        total_people,
    })
}

/// Get face info by ID
pub async fn get_face_info(app: &AppHandle, face_id: i64) -> anyhow::Result<Option<FaceRecord>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let face = conn.query_row(
        "SELECT f.id, f.image_id, f.image_path, f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h,
                f.confidence, f.person_id, p.name as person_name, f.created_at
         FROM faces f
         LEFT JOIN people p ON p.id = f.person_id
         WHERE f.id = ?1",
        [face_id],
        |row| {
            Ok(FaceRecord {
                id: row.get(0)?,
                image_id: row.get(1)?,
                image_path: row.get(2)?,
                bbox_x: row.get(3)?,
                bbox_y: row.get(4)?,
                bbox_w: row.get(5)?,
                bbox_h: row.get(6)?,
                confidence: row.get(7)?,
                person_id: row.get(8)?,
                person_name: row.get(9)?,
                created_at: row.get(10)?,
            })
        },
    ).optional()?;

    Ok(face)
}

/// Create a person from a single face
pub async fn create_person_from_face(app: &AppHandle, face_id: i64, name: &str) -> anyhow::Result<Person> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    conn.execute(
        "INSERT INTO people (name, representative_face_id) VALUES (?1, ?2)",
        params![name, face_id],
    )?;

    let person_id = conn.last_insert_rowid();

    conn.execute(
        "UPDATE faces SET person_id = ?1 WHERE id = ?2",
        params![person_id, face_id],
    )?;

    let person = conn.query_row(
        "SELECT p.id, p.name, p.representative_face_id, p.is_hidden,
                COUNT(f.id) as face_count, p.created_at
         FROM people p
         LEFT JOIN faces f ON f.person_id = p.id
         WHERE p.id = ?1
         GROUP BY p.id",
        [person_id],
        |row| {
            Ok(Person {
                id: row.get(0)?,
                name: row.get(1)?,
                representative_face_id: row.get(2)?,
                is_hidden: row.get::<_, i64>(3)? != 0,
                face_count: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    )?;

    Ok(person)
}

/// Create a person from a cluster of faces
pub async fn create_person_from_cluster(app: &AppHandle, face_ids: &[i64], name: &str) -> anyhow::Result<Person> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let first_face_id = face_ids.first().copied();

    conn.execute(
        "INSERT INTO people (name, representative_face_id) VALUES (?1, ?2)",
        params![name, first_face_id],
    )?;

    let person_id = conn.last_insert_rowid();

    for fid in face_ids {
        conn.execute(
            "UPDATE faces SET person_id = ?1 WHERE id = ?2",
            params![person_id, fid],
        )?;
    }

    let person = conn.query_row(
        "SELECT p.id, p.name, p.representative_face_id, p.is_hidden,
                COUNT(f.id) as face_count, p.created_at
         FROM people p
         LEFT JOIN faces f ON f.person_id = p.id
         WHERE p.id = ?1
         GROUP BY p.id",
        [person_id],
        |row| {
            Ok(Person {
                id: row.get(0)?,
                name: row.get(1)?,
                representative_face_id: row.get(2)?,
                is_hidden: row.get::<_, i64>(3)? != 0,
                face_count: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    )?;

    Ok(person)
}

/// Save presets (replaces all existing)
pub async fn save_presets(app: &AppHandle, presets: Vec<serde_json::Value>) -> anyhow::Result<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    conn.execute("DELETE FROM presets", [])?;

    for preset in &presets {
        let id = preset.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let name = preset.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let adjustments = preset.get("adjustments").cloned().unwrap_or(serde_json::Value::Null);
        let adjustments_str = serde_json::to_string(&adjustments)?;

        conn.execute(
            "INSERT OR REPLACE INTO presets (id, name, adjustments) VALUES (?1, ?2, ?3)",
            params![id, name, adjustments_str],
        )?;
    }

    Ok(())
}

/// Load all presets
pub async fn load_presets(app: &AppHandle) -> anyhow::Result<Vec<Preset>> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    let mut stmt = conn.prepare(
        "SELECT id, name, adjustments, created_at FROM presets ORDER BY created_at"
    )?;

    let presets: Vec<Preset> = stmt
        .query_map([], |row| {
            let adjustments_str: String = row.get(2)?;
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, adjustments_str, row.get::<_, String>(3)?))
        })?
        .filter_map(|r| r.ok())
        .filter_map(|(id, name, adj_str, created_at)| {
            let adjustments = serde_json::from_str(&adj_str).ok()?;
            Some(Preset { id, name, adjustments, created_at })
        })
        .collect();

    Ok(presets)
}

/// Get a face thumbnail as a base64-encoded JPEG
pub async fn get_face_thumbnail(app: &AppHandle, face_id: i64) -> anyhow::Result<Option<String>> {
    use base64::{engine::general_purpose, Engine};

    let face = match get_face_info(app, face_id).await? {
        Some(f) => f,
        None => return Ok(None),
    };

    let img = image::open(&face.image_path)?;
    let (img_w, img_h) = (img.width() as f64, img.height() as f64);

    // bbox is normalized 0..1
    let x = (face.bbox_x * img_w).round() as u32;
    let y = (face.bbox_y * img_h).round() as u32;
    let w = (face.bbox_w * img_w).round() as u32;
    let h = (face.bbox_h * img_h).round() as u32;

    // Clamp to image bounds
    let x = x.min(img.width().saturating_sub(1));
    let y = y.min(img.height().saturating_sub(1));
    let w = w.min(img.width() - x);
    let h = h.min(img.height() - y);

    if w == 0 || h == 0 {
        return Ok(None);
    }

    let cropped = image::imageops::crop_imm(&img, x, y, w, h).to_image();
    let resized = image::imageops::resize(&cropped, 96, 96, image::imageops::FilterType::Lanczos3);

    let mut jpeg_bytes: Vec<u8> = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut jpeg_bytes);
    resized.write_to(&mut cursor, image::ImageFormat::Jpeg)?;

    let encoded = general_purpose::STANDARD.encode(&jpeg_bytes);
    Ok(Some(format!("data:image/jpeg;base64,{}", encoded)))
}
