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
            format TEXT,
            color_space TEXT,
            has_alpha INTEGER,
            date_taken DATETIME,
            date_imported DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            -- EXIF data
            camera_make TEXT,
            camera_model TEXT,
            focal_length REAL,
            aperture REAL,
            iso INTEGER,
            shutter_speed TEXT,
            exposure_program TEXT,
            metering_mode TEXT,
            flash TEXT,
            white_balance TEXT,
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

    // ============================================
    // Face Recognition Tables (Phase 3)
    // ============================================

    // Named people (user-labeled)
    db.exec(`
        CREATE TABLE IF NOT EXISTS people (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            representative_face_id INTEGER,
            anchor_embedding BLOB,
            is_hidden BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Detected faces (multiple per image)
    db.exec(`
        CREATE TABLE IF NOT EXISTS faces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
            bbox_x REAL NOT NULL,
            bbox_y REAL NOT NULL,
            bbox_w REAL NOT NULL,
            bbox_h REAL NOT NULL,
            embedding BLOB,
            person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
            confidence REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Face corrections for training
    db.exec(`
        CREATE TABLE IF NOT EXISTS face_corrections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            face_id INTEGER REFERENCES faces(id) ON DELETE CASCADE,
            action TEXT NOT NULL,
            from_person_id INTEGER,
            to_person_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ============================================
    // Albums (Manual Organization)
    // ============================================

    db.exec(`
        CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            cover_image_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS album_items (
            album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
            image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
            position INTEGER DEFAULT 0,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (album_id, image_id)
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
        CREATE INDEX IF NOT EXISTS idx_faces_image ON faces(image_id);
        CREATE INDEX IF NOT EXISTS idx_faces_person ON faces(person_id);
        CREATE INDEX IF NOT EXISTS idx_album_items_album ON album_items(album_id);
        CREATE INDEX IF NOT EXISTS idx_album_items_image ON album_items(image_id);
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
    format: string | null;
    color_space: string | null;
    has_alpha: number | null;
    date_taken: string | null;
    date_imported: string;
    camera_make: string | null;
    camera_model: string | null;
    focal_length: number | null;
    aperture: number | null;
    iso: number | null;
    shutter_speed: string | null;
    exposure_program: string | null;
    metering_mode: string | null;
    flash: string | null;
    white_balance: string | null;
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
            format, color_space, has_alpha,
            date_taken, camera_make, camera_model,
            focal_length, aperture, iso, shutter_speed,
            exposure_program, metering_mode, flash, white_balance,
            gps_lat, gps_lng,
            phash, auto_tags, scene_type, analyzed_at, analysis_version
        ) VALUES (
            @file_path, @file_name, @file_hash, @file_size, @width, @height,
            @format, @color_space, @has_alpha,
            @date_taken, @camera_make, @camera_model,
            @focal_length, @aperture, @iso, @shutter_speed,
            @exposure_program, @metering_mode, @flash, @white_balance,
            @gps_lat, @gps_lng,
            @phash, @auto_tags, @scene_type, @analyzed_at, @analysis_version
        )
        ON CONFLICT(file_path) DO UPDATE SET
            file_hash = excluded.file_hash,
            file_size = excluded.file_size,
            width = excluded.width,
            height = excluded.height,
            format = excluded.format,
            color_space = excluded.color_space,
            has_alpha = excluded.has_alpha,
            date_taken = excluded.date_taken,
            camera_make = excluded.camera_make,
            camera_model = excluded.camera_model,
            focal_length = excluded.focal_length,
            aperture = excluded.aperture,
            iso = excluded.iso,
            shutter_speed = excluded.shutter_speed,
            exposure_program = excluded.exposure_program,
            metering_mode = excluded.metering_mode,
            flash = excluded.flash,
            white_balance = excluded.white_balance,
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
        format: image.format ?? null,
        color_space: image.color_space ?? null,
        has_alpha: image.has_alpha ?? null,
        date_taken: image.date_taken ?? null,
        camera_make: image.camera_make ?? null,
        camera_model: image.camera_model ?? null,
        focal_length: image.focal_length ?? null,
        aperture: image.aperture ?? null,
        iso: image.iso ?? null,
        shutter_speed: image.shutter_speed ?? null,
        exposure_program: image.exposure_program ?? null,
        metering_mode: image.metering_mode ?? null,
        flash: image.flash ?? null,
        white_balance: image.white_balance ?? null,
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

    // Count only groups that have 2 or more members (actual duplicates)
    const duplicateCount = db.prepare(`
        SELECT COUNT(*) as count 
        FROM duplicate_groups dg
        WHERE (
            SELECT COUNT(*) 
            FROM duplicate_members dm 
            WHERE dm.group_id = dg.id
        ) >= 2
    `).get() as { count: number };

    return {
        totalImages: imageCount.count,
        duplicateGroups: duplicateCount.count,
    };
}

/**
 * Delete images from the library (database only, not filesystem)
 * Also removes associated faces, tags, and duplicate group memberships
 */
export function deleteImagesFromLibrary(imageIds: number[]): { deletedCount: number } {
    const db = getDatabase();

    if (imageIds.length === 0) {
        return { deletedCount: 0 };
    }

    const placeholders = imageIds.map(() => '?').join(',');

    // Delete faces associated with these images
    db.prepare(`DELETE FROM faces WHERE image_id IN (${placeholders})`).run(...imageIds);

    // Delete image tags
    db.prepare(`DELETE FROM image_tags WHERE image_id IN (${placeholders})`).run(...imageIds);

    // Delete from duplicate members
    db.prepare(`DELETE FROM duplicate_members WHERE image_id IN (${placeholders})`).run(...imageIds);

    // Delete empty duplicate groups
    db.prepare(`
        DELETE FROM duplicate_groups 
        WHERE id NOT IN (SELECT DISTINCT group_id FROM duplicate_members)
    `).run();

    // Delete the images
    const result = db.prepare(`DELETE FROM images WHERE id IN (${placeholders})`).run(...imageIds);

    return { deletedCount: result.changes };
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
 * Only returns groups that have 2 or more images (actual duplicates)
 */
export function getDuplicateGroups(): { groupId: number; images: ImageRecord[] }[] {
    const db = getDatabase();

    const groups = db.prepare('SELECT id FROM duplicate_groups').all() as { id: number }[];

    return groups
        .map(group => {
            const images = db.prepare(`
                SELECT i.* FROM images i
                JOIN duplicate_members dm ON dm.image_id = i.id
                WHERE dm.group_id = ?
                ORDER BY dm.is_primary DESC
            `).all(group.id) as ImageRecord[];

            return { groupId: group.id, images };
        })
        .filter(group => group.images.length >= 2); // Only return groups with 2+ images
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

// ============================================
// Face Operations (Phase 3)
// ============================================

export interface FaceRecord {
    id: number;
    image_id: number;
    bbox_x: number;
    bbox_y: number;
    bbox_w: number;
    bbox_h: number;
    embedding: Buffer | null;
    person_id: number | null;
    confidence: number | null;
    created_at: string;
}

export interface PersonRecord {
    id: number;
    name: string;
    representative_face_id: number | null;
    anchor_embedding: Buffer | null;
    is_hidden: boolean;
    created_at: string;
}

/**
 * Insert a detected face
 */
export function insertFace(
    imageId: number,
    bbox: { x: number; y: number; w: number; h: number },
    confidence: number,
    embedding?: number[]
): number {
    const db = getDatabase();

    const embeddingBuffer = embedding
        ? Buffer.from(new Float32Array(embedding).buffer)
        : null;

    const result = db.prepare(`
        INSERT INTO faces (image_id, bbox_x, bbox_y, bbox_w, bbox_h, confidence, embedding)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(imageId, bbox.x, bbox.y, bbox.w, bbox.h, confidence, embeddingBuffer);

    return result.lastInsertRowid as number;
}

/**
 * Get all faces for an image
 */
export function getFacesForImage(imageId: number): (FaceRecord & { person_name?: string })[] {
    const db = getDatabase();

    return db.prepare(`
        SELECT f.*, p.name as person_name
        FROM faces f
        LEFT JOIN people p ON f.person_id = p.id
        WHERE f.image_id = ?
    `).all(imageId) as (FaceRecord & { person_name?: string })[];
}

/**
 * Get face embedding as array
 */
export function getFaceEmbedding(faceId: number): number[] | null {
    const db = getDatabase();

    const row = db.prepare('SELECT embedding FROM faces WHERE id = ?').get(faceId) as { embedding: Buffer | null } | undefined;

    if (!row?.embedding) return null;

    const float32 = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.length / 4);
    return Array.from(float32);
}

/**
 * Update face embedding
 */
export function updateFaceEmbedding(faceId: number, embedding: number[]): void {
    const db = getDatabase();
    const buffer = Buffer.from(new Float32Array(embedding).buffer);
    db.prepare('UPDATE faces SET embedding = ? WHERE id = ?').run(buffer, faceId);
}

/**
 * Assign face to a person
 */
export function assignFaceToPerson(faceId: number, personId: number): void {
    const db = getDatabase();

    // Get current person_id for logging
    const face = db.prepare('SELECT person_id FROM faces WHERE id = ?').get(faceId) as { person_id: number | null } | undefined;
    const fromPersonId = face?.person_id ?? null;

    // Update face
    db.prepare('UPDATE faces SET person_id = ? WHERE id = ?').run(personId, faceId);

    // Log correction
    db.prepare(`
        INSERT INTO face_corrections (face_id, action, from_person_id, to_person_id)
        VALUES (?, ?, ?, ?)
    `).run(faceId, fromPersonId ? 'reassign' : 'confirm', fromPersonId, personId);
}

/**
 * Get all unidentified faces (no person assigned)
 */
export function getUnidentifiedFaces(): (FaceRecord & { file_path: string })[] {
    const db = getDatabase();

    return db.prepare(`
        SELECT f.*, i.file_path
        FROM faces f
        JOIN images i ON f.image_id = i.id
        WHERE f.person_id IS NULL
        ORDER BY f.created_at DESC
    `).all() as (FaceRecord & { file_path: string })[];
}

// ============================================
// People Operations (Phase 3)
// ============================================

/**
 * Create a new person
 */
export function createPerson(name: string, representativeFaceId?: number): number {
    const db = getDatabase();

    const result = db.prepare(`
        INSERT INTO people (name, representative_face_id)
        VALUES (?, ?)
    `).run(name, representativeFaceId ?? null);

    return result.lastInsertRowid as number;
}

/**
 * Get all people with face counts
 */
export function getAllPeople(): (PersonRecord & { face_count: number })[] {
    const db = getDatabase();

    return db.prepare(`
        SELECT p.*, COUNT(DISTINCT f.image_id) as face_count
        FROM people p
        LEFT JOIN faces f ON f.person_id = p.id
        WHERE p.is_hidden = FALSE
        GROUP BY p.id
        ORDER BY face_count DESC
    `).all() as (PersonRecord & { face_count: number })[];
}

/**
 * Get person by ID
 */
export function getPersonById(personId: number): PersonRecord | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM people WHERE id = ?').get(personId) as PersonRecord | undefined;
}

/**
 * Get person by name (case-insensitive)
 */
export function getPersonByName(name: string): PersonRecord | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM people WHERE LOWER(name) = LOWER(?) AND is_hidden = FALSE').get(name) as PersonRecord | undefined;
}

/**
 * Update person name
 */
export function updatePersonName(personId: number, name: string): void {
    const db = getDatabase();
    db.prepare('UPDATE people SET name = ? WHERE id = ?').run(name, personId);
}

/**
 * Update person's anchor embedding (average of all face embeddings)
 */
export function updatePersonAnchorEmbedding(personId: number, embedding: number[]): void {
    const db = getDatabase();
    const buffer = Buffer.from(new Float32Array(embedding).buffer);
    db.prepare('UPDATE people SET anchor_embedding = ? WHERE id = ?').run(buffer, personId);
}

/**
 * Get person's anchor embedding
 */
export function getPersonAnchorEmbedding(personId: number): number[] | null {
    const db = getDatabase();

    const row = db.prepare('SELECT anchor_embedding FROM people WHERE id = ?').get(personId) as { anchor_embedding: Buffer | null } | undefined;

    if (!row?.anchor_embedding) return null;

    const float32 = new Float32Array(row.anchor_embedding.buffer, row.anchor_embedding.byteOffset, row.anchor_embedding.length / 4);
    return Array.from(float32);
}

/**
 * Get all images containing a specific person
 */
export function getImagesByPerson(personId: number): ImageRecord[] {
    const db = getDatabase();

    return db.prepare(`
        SELECT DISTINCT i.* FROM images i
        JOIN faces f ON f.image_id = i.id
        WHERE f.person_id = ?
        ORDER BY i.date_taken DESC
    `).all(personId) as ImageRecord[];
}

/**
 * Get all people with embeddings for matching
 */
export function getPeopleWithEmbeddings(): { id: number; name: string; embedding: number[] }[] {
    const db = getDatabase();

    const rows = db.prepare(`
        SELECT id, name, anchor_embedding
        FROM people
        WHERE anchor_embedding IS NOT NULL AND is_hidden = FALSE
    `).all() as { id: number; name: string; anchor_embedding: Buffer }[];

    return rows.map(row => {
        const float32 = new Float32Array(row.anchor_embedding.buffer, row.anchor_embedding.byteOffset, row.anchor_embedding.length / 4);
        return {
            id: row.id,
            name: row.name,
            embedding: Array.from(float32),
        };
    });
}

/**
 * Set representative face for a person
 */
export function setRepresentativeFace(personId: number, faceId: number): void {
    const db = getDatabase();
    db.prepare('UPDATE people SET representative_face_id = ? WHERE id = ?').run(faceId, personId);
}

/**
 * Hide/unhide a person
 */
export function setPersonHidden(personId: number, hidden: boolean): void {
    const db = getDatabase();
    db.prepare('UPDATE people SET is_hidden = ? WHERE id = ?').run(hidden ? 1 : 0, personId);
}

/**
 * Clean up duplicate face entries.
 * Keeps only one face per image_id (the one with the lowest id, which was first inserted).
 * Returns the number of duplicates removed.
 */
export function cleanupDuplicateFaces(): { duplicatesRemoved: number; imagesAffected: number } {
    const db = getDatabase();

    // Find images that have more than one face entry (duplicates)
    const duplicates = db.prepare(`
        SELECT image_id, COUNT(*) as cnt, MIN(id) as keep_id
        FROM faces
        GROUP BY image_id
        HAVING COUNT(*) > 1
    `).all() as { image_id: number; cnt: number; keep_id: number }[];

    let duplicatesRemoved = 0;

    for (const dup of duplicates) {
        // Delete all faces for this image except the one with lowest id
        const result = db.prepare(`
            DELETE FROM faces 
            WHERE image_id = ? AND id != ?
        `).run(dup.image_id, dup.keep_id);

        duplicatesRemoved += result.changes;
    }

    console.log(`Cleaned up ${duplicatesRemoved} duplicate faces across ${duplicates.length} images`);
    return { duplicatesRemoved, imagesAffected: duplicates.length };
}

// ============================================
// Album Operations
// ============================================

export interface AlbumRecord {
    id: number;
    name: string;
    description: string | null;
    cover_image_id: number | null;
    created_at: string;
    updated_at: string;
    photo_count?: number;
    cover_path?: string;
}

/**
 * Create a new album
 */
export function createAlbum(name: string, description?: string): AlbumRecord {
    const db = getDatabase();

    const result = db.prepare(`
        INSERT INTO albums (name, description)
        VALUES (?, ?)
    `).run(name, description ?? null);

    return {
        id: result.lastInsertRowid as number,
        name,
        description: description ?? null,
        cover_image_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        photo_count: 0,
    };
}

/**
 * Get all albums with photo counts and cover images
 */
export function getAllAlbums(): AlbumRecord[] {
    const db = getDatabase();

    return db.prepare(`
        SELECT 
            a.*,
            COUNT(ai.image_id) as photo_count,
            COALESCE(cover.file_path, first_img.file_path) as cover_path
        FROM albums a
        LEFT JOIN album_items ai ON ai.album_id = a.id
        LEFT JOIN images cover ON cover.id = a.cover_image_id
        LEFT JOIN (
            SELECT ai2.album_id, i.file_path
            FROM album_items ai2
            JOIN images i ON i.id = ai2.image_id
            WHERE ai2.position = (
                SELECT MIN(position) FROM album_items WHERE album_id = ai2.album_id
            )
        ) first_img ON first_img.album_id = a.id
        GROUP BY a.id
        ORDER BY a.updated_at DESC
    `).all() as AlbumRecord[];
}

/**
 * Get images in an album
 */
export function getAlbumImages(albumId: number): ImageRecord[] {
    const db = getDatabase();

    return db.prepare(`
        SELECT i.* FROM images i
        JOIN album_items ai ON ai.image_id = i.id
        WHERE ai.album_id = ?
        ORDER BY ai.position ASC, ai.added_at ASC
    `).all(albumId) as ImageRecord[];
}

/**
 * Add photos to an album
 */
export function addPhotosToAlbum(albumId: number, imageIds: number[]): { added: number } {
    const db = getDatabase();

    const stmt = db.prepare(`
        INSERT OR IGNORE INTO album_items (album_id, image_id, position)
        VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM album_items WHERE album_id = ?))
    `);

    let added = 0;
    for (const imageId of imageIds) {
        const result = stmt.run(albumId, imageId, albumId);
        added += result.changes;
    }

    // Update album's updated_at timestamp
    db.prepare(`UPDATE albums SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(albumId);

    return { added };
}

/**
 * Remove photos from an album
 */
export function removePhotosFromAlbum(albumId: number, imageIds: number[]): { removed: number } {
    const db = getDatabase();

    const placeholders = imageIds.map(() => '?').join(',');
    const result = db.prepare(`
        DELETE FROM album_items 
        WHERE album_id = ? AND image_id IN (${placeholders})
    `).run(albumId, ...imageIds);

    db.prepare(`UPDATE albums SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(albumId);

    return { removed: result.changes };
}

/**
 * Update album details
 */
export function updateAlbum(albumId: number, updates: { name?: string; description?: string; cover_image_id?: number | null }): void {
    const db = getDatabase();

    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: (string | number | null)[] = [];

    if (updates.name !== undefined) {
        setClauses.push('name = ?');
        values.push(updates.name);
    }
    if (updates.description !== undefined) {
        setClauses.push('description = ?');
        values.push(updates.description);
    }
    if (updates.cover_image_id !== undefined) {
        setClauses.push('cover_image_id = ?');
        values.push(updates.cover_image_id);
    }

    values.push(albumId);
    db.prepare(`UPDATE albums SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}

/**
 * Delete an album (photos are not deleted, just the album membership)
 */
export function deleteAlbum(albumId: number): void {
    const db = getDatabase();
    db.prepare('DELETE FROM albums WHERE id = ?').run(albumId);
}

