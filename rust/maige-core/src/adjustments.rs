//! Image adjustments - exposure, contrast, highlights, shadows, etc.
//!
//! All adjustment values are in the range -100 to 100, with 0 being no change.
//! This matches the frontend TypeScript implementation for compatibility.

use rayon::prelude::*;
use serde::{Deserialize, Serialize};

/// Light adjustments (exposure, contrast, highlights, shadows, whites, blacks)
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct LightAdjustments {
    pub exposure: f32,    // -100 to 100
    pub contrast: f32,    // -100 to 100
    pub highlights: f32,  // -100 to 100
    pub shadows: f32,     // -100 to 100
    pub whites: f32,      // -100 to 100
    pub blacks: f32,      // -100 to 100
}

/// Color adjustments (temperature, tint, saturation, vibrance)
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct ColorAdjustments {
    pub temperature: f32, // -100 (blue) to 100 (yellow)
    pub tint: f32,        // -100 (green) to 100 (magenta)
    pub saturation: f32,  // -100 to 100
    pub vibrance: f32,    // -100 to 100
}

/// Combined adjustments
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct Adjustments {
    pub light: LightAdjustments,
    pub color: ColorAdjustments,
}

impl Adjustments {
    /// Check if any adjustments are non-zero
    pub fn is_identity(&self) -> bool {
        self.light.exposure == 0.0
            && self.light.contrast == 0.0
            && self.light.highlights == 0.0
            && self.light.shadows == 0.0
            && self.light.whites == 0.0
            && self.light.blacks == 0.0
            && self.color.temperature == 0.0
            && self.color.tint == 0.0
            && self.color.saturation == 0.0
            && self.color.vibrance == 0.0
    }
}

/// Clamp a value to 0-255 range
#[inline(always)]
fn clamp_u8(value: f32) -> u8 {
    value.clamp(0.0, 255.0) as u8
}

/// Calculate luminance of an RGB pixel (0-1 range)
#[inline(always)]
fn get_luminance(r: f32, g: f32, b: f32) -> f32 {
    0.2126 * r + 0.7152 * g + 0.0722 * b
}

/// Apply exposure adjustment using EV-style scaling
/// Value: -100 to 100 (0 = no change)
#[inline(always)]
fn apply_exposure_pixel(r: &mut f32, g: &mut f32, b: &mut f32, value: f32) {
    if value == 0.0 {
        return;
    }
    // Convert -100..100 to EV stops (-4 to +4)
    let ev = value / 25.0;
    let multiplier = 2.0_f32.powf(ev);
    *r *= multiplier;
    *g *= multiplier;
    *b *= multiplier;
}

/// Apply contrast adjustment using S-curve
/// Value: -100 to 100 (0 = no change)
#[inline(always)]
fn apply_contrast_pixel(r: &mut f32, g: &mut f32, b: &mut f32, value: f32) {
    if value == 0.0 {
        return;
    }
    // Factor ranges from 0.5 (value=-100) to 2.0 (value=100)
    let factor = (value + 100.0) / 100.0;
    let factor = factor.max(0.5).min(2.0);
    
    *r = (*r - 128.0) * factor + 128.0;
    *g = (*g - 128.0) * factor + 128.0;
    *b = (*b - 128.0) * factor + 128.0;
}

/// Apply highlights adjustment (affects bright pixels)
/// Value: -100 to 100 (0 = no change)
#[inline(always)]
fn apply_highlights_pixel(r: &mut f32, g: &mut f32, b: &mut f32, value: f32) {
    if value == 0.0 {
        return;
    }
    let lum = get_luminance(*r, *g, *b) / 255.0;
    // Only affect pixels with luminance > 0.5
    if lum > 0.5 {
        // Weight increases as luminance approaches 1
        let weight = (lum - 0.5) * 2.0;
        let adjustment = value / 100.0 * weight * 50.0;
        *r += adjustment;
        *g += adjustment;
        *b += adjustment;
    }
}

/// Apply shadows adjustment (affects dark pixels)
/// Value: -100 to 100 (0 = no change)
#[inline(always)]
fn apply_shadows_pixel(r: &mut f32, g: &mut f32, b: &mut f32, value: f32) {
    if value == 0.0 {
        return;
    }
    let lum = get_luminance(*r, *g, *b) / 255.0;
    // Only affect pixels with luminance < 0.5
    if lum < 0.5 {
        let weight = (0.5 - lum) * 2.0;
        let adjustment = value / 100.0 * weight * 50.0;
        *r += adjustment;
        *g += adjustment;
        *b += adjustment;
    }
}

/// Apply whites adjustment (affects very bright pixels)
#[inline(always)]
fn apply_whites_pixel(r: &mut f32, g: &mut f32, b: &mut f32, value: f32) {
    if value == 0.0 {
        return;
    }
    let lum = get_luminance(*r, *g, *b) / 255.0;
    if lum > 0.75 {
        let weight = (lum - 0.75) * 4.0;
        let adjustment = value / 100.0 * weight * 30.0;
        *r += adjustment;
        *g += adjustment;
        *b += adjustment;
    }
}

/// Apply blacks adjustment (affects very dark pixels)
#[inline(always)]
fn apply_blacks_pixel(r: &mut f32, g: &mut f32, b: &mut f32, value: f32) {
    if value == 0.0 {
        return;
    }
    let lum = get_luminance(*r, *g, *b) / 255.0;
    if lum < 0.25 {
        let weight = (0.25 - lum) * 4.0;
        let adjustment = value / 100.0 * weight * 30.0;
        *r += adjustment;
        *g += adjustment;
        *b += adjustment;
    }
}

/// Apply temperature and tint
/// Temp: -100 (Blue) to 100 (Yellow)
/// Tint: -100 (Green) to 100 (Magenta)
#[inline(always)]
fn apply_temperature_tint_pixel(r: &mut f32, g: &mut f32, b: &mut f32, temp: f32, tint: f32) {
    if temp == 0.0 && tint == 0.0 {
        return;
    }
    // Temperature: adjust R and B channels
    let temp_amount = temp / 100.0 * 30.0;
    *r += temp_amount;
    *b -= temp_amount;
    
    // Tint: adjust G channel
    let tint_amount = tint / 100.0 * 20.0;
    *g -= tint_amount;
}

/// Apply saturation and vibrance
/// Saturation: Linear multiplier on chroma
/// Vibrance: Smart saturation (boosts muted colors more)
#[inline(always)]
fn apply_saturation_vibrance_pixel(r: &mut f32, g: &mut f32, b: &mut f32, sat: f32, vib: f32) {
    if sat == 0.0 && vib == 0.0 {
        return;
    }
    
    let lum = get_luminance(*r, *g, *b);
    
    // Calculate current saturation
    let max_c = r.max(*g).max(*b);
    let min_c = r.min(*g).min(*b);
    let current_sat = if max_c > 0.0 {
        (max_c - min_c) / max_c
    } else {
        0.0
    };
    
    // Vibrance: Apply more to less saturated pixels
    let vibrance_boost = if vib != 0.0 {
        let vibrance_factor = 1.0 - current_sat;
        vib / 100.0 * vibrance_factor
    } else {
        0.0
    };
    
    // Combined saturation factor
    let sat_factor = 1.0 + (sat / 100.0) + vibrance_boost;
    let sat_factor = sat_factor.max(0.0);
    
    *r = lum + (*r - lum) * sat_factor;
    *g = lum + (*g - lum) * sat_factor;
    *b = lum + (*b - lum) * sat_factor;
}

/// Apply all adjustments to a pixel buffer (RGBA format)
/// Buffer is modified in-place for performance
pub fn apply_adjustments(buffer: &mut [u8], adjustments: &Adjustments) {
    if adjustments.is_identity() {
        return;
    }
    
    let light = &adjustments.light;
    let color = &adjustments.color;
    
    // Process pixels in parallel using rayon
    buffer
        .par_chunks_mut(4)
        .for_each(|pixel| {
            let mut r = pixel[0] as f32;
            let mut g = pixel[1] as f32;
            let mut b = pixel[2] as f32;
            // Alpha (pixel[3]) is preserved
            
            // Apply light adjustments in order
            apply_exposure_pixel(&mut r, &mut g, &mut b, light.exposure);
            apply_contrast_pixel(&mut r, &mut g, &mut b, light.contrast);
            apply_highlights_pixel(&mut r, &mut g, &mut b, light.highlights);
            apply_shadows_pixel(&mut r, &mut g, &mut b, light.shadows);
            apply_whites_pixel(&mut r, &mut g, &mut b, light.whites);
            apply_blacks_pixel(&mut r, &mut g, &mut b, light.blacks);
            
            // Apply color adjustments
            apply_temperature_tint_pixel(&mut r, &mut g, &mut b, color.temperature, color.tint);
            apply_saturation_vibrance_pixel(&mut r, &mut g, &mut b, color.saturation, color.vibrance);
            
            // Clamp and write back
            pixel[0] = clamp_u8(r);
            pixel[1] = clamp_u8(g);
            pixel[2] = clamp_u8(b);
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_adjustments() {
        let adj = Adjustments::default();
        assert!(adj.is_identity());
    }

    #[test]
    fn test_exposure_adjustment() {
        let mut buffer = vec![128u8, 128, 128, 255]; // Gray pixel
        let mut adj = Adjustments::default();
        adj.light.exposure = 25.0; // +1 EV
        
        apply_adjustments(&mut buffer, &adj);
        
        // Should be brighter (doubled)
        assert!(buffer[0] > 200);
        assert!(buffer[1] > 200);
        assert!(buffer[2] > 200);
        assert_eq!(buffer[3], 255); // Alpha unchanged
    }

    #[test]
    fn test_no_change_on_identity() {
        let mut buffer = vec![100u8, 150, 200, 255];
        let original = buffer.clone();
        let adj = Adjustments::default();
        
        apply_adjustments(&mut buffer, &adj);
        
        assert_eq!(buffer, original);
    }
}
