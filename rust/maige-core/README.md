# maige-core

High-performance image processing library for the Maige image editor.

## Features

- **Image Adjustments**: Exposure, contrast, highlights, shadows, whites, blacks, temperature, tint, saturation, vibrance
- **Histogram Generation**: RGB and luminance histograms
- **Perceptual Hashing**: dHash for duplicate detection
- **Parallel Processing**: Uses rayon for SIMD-optimized operations

## Usage

```rust
use maige_core::{ImageProcessor, Adjustments};

let mut processor = ImageProcessor::new();
processor.load("photo.jpg")?;

let mut adj = Adjustments::default();
adj.light.exposure = 25.0;  // +1 EV
adj.color.saturation = 15.0;

let buffer = processor.process(&adj)?;
let histogram = processor.histogram(&adj)?;
```

## Building

```bash
cargo build --release
cargo test
```

## Adjustments

### Light

| Property | Range | Description |
|----------|-------|-------------|
| exposure | -100 to 100 | EV-style exposure |
| contrast | -100 to 100 | S-curve contrast |
| highlights | -100 to 100 | Bright area adjustment |
| shadows | -100 to 100 | Dark area adjustment |
| whites | -100 to 100 | White point |
| blacks | -100 to 100 | Black point |

### Color

| Property | Range | Description |
|----------|-------|-------------|
| temperature | -100 to 100 | Blue ↔ Yellow |
| tint | -100 to 100 | Green ↔ Magenta |
| saturation | -100 to 100 | Global saturation |
| vibrance | -100 to 100 | Smart saturation |

## License

MIT
