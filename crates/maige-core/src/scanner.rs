//! Image scanning — recursively find all supported image files in a directory.

use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::error::{Error, Result};

/// Supported image file extensions
pub const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif",
    "cr2", "arw", "dng", "nef", "orf", "rw2",
];

/// Check if a file extension is a supported image format
pub fn is_supported(ext: &str) -> bool {
    SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str())
}

/// Recursively scan a directory for supported image files.
/// Hidden directories (starting with `.`) are skipped.
pub fn scan_directory(dir_path: &str) -> Result<Vec<String>> {
    let mut images = Vec::new();
    scan_recursive(Path::new(dir_path), &mut images)?;
    Ok(images)
}

fn scan_recursive(dir: &Path, images: &mut Vec<String>) -> Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(dir).map_err(Error::Io)? {
        let entry = entry.map_err(Error::Io)?;
        let path = entry.path();

        if path.is_dir() {
            let is_hidden = path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with('.'))
                .unwrap_or(false);
            if !is_hidden {
                scan_recursive(&path, images)?;
            }
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if is_supported(ext) {
                if let Some(path_str) = path.to_str() {
                    images.push(path_str.to_string());
                }
            }
        }
    }

    Ok(())
}

/// Calculate SHA-256 file hash for a given path.
pub fn file_sha256(path: &str) -> Result<String> {
    let mut file = fs::File::open(path).map_err(|e| Error::Io(e))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf).map_err(|e| Error::Io(e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Walk the directory tree and return a list of all image `PathBuf`s.
/// (Alternative that preserves `PathBuf` types for internal use.)
pub fn scan_directory_paths(dir_path: &str) -> Result<Vec<PathBuf>> {
    let strings = scan_directory(dir_path)?;
    Ok(strings.into_iter().map(PathBuf::from).collect())
}
