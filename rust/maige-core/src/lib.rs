//! Maige Core - High-performance image processing library
//!
//! This library provides Rust-native implementations of image processing operations
//! for the Maige image editor, designed to replace the JavaScript/Sharp-based pipeline.

pub mod adjustments;
pub mod error;
pub mod histogram;
pub mod phash;
pub mod processor;

pub use adjustments::{Adjustments, ColorAdjustments, LightAdjustments};
pub use error::{Error, Result};
pub use histogram::Histogram;
pub use phash::PHash;
pub use processor::ImageProcessor;
