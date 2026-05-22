//! Main image processor - load, decode, and process images

use crate::adjustments::{apply_adjustments, Adjustments};
use crate::error::{Error, Result};
use crate::histogram::Histogram;
use crate::phash::{generate_dhash_from_image, PHash};
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use std::path::Path;

/// Image processor for loading and processing images
pub struct ImageProcessor {
    /// The original image (never modified)
    original: Option<DynamicImage>,
    /// Path to the currently loaded image
    current_path: Option<String>,
}

impl Default for ImageProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl ImageProcessor {
    /// Create a new ImageProcessor
    pub fn new() -> Self {
        Self {
            original: None,
            current_path: None,
        }
    }

    /// Load an image from a file path
    pub fn load<P: AsRef<Path>>(&mut self, path: P) -> Result<()> {
        let path_ref = path.as_ref();
        let path_str = path_ref.to_string_lossy().to_string();
        
        let img = image::open(path_ref)?;
        
        self.original = Some(img);
        self.current_path = Some(path_str);
        
        Ok(())
    }

    /// Check if an image is loaded
    pub fn is_loaded(&self) -> bool {
        self.original.is_some()
    }

    /// Get current image path
    pub fn current_path(&self) -> Option<&str> {
        self.current_path.as_deref()
    }

    /// Get image dimensions
    pub fn dimensions(&self) -> Option<(u32, u32)> {
        self.original.as_ref().map(|img| img.dimensions())
    }

    /// Process image with adjustments and return RGBA buffer
    pub fn process(&self, adjustments: &Adjustments) -> Result<Vec<u8>> {
        let img = self.original.as_ref()
            .ok_or_else(|| Error::Processing("No image loaded".to_string()))?;
        
        // Convert to RGBA
        let rgba = img.to_rgba8();
        let mut buffer: Vec<u8> = rgba.into_raw();
        
        // Apply adjustments
        apply_adjustments(&mut buffer, adjustments);
        
        Ok(buffer)
    }

    /// Process and return as DynamicImage
    pub fn process_to_image(&self, adjustments: &Adjustments) -> Result<DynamicImage> {
        let buffer = self.process(adjustments)?;
        let (width, height) = self.dimensions()
            .ok_or_else(|| Error::Processing("No image loaded".to_string()))?;
        
        let img_buffer: ImageBuffer<Rgba<u8>, Vec<u8>> =
            ImageBuffer::from_raw(width, height, buffer)
                .ok_or_else(|| Error::Processing("Failed to create image buffer".to_string()))?;
        
        Ok(DynamicImage::ImageRgba8(img_buffer))
    }

    /// Generate histogram from processed image
    pub fn histogram(&self, adjustments: &Adjustments) -> Result<Histogram> {
        let buffer = self.process(adjustments)?;
        Ok(Histogram::from_rgba(&buffer))
    }

    /// Generate histogram from original image (no adjustments)
    pub fn original_histogram(&self) -> Result<Histogram> {
        self.histogram(&Adjustments::default())
    }

    /// Generate perceptual hash
    pub fn phash(&self) -> Result<PHash> {
        let img = self.original.as_ref()
            .ok_or_else(|| Error::Processing("No image loaded".to_string()))?;
        PHash::from_image(img)
    }

    /// Generate dHash (JS-compatible)
    pub fn dhash(&self) -> Result<String> {
        let img = self.original.as_ref()
            .ok_or_else(|| Error::Processing("No image loaded".to_string()))?;
        generate_dhash_from_image(img)
    }

    /// Export processed image to a file
    pub fn export<P: AsRef<Path>>(
        &self,
        path: P,
        adjustments: &Adjustments,
        format: ExportFormat,
        quality: u8,
    ) -> Result<()> {
        let img = self.process_to_image(adjustments)?;
        
        match format {
            ExportFormat::Jpeg => {
                let rgb = img.to_rgb8();
                let mut output = std::fs::File::create(path.as_ref())?;
                let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, quality);
                rgb.write_with_encoder(encoder)?;
            }
            ExportFormat::Png => {
                img.save(path.as_ref())?;
            }
            ExportFormat::WebP => {
                // WebP support via image crate
                img.save(path.as_ref())?;
            }
        }
        
        Ok(())
    }

    /// Get the original image bytes (RGBA)
    pub fn original_rgba(&self) -> Result<Vec<u8>> {
        let img = self.original.as_ref()
            .ok_or_else(|| Error::Processing("No image loaded".to_string()))?;
        Ok(img.to_rgba8().into_raw())
    }
}

/// Export format options
#[derive(Debug, Clone, Copy)]
pub enum ExportFormat {
    Jpeg,
    Png,
    WebP,
}

/// Supported image extensions
pub const SUPPORTED_EXTENSIONS: &[&str] = &[
    // Standard formats
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif",
];

/// Check if a file extension is supported
pub fn is_supported_extension(ext: &str) -> bool {
    SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_supported_extensions() {
        assert!(is_supported_extension("jpg"));
        assert!(is_supported_extension("JPG"));
        assert!(!is_supported_extension("txt"));
    }
}
