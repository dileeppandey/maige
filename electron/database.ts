import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

// Database instance
let db: Database.Database | null = null;

/**
 * Get the path to the library database
 */
function getDatabasePath(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'library.db');
}

/**
 * Initialize the database with schema
 */
export function initDatabase(): Database.Database {
    if (db) return db;

    const dbPath = getDatabasePath();

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Create schema
    createSchema(db);

    console.log('Database initialized at:', dbPath);
    return db;
}

/**
 * Create database schema
 */
function createSchema(db: Database.Database): void {
    // Images table
    db.exec(`
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            file_hash TEXT,
            file_size INTEGER,
            width INTEGER,
            height INTEGER,
            date_taken DATETIME,
            date_imported DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            -- EXIF data
            camera_make TEXT,
            camera_model TEXT,
            gps_lat REAL,
            gps_lng REAL,
            
            -- Analysis outputs
            phash TEXT,
            auto_tags TEXT,
            scene_type TEXT,
            clip_embedding BLOB,
            
            -- Processing status
            analyzed_at DATETIME,
            analysis_version INTEGER DEFAULT 1
        )
    `);

    // Tags table (unique tags)
    db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Image-Tag junction table
    db.exec(`
        CREATE TABLE IF NOT EXISTS image_tags (
            image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
            tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
            score REAL,
            PRIMARY KEY (image_id, tag_id)
        )
    `);

    // Duplicate groups
    db.exec(`
        CREATE TABLE IF NOT EXISTS duplicate_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Duplicate members
    db.exec(`
        CREATE TABLE IF NOT EXISTS duplicate_members (
            group_id INTEGER REFERENCES duplicate_groups(id) ON DELETE CASCADE,
            image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
            is_primary BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (group_id, image_id)
        )
    `);

    // Create indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_images_phash ON images(phash);
        CREATE INDEX IF NOT EXISTS idx_images_date ON images(date_taken);
        CREATE INDEX IF NOT EXISTS idx_images_path ON images(file_path);
        CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
        CREATE INDEX IF NOT EXISTS idx_image_tags_image ON image_tags(image_id);
        CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags(tag_id);
    `);
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
    }
}

// ============================================
// Image Operations
// ============================================

export interface ImageRecord {
    id: number;
    file_path: string;
    file_name: string;
    file_hash: string | null;
    file_size: number | null;
    width: number | null;
    height: number | null;
    date_taken: string | null;
    date_imported: string;
    camera_make: string | null;
    camera_model: string | null;
    gps_lat: number | null;
    gps_lng: number | null;
    phash: string | null;
    auto_tags: string | null;
    scene_type: string | null;
    analyzed_at: string | null;
    analysis_version: number;
}

/**
 * Insert or update an image record
 */
export function upsertImage(image: Partial<ImageRecord> & { file_path: string; file_name: string }): number {
    const db = getDatabase();

    const stmt = db.prepare(`
        INSERT INTO images (
            file_path, file_name, file_hash, file_size, width, height,
            date_taken, camera_make, camera_model, gps_lat, gps_lng,
            phash, auto_tags, scene_type, analyzed_at, analysis_version
        ) VALUES (
            @file_path, @file_name, @file_hash, @file_size, @width, @height,
            @date_taken, @camera_make, @camera_model, @gps_lat, @gps_lng,
            @phash, @auto_tags, @scene_type, @analyzed_at, @analysis_version
        )
        ON CONFLICT(file_path) DO UPDATE SET
            file_hash = excluded.file_hash,
            file_size = excluded.file_size,
            width = excluded.width,
            height = excluded.height,
            date_taken = excluded.date_taken,
            camera_make = excluded.camera_make,
            camera_model = excluded.camera_model,
            gps_lat = excluded.gps_lat,
            gps_lng = excluded.gps_lng,
            phash = excluded.phash,
            auto_tags = excluded.auto_tags,
            scene_type = excluded.scene_type,
            analyzed_at = excluded.analyzed_at,
            analysis_version = excluded.analysis_version
    `);

    const result = stmt.run({
        file_path: image.file_path,
        file_name: image.file_name,
        file_hash: image.file_hash ?? null,
        file_size: image.file_size ?? null,
        width: image.width ?? null,
        height: image.height ?? null,
        date_taken: image.date_taken ?? null,
        camera_make: image.camera_make ?? null,
        camera_model: image.camera_model ?? null,
        gps_lat: image.gps_lat ?? null,
        gps_lng: image.gps_lng ?? null,
        phash: image.phash ?? null,
        auto_tags: image.auto_tags ?? null,
        scene_type: image.scene_type ?? null,
        analyzed_at: image.analyzed_at ?? null,
        analysis_version: image.analysis_version ?? 1,
    });

    return result.lastInsertRowid as number;
}

/**
 * Get all images
 */
export function getAllImages(): ImageRecord[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM images ORDER BY date_imported DESC').all() as ImageRecord[];
}

/**
 * Get image by path
 */
export function getImageByPath(filePath: string): ImageRecord | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM images WHERE file_path = ?').get(filePath) as ImageRecord | undefined;
}

/**
 * Get library statistics
 */
export function getLibraryStats(): { totalImages: number; duplicateGroups: number } {
    const db = getDatabase();

    const imageCount = db.prepare('SELECT COUNT(*) as count FROM images').get() as { count: number };
    const duplicateCount = db.prepare('SELECT COUNT(*) as count FROM duplicate_groups').get() as { count: number };

    return {
        totalImages: imageCount.count,
        duplicateGroups: duplicateCount.count,
    };
}

// ============================================
// Duplicate Operations
// ============================================

/**
 * Find images with matching phash
 */
export function findDuplicatesByPhash(): Map<string, ImageRecord[]> {
    const db = getDatabase();

    const duplicates = db.prepare(`
        SELECT * FROM images 
        WHERE phash IN (
            SELECT phash FROM images 
            WHERE phash IS NOT NULL 
            GROUP BY phash 
            HAVING COUNT(*) > 1
        )
        ORDER BY phash, date_imported
    `).all() as ImageRecord[];

    // Group by phash
    const groups = new Map<string, ImageRecord[]>();
    for (const img of duplicates) {
        if (!img.phash) continue;
        const existing = groups.get(img.phash) || [];
        existing.push(img);
        groups.set(img.phash, existing);
    }

    return groups;
}

/**
 * Create duplicate groups from phash matches
 */
export function createDuplicateGroups(): number {
    const db = getDatabase();
    const duplicates = findDuplicatesByPhash();
    let groupsCreated = 0;

    // Clear existing groups
    db.exec('DELETE FROM duplicate_members');
    db.exec('DELETE FROM duplicate_groups');

    for (const [, images] of duplicates) {
        if (images.length < 2) continue;

        // Create group
        const groupResult = db.prepare('INSERT INTO duplicate_groups DEFAULT VALUES').run();
        const groupId = groupResult.lastInsertRowid as number;

        // Add members
        const insertMember = db.prepare(
            'INSERT INTO duplicate_members (group_id, image_id, is_primary) VALUES (?, ?, ?)'
        );

        images.forEach((img, idx) => {
            insertMember.run(groupId, img.id, idx === 0 ? 1 : 0);
        });

        groupsCreated++;
    }

    return groupsCreated;
}

/**
 * Get all duplicate groups with their images
 */
export function getDuplicateGroups(): { groupId: number; images: ImageRecord[] }[] {
    const db = getDatabase();

    const groups = db.prepare('SELECT id FROM duplicate_groups').all() as { id: number }[];

    return groups.map(group => {
        const images = db.prepare(`
            SELECT i.* FROM images i
            JOIN duplicate_members dm ON dm.image_id = i.id
            WHERE dm.group_id = ?
            ORDER BY dm.is_primary DESC
        `).all(group.id) as ImageRecord[];

        return { groupId: group.id, images };
    });
}

// ============================================
// Tag Operations
// ============================================

export interface TagRecord {
    id: number;
    name: string;
    category: string | null;
    created_at: string;
}

/**
 * Get or create a tag by name
 */
export function getOrCreateTag(name: string, category?: string): number {
    const db = getDatabase();

    // Try to find existing
    const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number } | undefined;
    if (existing) return existing.id;

    // Create new
    const result = db.prepare('INSERT INTO tags (name, category) VALUES (?, ?)').run(name, category || null);
    return result.lastInsertRowid as number;
}

/**
 * Add tags to an image
 */
export function addImageTags(imageId: number, tags: { tag: string; score: number; category?: string }[]): void {
    const db = getDatabase();

    const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO image_tags (image_id, tag_id, score)
        VALUES (?, ?, ?)
    `);

    for (const { tag, score, category } of tags) {
        const tagId = getOrCreateTag(tag, category);
        insertStmt.run(imageId, tagId, score);
    }
}

/**
 * Get tags for an image
 */
export function getImageTags(imageId: number): { tag: string; score: number; category: string | null }[] {
    const db = getDatabase();

    return db.prepare(`
        SELECT t.name as tag, it.score, t.category
        FROM image_tags it
        JOIN tags t ON t.id = it.tag_id
        WHERE it.image_id = ?
        ORDER BY it.score DESC
    `).all(imageId) as { tag: string; score: number; category: string | null }[];
}

/**
 * Get all unique tags with counts
 */
export function getAllTags(): { tag: string; count: number; category: string | null }[] {
    const db = getDatabase();

    return db.prepare(`
        SELECT t.name as tag, COUNT(it.image_id) as count, t.category
        FROM tags t
        LEFT JOIN image_tags it ON it.tag_id = t.id
        GROUP BY t.id
        HAVING count > 0
        ORDER BY count DESC
    `).all() as { tag: string; count: number; category: string | null }[];
}

/**
 * Get images by tag
 */
export function getImagesByTag(tagName: string): ImageRecord[] {
    const db = getDatabase();

    return db.prepare(`
        SELECT i.* FROM images i
        JOIN image_tags it ON it.image_id = i.id
        JOIN tags t ON t.id = it.tag_id
        WHERE t.name = ?
        ORDER BY it.score DESC
    `).all(tagName) as ImageRecord[];
}

/**
 * Update image CLIP embedding
 */
export function updateImageEmbedding(imageId: number, embedding: number[]): void {
    const db = getDatabase();

    // Convert to Buffer for BLOB storage
    const buffer = Buffer.from(new Float32Array(embedding).buffer);

    db.prepare('UPDATE images SET clip_embedding = ? WHERE id = ?').run(buffer, imageId);
}

/**
 * Get image embedding as array
 */
export function getImageEmbedding(imageId: number): number[] | null {
    const db = getDatabase();

    const row = db.prepare('SELECT clip_embedding FROM images WHERE id = ?').get(imageId) as { clip_embedding: Buffer | null } | undefined;

    if (!row?.clip_embedding) return null;

    // Convert Buffer back to Float32Array
    const float32 = new Float32Array(row.clip_embedding.buffer, row.clip_embedding.byteOffset, row.clip_embedding.length / 4);
    return Array.from(float32);
}

/**
 * Get all images with embeddings for search
 */
export function getImagesWithEmbeddings(): { id: number; file_path: string; embedding: number[] }[] {
    const db = getDatabase();

    const rows = db.prepare(`
        SELECT id, file_path, clip_embedding 
        FROM images 
        WHERE clip_embedding IS NOT NULL
    `).all() as { id: number; file_path: string; clip_embedding: Buffer }[];

    return rows.map(row => {
        const float32 = new Float32Array(row.clip_embedding.buffer, row.clip_embedding.byteOffset, row.clip_embedding.length / 4);
        return {
            id: row.id,
            file_path: row.file_path,
            embedding: Array.from(float32),
        };
    });
}
