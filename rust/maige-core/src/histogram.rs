//! Histogram generation for RGBA images

use rayon::prelude::*;
use serde::{Deserialize, Serialize};

/// Histogram data with 256 bins for each channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Histogram {
    pub r: Vec<u32>,
    pub g: Vec<u32>,
    pub b: Vec<u32>,
    pub lum: Vec<u32>,
}

impl Default for Histogram {
    fn default() -> Self {
        Self::new()
    }
}

impl Histogram {
    /// Create a new empty histogram
    pub fn new() -> Self {
        Self {
            r: vec![0; 256],
            g: vec![0; 256],
            b: vec![0; 256],
            lum: vec![0; 256],
        }
    }

    /// Generate histogram from RGBA buffer
    pub fn from_rgba(buffer: &[u8]) -> Self {
        // Process in chunks and merge at the end for thread safety
        let chunk_size = 4096; // Process 1024 pixels at a time
        
        let partial_histograms: Vec<Histogram> = buffer
            .par_chunks(chunk_size)
            .map(|chunk| {
                let mut hist = Histogram::new();
                for pixel in chunk.chunks(4) {
                    if pixel.len() < 3 {
                        continue;
                    }
                    let r = pixel[0] as usize;
                    let g = pixel[1] as usize;
                    let b = pixel[2] as usize;
                    
                    // Calculate luminance using standard coefficients
                    let lum = (0.2126 * pixel[0] as f32 
                             + 0.7152 * pixel[1] as f32 
                             + 0.0722 * pixel[2] as f32) as usize;
                    let lum = lum.min(255);
                    
                    hist.r[r] += 1;
                    hist.g[g] += 1;
                    hist.b[b] += 1;
                    hist.lum[lum] += 1;
                }
                hist
            })
            .collect();
        
        // Merge all partial histograms
        let mut final_hist = Histogram::new();
        for hist in partial_histograms {
            for i in 0..256 {
                final_hist.r[i] += hist.r[i];
                final_hist.g[i] += hist.g[i];
                final_hist.b[i] += hist.b[i];
                final_hist.lum[i] += hist.lum[i];
            }
        }
        
        final_hist
    }

    /// Get the maximum value across all channels (useful for normalization)
    pub fn max_value(&self) -> u32 {
        let max_r = *self.r.iter().max().unwrap_or(&0);
        let max_g = *self.g.iter().max().unwrap_or(&0);
        let max_b = *self.b.iter().max().unwrap_or(&0);
        let max_lum = *self.lum.iter().max().unwrap_or(&0);
        max_r.max(max_g).max(max_b).max(max_lum)
    }

    /// Normalize histogram values to 0.0-1.0 range
    pub fn normalized(&self) -> NormalizedHistogram {
        let max = self.max_value() as f32;
        if max == 0.0 {
            return NormalizedHistogram {
                r: vec![0.0; 256],
                g: vec![0.0; 256],
                b: vec![0.0; 256],
                lum: vec![0.0; 256],
            };
        }

        NormalizedHistogram {
            r: self.r.iter().map(|&v| v as f32 / max).collect(),
            g: self.g.iter().map(|&v| v as f32 / max).collect(),
            b: self.b.iter().map(|&v| v as f32 / max).collect(),
            lum: self.lum.iter().map(|&v| v as f32 / max).collect(),
        }
    }
}

/// Normalized histogram with values in 0.0-1.0 range
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedHistogram {
    pub r: Vec<f32>,
    pub g: Vec<f32>,
    pub b: Vec<f32>,
    pub lum: Vec<f32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_histogram_generation() {
        // Create a simple 2x2 RGBA image
        let buffer = vec![
            255, 0, 0, 255,   // Red
            0, 255, 0, 255,   // Green
            0, 0, 255, 255,   // Blue
            128, 128, 128, 255, // Gray
        ];
        
        let hist = Histogram::from_rgba(&buffer);
        
        // Check red channel
        assert_eq!(hist.r[255], 1); // One pure red
        assert_eq!(hist.r[0], 2);   // Two pixels with R=0
        assert_eq!(hist.r[128], 1); // One gray
        
        // Check green channel
        assert_eq!(hist.g[255], 1); // One pure green
        assert_eq!(hist.g[0], 2);   // Two pixels with G=0
        assert_eq!(hist.g[128], 1); // One gray
    }

    #[test]
    fn test_empty_histogram() {
        let hist = Histogram::new();
        assert_eq!(hist.max_value(), 0);
    }
}
