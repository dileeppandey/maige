//! Perceptual hashing for duplicate detection

use crate::error::{Error, Result};
use img_hash::HasherConfig;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Perceptual hash wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PHash {
    /// Base64 representation of the hash
    pub hash: String,
    /// Size of the hash in bits
    pub bits: usize,
}

impl PHash {
    /// Generate perceptual hash from an image file
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        // Use img_hash's re-exported image crate to avoid version conflicts
        let img = img_hash::image::open(path.as_ref())
            .map_err(|e| Error::ImageLoad(e.to_string()))?;
        Self::from_hash_image(&img)
    }

    /// Generate perceptual hash from img_hash's DynamicImage
    fn from_hash_image(img: &img_hash::image::DynamicImage) -> Result<Self> {
        let hasher = HasherConfig::new()
            .hash_size(16, 16) // 256-bit hash for good accuracy
            .to_hasher();

        let hash = hasher.hash_image(img);
        
        Ok(Self {
            hash: hash.to_base64(),
            bits: 256,
        })
    }

    /// Generate perceptual hash from our image crate's DynamicImage
    /// Converts through raw bytes to avoid version conflicts
    pub fn from_image(img: &image::DynamicImage) -> Result<Self> {
        // Convert to raw RGBA bytes and reconstruct using img_hash's image crate
        let rgba = img.to_rgba8();
        let (width, height) = rgba.dimensions();
        let raw = rgba.into_raw();
        
        let hash_img: img_hash::image::RgbaImage = 
            img_hash::image::ImageBuffer::from_raw(width, height, raw)
                .ok_or_else(|| Error::Processing("Failed to create image buffer".to_string()))?;
        
        let hasher = HasherConfig::new()
            .hash_size(16, 16)
            .to_hasher();
        
        let hash = hasher.hash_image(&hash_img);
        
        Ok(Self {
            hash: hash.to_base64(),
            bits: 256,
        })
    }

    /// Calculate Hamming distance between two hashes
    /// Returns the number of bits that differ
    pub fn hamming_distance(&self, other: &PHash) -> Result<u32> {
        let hash1: img_hash::ImageHash<Box<[u8]>> = img_hash::ImageHash::from_base64(&self.hash)
            .map_err(|e| Error::HashError(format!("Invalid hash: {:?}", e)))?;
        let hash2: img_hash::ImageHash<Box<[u8]>> = img_hash::ImageHash::from_base64(&other.hash)
            .map_err(|e| Error::HashError(format!("Invalid hash: {:?}", e)))?;
        
        Ok(hash1.dist(&hash2))
    }

    /// Check if two images are considered duplicates
    /// Threshold of 10 means images with <= 10 bit differences are duplicates
    pub fn is_duplicate(&self, other: &PHash, threshold: u32) -> Result<bool> {
        let distance = self.hamming_distance(other)?;
        Ok(distance <= threshold)
    }

    /// Static helper to calculate hamming distance between two hash strings
    pub fn hamming_distance_strings(hash1: &str, hash2: &str) -> Result<u32> {
        let h1: img_hash::ImageHash<Box<[u8]>> = img_hash::ImageHash::from_base64(hash1)
            .map_err(|e| Error::HashError(format!("Invalid hash1: {:?}", e)))?;
        let h2: img_hash::ImageHash<Box<[u8]>> = img_hash::ImageHash::from_base64(hash2)
            .map_err(|e| Error::HashError(format!("Invalid hash2: {:?}", e)))?;
        
        Ok(h1.dist(&h2))
    }
}

/// Generate a simpler dHash (difference hash) compatible with the JS implementation
/// This produces a 64-bit hash as hex string
pub fn generate_dhash<P: AsRef<Path>>(path: P) -> Result<String> {
    let img = image::open(path.as_ref()).map_err(|e| Error::ImageLoad(e.to_string()))?;
    generate_dhash_from_image(&img)
}

/// Generate dHash from a DynamicImage
pub fn generate_dhash_from_image(img: &image::DynamicImage) -> Result<String> {
    // Resize to 9x8 grayscale (we need 9 columns to get 8 differences per row)
    let resized = img.resize_exact(9, 8, image::imageops::FilterType::Lanczos3);
    let gray = resized.to_luma8();
    
    let mut hash: u64 = 0;
    let mut bit_index = 0;
    
    for y in 0..8 {
        for x in 0..8 {
            let left = gray.get_pixel(x, y)[0];
            let right = gray.get_pixel(x + 1, y)[0];
            
            if left > right {
                hash |= 1 << bit_index;
            }
            bit_index += 1;
        }
    }
    
    Ok(format!("{:016x}", hash))
}

/// Calculate hamming distance between two hex hash strings (for dHash)
pub fn hamming_distance_hex(hash1: &str, hash2: &str) -> Result<u32> {
    if hash1.len() != hash2.len() {
        return Err(Error::HashError("Hash lengths don't match".to_string()));
    }
    
    let h1 = u64::from_str_radix(hash1, 16)
        .map_err(|e| Error::HashError(format!("Invalid hex hash1: {}", e)))?;
    let h2 = u64::from_str_radix(hash2, 16)
        .map_err(|e| Error::HashError(format!("Invalid hex hash2: {}", e)))?;
    
    Ok((h1 ^ h2).count_ones())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hamming_distance_hex() {
        // Identical hashes
        assert_eq!(hamming_distance_hex("0000000000000000", "0000000000000000").unwrap(), 0);
        
        // One bit different
        assert_eq!(hamming_distance_hex("0000000000000001", "0000000000000000").unwrap(), 1);
        
        // All bits different
        assert_eq!(hamming_distance_hex("ffffffffffffffff", "0000000000000000").unwrap(), 64);
    }
}
