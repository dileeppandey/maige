//! NAPI-RS bindings for Node.js integration
//!
//! This module exposes the maige-core library to Node.js/Electron

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::adjustments::{Adjustments, ColorAdjustments, LightAdjustments};
use crate::histogram::Histogram;
use crate::phash::{generate_dhash, hamming_distance_hex, PHash};
use crate::processor::ImageProcessor;

/// Light adjustments for Node.js
#[napi(object)]
#[derive(Default)]
pub struct JsLightAdjustments {
    pub exposure: f64,
    pub contrast: f64,
    pub highlights: f64,
    pub shadows: f64,
    pub whites: f64,
    pub blacks: f64,
}

impl From<JsLightAdjustments> for LightAdjustments {
    fn from(js: JsLightAdjustments) -> Self {
        Self {
            exposure: js.exposure as f32,
            contrast: js.contrast as f32,
            highlights: js.highlights as f32,
            shadows: js.shadows as f32,
            whites: js.whites as f32,
            blacks: js.blacks as f32,
        }
    }
}

/// Color adjustments for Node.js
#[napi(object)]
#[derive(Default)]
pub struct JsColorAdjustments {
    pub temperature: f64,
    pub tint: f64,
    pub saturation: f64,
    pub vibrance: f64,
}

impl From<JsColorAdjustments> for ColorAdjustments {
    fn from(js: JsColorAdjustments) -> Self {
        Self {
            temperature: js.temperature as f32,
            tint: js.tint as f32,
            saturation: js.saturation as f32,
            vibrance: js.vibrance as f32,
        }
    }
}

/// Combined adjustments for Node.js
#[napi(object)]
#[derive(Default)]
pub struct JsAdjustments {
    pub light: JsLightAdjustments,
    pub color: JsColorAdjustments,
}

impl From<JsAdjustments> for Adjustments {
    fn from(js: JsAdjustments) -> Self {
        Self {
            light: js.light.into(),
            color: js.color.into(),
        }
    }
}

/// Histogram result for Node.js
#[napi(object)]
pub struct JsHistogram {
    pub r: Vec<u32>,
    pub g: Vec<u32>,
    pub b: Vec<u32>,
    pub lum: Vec<u32>,
}

impl From<Histogram> for JsHistogram {
    fn from(h: Histogram) -> Self {
        Self {
            r: h.r,
            g: h.g,
            b: h.b,
            lum: h.lum,
        }
    }
}

/// Perceptual hash result for Node.js
#[napi(object)]
pub struct JsPHash {
    pub hash: String,
    pub bits: u32,
}

impl From<PHash> for JsPHash {
    fn from(p: PHash) -> Self {
        Self {
            hash: p.hash,
            bits: p.bits as u32,
        }
    }
}

/// Native image processor wrapper for Node.js
#[napi]
pub struct NativeImageProcessor {
    inner: ImageProcessor,
}

#[napi]
impl NativeImageProcessor {
    /// Create a new image processor
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: ImageProcessor::new(),
        }
    }

    /// Load an image from a file path
    #[napi]
    pub fn load(&mut self, path: String) -> napi::Result<()> {
        self.inner
            .load(&path)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Check if an image is loaded
    #[napi]
    pub fn is_loaded(&self) -> bool {
        self.inner.is_loaded()
    }

    /// Get image dimensions
    #[napi]
    pub fn dimensions(&self) -> Option<Vec<u32>> {
        self.inner.dimensions().map(|(w, h)| vec![w, h])
    }

    /// Process image with adjustments and return RGBA buffer
    #[napi]
    pub fn process(&self, adjustments: JsAdjustments) -> napi::Result<Buffer> {
        let adj: Adjustments = adjustments.into();
        let buffer = self
            .inner
            .process(&adj)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(Buffer::from(buffer))
    }

    /// Generate histogram from processed image
    #[napi]
    pub fn histogram(&self, adjustments: JsAdjustments) -> napi::Result<JsHistogram> {
        let adj: Adjustments = adjustments.into();
        let hist = self
            .inner
            .histogram(&adj)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(hist.into())
    }

    /// Generate perceptual hash
    #[napi]
    pub fn phash(&self) -> napi::Result<JsPHash> {
        let hash = self
            .inner
            .phash()
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(hash.into())
    }

    /// Generate dHash (JS-compatible 64-bit hex hash)
    #[napi]
    pub fn dhash(&self) -> napi::Result<String> {
        self.inner
            .dhash()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Get original image as RGBA buffer
    #[napi]
    pub fn original_rgba(&self) -> napi::Result<Buffer> {
        let buffer = self
            .inner
            .original_rgba()
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(Buffer::from(buffer))
    }
}

// Standalone functions

/// Generate dHash from a file path
#[napi]
pub fn generate_dhash_from_file(path: String) -> napi::Result<String> {
    generate_dhash(&path).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Calculate hamming distance between two hex hashes
#[napi]
pub fn calculate_hamming_distance(hash1: String, hash2: String) -> napi::Result<u32> {
    hamming_distance_hex(&hash1, &hash2).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Check if two images are duplicates based on dHash
#[napi]
pub fn are_duplicates(hash1: String, hash2: String, threshold: Option<u32>) -> napi::Result<bool> {
    let threshold = threshold.unwrap_or(10);
    let distance =
        hamming_distance_hex(&hash1, &hash2).map_err(|e| napi::Error::from_reason(e.to_string()))?;
    Ok(distance <= threshold)
}

/// Apply adjustments to a raw RGBA buffer
#[napi]
pub fn apply_adjustments_to_buffer(
    buffer: Buffer,
    width: u32,
    height: u32,
    adjustments: JsAdjustments,
) -> napi::Result<Buffer> {
    let expected_len = (width * height * 4) as usize;
    if buffer.len() != expected_len {
        return Err(napi::Error::from_reason(format!(
            "Buffer size mismatch: expected {}, got {}",
            expected_len,
            buffer.len()
        )));
    }

    let adj: Adjustments = adjustments.into();
    let mut data = buffer.to_vec();
    crate::adjustments::apply_adjustments(&mut data, &adj);

    Ok(Buffer::from(data))
}

/// Generate histogram from raw RGBA buffer
#[napi]
pub fn generate_histogram_from_buffer(buffer: Buffer) -> JsHistogram {
    let hist = Histogram::from_rgba(&buffer);
    hist.into()
}
