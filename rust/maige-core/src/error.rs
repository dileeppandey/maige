//! Error types for maige-core

use thiserror::Error;

/// Result type alias using our Error type
pub type Result<T> = std::result::Result<T, Error>;

/// Errors that can occur in maige-core
#[derive(Error, Debug)]
pub enum Error {
    #[error("Image loading failed: {0}")]
    ImageLoad(String),

    #[error("Unsupported image format: {0}")]
    UnsupportedFormat(String),

    #[error("RAW decoding failed: {0}")]
    RawDecode(String),

    #[error("EXIF extraction failed: {0}")]
    ExifError(String),

    #[error("Hash generation failed: {0}")]
    HashError(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Image processing error: {0}")]
    Processing(String),
}

impl From<image::ImageError> for Error {
    fn from(err: image::ImageError) -> Self {
        Error::ImageLoad(err.to_string())
    }
}
