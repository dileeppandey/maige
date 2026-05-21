//! Maige Core — High-performance image processing library
//!
//! This is the canonical Rust implementation of all image processing operations
//! for the Maige image editor. `maige-tauri` depends on this crate and delegates
//! all pixel-level work here, eliminating duplication.
//!
//! # Modules
//! - [`adjustments`] — Light + color adjustment algorithms (rayon-parallel)
//! - [`histogram`] — RGB + luminance histogram generation
//! - [`metadata`] — Image dimension and EXIF metadata extraction
//! - [`phash`] — Perceptual hashing (dHash) for duplicate detection
//! - [`processor`] — High-level `ImageProcessor`: load → process → export
//! - [`scanner`] — Recursive directory scanning + SHA-256 file hashing
//! - [`error`] — Unified error type

pub mod adjustments;
pub mod error;
pub mod histogram;
pub mod metadata;
pub mod phash;
pub mod processor;
pub mod scanner;

// Re-export the most commonly used types at the crate root
pub use adjustments::{Adjustments, ColorAdjustments, LightAdjustments};
pub use error::{Error, Result};
pub use histogram::Histogram;
pub use metadata::{extract_metadata, ImageMetadata};
pub use phash::PHash;
pub use processor::ImageProcessor;
pub use scanner::{file_sha256, scan_directory, SUPPORTED_EXTENSIONS};
