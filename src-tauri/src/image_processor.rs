//! Image processing module
//! 
//! Native Rust image processing replacing Sharp

use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::Path;

use crate::database::AnalyzedImage;

/// Image extensions we support
const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif",
    "cr2", "arw", "dng", "nef", "orf", "rw2",
];

/// Image metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub color_space: Option<String>,
    pub has_alpha: Option<bool>,
    pub date_taken: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub focal_length: Option<f64>,
    pub aperture: Option<f64>,
    pub iso: Option<u32>,
    pub shutter_speed: Option<String>,
}

/// Histogram data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Histogram {
    pub r: Vec<u32>,
    pub g: Vec<u32>,
    pub b: Vec<u32>,
    pub lum: Vec<u32>,
}

/// Light adjustments
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LightAdjustments {
    pub exposure: f64,
    pub contrast: f64,
    pub highlights: f64,
    pub shadows: f64,
    pub whites: f64,
    pub blacks: f64,
}

/// Color adjustments
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ColorAdjustments {
    pub temperature: f64,
    pub tint: f64,
    pub saturation: f64,
    pub vibrance: f64,
}

/// Combined adjustments
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Adjustments {
    pub light: LightAdjustments,
    pub color: ColorAdjustments,
}

/// Scan directory for images
pub async fn scan_directory(dir_path: &str) -> anyhow::Result<Vec<String>> {
    let mut images = Vec::new();
    scan_dir_recursive(Path::new(dir_path), &mut images)?;
    Ok(images)
}

fn scan_dir_recursive(dir: &Path, images: &mut Vec<String>) -> anyhow::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }
    
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_dir() {
            // Skip hidden directories
            if !path.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with('.'))
                .unwrap_or(false) 
            {
                scan_dir_recursive(&path, images)?;
            }
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if IMAGE_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                if let Some(path_str) = path.to_str() {
                    images.push(path_str.to_string());
                }
            }
        }
    }
    
    Ok(())
}

/// Get image metadata
pub async fn get_metadata(path: &str) -> anyhow::Result<ImageMetadata> {
    let img = image::open(path)?;
    let (width, height) = img.dimensions();
    
    let format = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_lowercase();
    
    let has_alpha = Some(img.color().has_alpha());
    
    // TODO: Extract EXIF data using kamadak-exif
    
    Ok(ImageMetadata {
        width,
        height,
        format,
        color_space: None,
        has_alpha,
        date_taken: None,
        camera_make: None,
        camera_model: None,
        focal_length: None,
        aperture: None,
        iso: None,
        shutter_speed: None,
    })
}

/// Generate perceptual hash (dHash)
pub async fn generate_phash(path: &str) -> anyhow::Result<String> {
    let img = image::open(path)?;
    
    // Resize to 9x8 grayscale
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

/// Calculate file hash (SHA256)
fn calculate_file_hash(path: &str) -> anyhow::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    
    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    
    Ok(format!("{:x}", hasher.finalize()))
}

/// Analyze an image file
pub async fn analyze_image(path: &str) -> anyhow::Result<AnalyzedImage> {
    let metadata = get_metadata(path).await?;
    let phash = generate_phash(path).await?;
    let file_hash = calculate_file_hash(path)?;
    
    let file_meta = fs::metadata(path)?;
    let file_name = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    Ok(AnalyzedImage {
        file_path: path.to_string(),
        file_name,
        file_size: file_meta.len() as i64,
        file_hash,
        width: metadata.width as i32,
        height: metadata.height as i32,
        format: metadata.format,
        date_taken: metadata.date_taken,
        camera_make: metadata.camera_make,
        camera_model: metadata.camera_model,
        phash,
    })
}

/// Process image with adjustments
pub async fn process(path: &str, adjustments: &Adjustments) -> anyhow::Result<Vec<u8>> {
    let img = image::open(path)?;
    let rgba = img.to_rgba8();
    let mut buffer: Vec<u8> = rgba.into_raw();
    
    apply_adjustments(&mut buffer, adjustments);
    
    Ok(buffer)
}

/// Get histogram for image
pub async fn get_histogram(path: &str, adjustments: &Adjustments) -> anyhow::Result<Histogram> {
    let buffer = process(path, adjustments).await?;
    Ok(generate_histogram(&buffer))
}

/// Export image with adjustments
pub async fn export(
    source_path: &str,
    output_path: &str,
    adjustments: &Adjustments,
    format: &str,
    quality: u8,
) -> anyhow::Result<()> {
    let img = image::open(source_path)?;
    let (width, height) = img.dimensions();
    let rgba = img.to_rgba8();
    let mut buffer: Vec<u8> = rgba.into_raw();
    
    apply_adjustments(&mut buffer, adjustments);
    
    let img_buffer: ImageBuffer<Rgba<u8>, Vec<u8>> =
        ImageBuffer::from_raw(width, height, buffer)
            .ok_or_else(|| anyhow::anyhow!("Failed to create image buffer"))?;
    
    let output = DynamicImage::ImageRgba8(img_buffer);
    
    match format.to_lowercase().as_str() {
        "jpg" | "jpeg" => {
            let rgb = output.to_rgb8();
            let mut file = fs::File::create(output_path)?;
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut file, quality);
            rgb.write_with_encoder(encoder)?;
        }
        _ => {
            output.save(output_path)?;
        }
    }
    
    Ok(())
}

/// Apply adjustments to RGBA buffer (parallel processing)
fn apply_adjustments(buffer: &mut [u8], adjustments: &Adjustments) {
    let light = &adjustments.light;
    let color = &adjustments.color;
    
    // Check if any adjustments are non-zero
    let has_adjustments = 
        light.exposure != 0.0 || light.contrast != 0.0 ||
        light.highlights != 0.0 || light.shadows != 0.0 ||
        light.whites != 0.0 || light.blacks != 0.0 ||
        color.temperature != 0.0 || color.tint != 0.0 ||
        color.saturation != 0.0 || color.vibrance != 0.0;
    
    if !has_adjustments {
        return;
    }
    
    buffer.par_chunks_mut(4).for_each(|pixel| {
        let mut r = pixel[0] as f64;
        let mut g = pixel[1] as f64;
        let mut b = pixel[2] as f64;
        
        // Exposure
        if light.exposure != 0.0 {
            let ev = light.exposure / 25.0;
            let mult = 2.0_f64.powf(ev);
            r *= mult;
            g *= mult;
            b *= mult;
        }
        
        // Contrast
        if light.contrast != 0.0 {
            let factor = (light.contrast + 100.0) / 100.0;
            let factor = factor.clamp(0.5, 2.0);
            r = (r - 128.0) * factor + 128.0;
            g = (g - 128.0) * factor + 128.0;
            b = (b - 128.0) * factor + 128.0;
        }
        
        // Temperature
        if color.temperature != 0.0 {
            let amt = color.temperature / 100.0 * 30.0;
            r += amt;
            b -= amt;
        }
        
        // Saturation
        if color.saturation != 0.0 {
            let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            let factor = 1.0 + (color.saturation / 100.0);
            r = lum + (r - lum) * factor;
            g = lum + (g - lum) * factor;
            b = lum + (b - lum) * factor;
        }
        
        // Clamp and write back
        pixel[0] = r.clamp(0.0, 255.0) as u8;
        pixel[1] = g.clamp(0.0, 255.0) as u8;
        pixel[2] = b.clamp(0.0, 255.0) as u8;
    });
}

/// Generate histogram from RGBA buffer
fn generate_histogram(buffer: &[u8]) -> Histogram {
    let mut r = vec![0u32; 256];
    let mut g = vec![0u32; 256];
    let mut b = vec![0u32; 256];
    let mut lum = vec![0u32; 256];
    
    for pixel in buffer.chunks(4) {
        if pixel.len() < 3 {
            continue;
        }
        r[pixel[0] as usize] += 1;
        g[pixel[1] as usize] += 1;
        b[pixel[2] as usize] += 1;
        
        let l = (0.2126 * pixel[0] as f64 + 0.7152 * pixel[1] as f64 + 0.0722 * pixel[2] as f64) as usize;
        lum[l.min(255)] += 1;
    }
    
    Histogram { r, g, b, lum }
}
