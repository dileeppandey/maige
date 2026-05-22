//! Image metadata extraction — dimensions, format, and basic EXIF fields.

use image::GenericImageView;
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::{Error, Result};

/// All metadata extracted from an image file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    /// File extension / format, lowercased (e.g. "jpeg", "png")
    pub format: String,
    pub has_alpha: bool,
    // EXIF fields — populated when available, None otherwise
    pub date_taken: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub focal_length: Option<f64>,
    pub aperture: Option<f64>,
    pub iso: Option<u32>,
    pub shutter_speed: Option<String>,
}

/// Extract metadata from an image file at `path`.
pub fn extract_metadata(path: &str) -> Result<ImageMetadata> {
    let img = image::open(path).map_err(|e| Error::Image(e))?;
    let (width, height) = img.dimensions();

    let format = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_lowercase();

    let has_alpha = img.color().has_alpha();

    Ok(ImageMetadata {
        width,
        height,
        format,
        has_alpha,
        // EXIF extraction is a future improvement — a dedicated crate like
        // `kamadak-exif` or `rexiv2` would be added here.
        date_taken: None,
        camera_make: None,
        camera_model: None,
        focal_length: None,
        aperture: None,
        iso: None,
        shutter_speed: None,
    })
}
