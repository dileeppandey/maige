/**
 * Face Service for face detection processing, storage, and clustering
 * Works with MediaPipe face detections from the renderer process
 */

import sharp from 'sharp';
import path from 'path';
import {
    insertFace,
    getFacesForImage,
    getFaceEmbedding,
    updateFaceEmbedding,
    assignFaceToPerson as dbAssignFaceToPerson,
    getUnidentifiedFaces,
    createPerson,
    getAllPeople,
    getPersonById,
    updatePersonAnchorEmbedding,
    getPersonAnchorEmbedding,
    getPeopleWithEmbeddings,
    setRepresentativeFace,
    FaceRecord,
} from './database.js';
import { generateEmbedding, cosineSimilarity } from './clipService.js';

// ============================================
// Types
// ============================================

export interface FaceDetection {
    bbox: { x: number; y: number; width: number; height: number };
    keypoints?: { x: number; y: number; name: string }[];
    confidence: number;
}

export interface SuggestedMatch {
    personId: number;
    personName: string;
    similarity: number;
}

export interface FaceCluster {
    centroidFaceId: number;
    faceIds: number[];
    suggestedName?: string;
}

// Configuration
const MATCH_THRESHOLD = 0.75; // Minimum similarity to suggest a match
const CLUSTER_THRESHOLD = 0.70; // Minimum similarity for clustering

// ============================================
// Face Detection Processing
// ============================================

/**
 * Process face detections from MediaPipe and save to database.
 * Also generates face embeddings using CLIP.
 */
export async function processFaceDetections(
    imageId: number,
    imagePath: string,
    detections: FaceDetection[]
): Promise<{ faceId: number; suggestedMatch: SuggestedMatch | null }[]> {
    const results: { faceId: number; suggestedMatch: SuggestedMatch | null }[] = [];

    // Check if faces already exist for this image (prevent duplicates on re-import)
    const existingFaces = getFacesForImage(imageId);
    if (existingFaces.length > 0) {
        console.log(`Skipping face detection for image ${imageId} - ${existingFaces.length} faces already exist`);
        return existingFaces.map(f => ({ faceId: f.id, suggestedMatch: null }));
    }

    for (const detection of detections) {
        // Convert MediaPipe bbox format to normalized values
        const bbox = {
            x: detection.bbox.x,
            y: detection.bbox.y,
            w: detection.bbox.width,
            h: detection.bbox.height,
        };

        // Insert face record (without embedding initially)
        const faceId = insertFace(imageId, bbox, detection.confidence);

        // Generate face embedding from cropped face
        try {
            const faceBuffer = await getFaceCrop(imagePath, bbox);
            const tempPath = path.join(
                process.env.TMPDIR || '/tmp',
                `face_${faceId}_${Date.now()}.jpg`
            );

            // Write temp file for CLIP processing
            await sharp(faceBuffer).toFile(tempPath);

            const embedding = await generateEmbedding(tempPath);

            // Clean up temp file
            const fs = await import('fs/promises');
            await fs.unlink(tempPath).catch(() => { });

            if (embedding) {
                updateFaceEmbedding(faceId, embedding);

                // Try to match against known people
                const suggestedMatch = await matchFaceToPeople(embedding);
                results.push({ faceId, suggestedMatch });
            } else {
                results.push({ faceId, suggestedMatch: null });
            }
        } catch (error) {
            console.error('Failed to process face embedding:', error);
            results.push({ faceId, suggestedMatch: null });
        }
    }

    return results;
}

/**
 * Extract a cropped face region from an image
 */
export async function getFaceCrop(
    imagePath: string,
    bbox: { x: number; y: number; w: number; h: number }
): Promise<Buffer> {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
        throw new Error('Could not get image dimensions');
    }

    // Convert normalized coords to pixels with some padding
    const padding = 0.1; // 10% padding
    const left = Math.max(0, Math.floor((bbox.x - padding) * metadata.width));
    const top = Math.max(0, Math.floor((bbox.y - padding) * metadata.height));
    const width = Math.min(
        metadata.width - left,
        Math.floor((bbox.w + padding * 2) * metadata.width)
    );
    const height = Math.min(
        metadata.height - top,
        Math.floor((bbox.h + padding * 2) * metadata.height)
    );

    return image
        .extract({ left, top, width, height })
        .resize(224, 224) // CLIP input size
        .jpeg()
        .toBuffer();
}

// ============================================
// Face Matching
// ============================================

/**
 * Match a face embedding against known people
 */
export async function matchFaceToPeople(
    faceEmbedding: number[]
): Promise<SuggestedMatch | null> {
    const people = getPeopleWithEmbeddings();

    if (people.length === 0) {
        return null;
    }

    let bestMatch: SuggestedMatch | null = null;
    let bestSimilarity = 0;

    for (const person of people) {
        const similarity = cosineSimilarity(faceEmbedding, person.embedding);

        if (similarity > bestSimilarity && similarity >= MATCH_THRESHOLD) {
            bestSimilarity = similarity;
            bestMatch = {
                personId: person.id,
                personName: person.name,
                similarity,
            };
        }
    }

    return bestMatch;
}

// ============================================
// Person Management
// ============================================

/**
 * Assign a face to a person and update the person's anchor embedding
 */
export async function assignFaceToPerson(
    faceId: number,
    personId: number
): Promise<void> {
    // Assign in database
    dbAssignFaceToPerson(faceId, personId);

    // Update anchor embedding for the person
    await recalculatePersonAnchor(personId);

    // If person has no representative face, set this one
    const person = getPersonById(personId);
    if (person && !person.representative_face_id) {
        setRepresentativeFace(personId, faceId);
    }
}

/**
 * Create a new person from an unidentified face
 */
export async function createPersonFromFace(
    faceId: number,
    name: string
): Promise<number> {
    // Create the person with this face as representative
    const personId = createPerson(name, faceId);

    // Assign the face to the person
    dbAssignFaceToPerson(faceId, personId);

    // Get face embedding and set as anchor
    const embedding = getFaceEmbedding(faceId);
    if (embedding) {
        updatePersonAnchorEmbedding(personId, embedding);
    }

    return personId;
}

/**
 * Create a new person from a cluster of faces (assigns ALL faces in cluster to one person)
 * If a person with this name already exists, adds the faces to them instead.
 */
export async function createPersonFromCluster(
    faceIds: number[],
    name: string
): Promise<number> {
    if (faceIds.length === 0) {
        throw new Error('Cannot create person from empty cluster');
    }

    // Import getPersonByName
    const { getPersonByName } = await import('./database.js');

    // Check if person with this name already exists
    const existingPerson = getPersonByName(name);
    let personId: number;

    if (existingPerson) {
        // Add faces to existing person
        personId = existingPerson.id;
        console.log(`Adding ${faceIds.length} faces to existing person: ${name} (ID: ${personId})`);
    } else {
        // Create new person with the first face as representative
        const representativeFaceId = faceIds[0];
        personId = createPerson(name, representativeFaceId);
        console.log(`Created new person: ${name} (ID: ${personId})`);
    }

    // Assign ALL faces in the cluster to this person
    for (const faceId of faceIds) {
        dbAssignFaceToPerson(faceId, personId);
    }

    // Recalculate anchor embedding for the person (includes new faces)
    await recalculatePersonAnchor(personId);

    return personId;
}


/**
 * Recalculate a person's anchor embedding as average of all their face embeddings
 */
export async function recalculatePersonAnchor(personId: number): Promise<void> {
    const person = getPersonById(personId);
    if (!person) return;

    // Get all face embeddings for this person
    const allPeople = getAllPeople();
    const personWithFaces = allPeople.find(p => p.id === personId);

    if (!personWithFaces || personWithFaces.face_count === 0) {
        return;
    }

    // Get faces for this person - need to query directly
    const { getDatabase } = await import('./database.js');
    const db = getDatabase();
    const faces = db.prepare(`
        SELECT id FROM faces WHERE person_id = ?
    `).all(personId) as { id: number }[];

    if (faces.length === 0) return;

    // Collect embeddings
    const embeddings: number[][] = [];
    for (const face of faces) {
        const embedding = getFaceEmbedding(face.id);
        if (embedding) {
            embeddings.push(embedding);
        }
    }

    if (embeddings.length === 0) return;

    // Calculate average embedding
    const avgEmbedding = new Array(embeddings[0].length).fill(0);
    for (const emb of embeddings) {
        for (let i = 0; i < emb.length; i++) {
            avgEmbedding[i] += emb[i];
        }
    }
    for (let i = 0; i < avgEmbedding.length; i++) {
        avgEmbedding[i] /= embeddings.length;
    }

    // Normalize the average
    const norm = Math.sqrt(avgEmbedding.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < avgEmbedding.length; i++) {
        avgEmbedding[i] /= norm;
    }

    updatePersonAnchorEmbedding(personId, avgEmbedding);
}

// ============================================
// Face Clustering
// ============================================

/**
 * Cluster unidentified faces by embedding similarity
 */
export function clusterUnidentifiedFaces(): FaceCluster[] {
    const unidentified = getUnidentifiedFaces();
    const clusters: FaceCluster[] = [];
    const assigned = new Set<number>();

    // Get embeddings for all unidentified faces
    const facesWithEmbeddings: { face: FaceRecord & { file_path: string }; embedding: number[] }[] = [];
    for (const face of unidentified) {
        const embedding = getFaceEmbedding(face.id);
        if (embedding) {
            facesWithEmbeddings.push({ face, embedding });
        }
    }

    // Simple greedy clustering
    for (const { face, embedding } of facesWithEmbeddings) {
        if (assigned.has(face.id)) continue;

        // Find all similar faces
        const clusterFaceIds: number[] = [face.id];
        assigned.add(face.id);

        for (const other of facesWithEmbeddings) {
            if (assigned.has(other.face.id)) continue;

            const similarity = cosineSimilarity(embedding, other.embedding);
            if (similarity >= CLUSTER_THRESHOLD) {
                clusterFaceIds.push(other.face.id);
                assigned.add(other.face.id);
            }
        }

        clusters.push({
            centroidFaceId: face.id,
            faceIds: clusterFaceIds,
        });
    }

    return clusters;
}

/**
 * Get face statistics
 */
export function getFaceStats(): {
    totalFaces: number;
    identifiedFaces: number;
    unidentifiedFaces: number;
    totalPeople: number;
} {
    const people = getAllPeople();
    const unidentified = getUnidentifiedFaces();

    const totalIdentified = people.reduce((sum, p) => sum + p.face_count, 0);

    return {
        totalFaces: totalIdentified + unidentified.length,
        identifiedFaces: totalIdentified,
        unidentifiedFaces: unidentified.length,
        totalPeople: people.length,
    };
}
