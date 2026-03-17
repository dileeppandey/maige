# maige-core

High-performance image processing library for the Maige image editor.

## Features

- **Image Adjustments**: Exposure, contrast, highlights, shadows, whites, blacks, temperature, tint, saturation, vibrance
- **Histogram Generation**: RGB and luminance histograms
- **Perceptual Hashing**: dHash for duplicate detection
- **Parallel Processing**: Uses rayon for SIMD-optimized operations

## Usage

### As a Rust Library

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

### As a Node.js Native Module (NAPI-RS)

```typescript
import { NativeImageProcessor } from '@maige/core';

const processor = new NativeImageProcessor();
processor.load('/path/to/image.jpg');

const adjustments = {
  light: { exposure: 25, contrast: 10, highlights: 0, shadows: 0, whites: 0, blacks: 0 },
  color: { temperature: 0, tint: 0, saturation: 15, vibrance: 10 }
};

const rgbaBuffer = processor.process(adjustments);
const histogram = processor.histogram(adjustments);
```

## Building

### Rust Library

```bash
cargo build --release
cargo test
```

### Node.js Native Module

```bash
npm install
PATH="$HOME/.cargo/bin:$PATH" npm run build
```

## API

### `NativeImageProcessor`

| Method | Returns | Description |
|--------|---------|-------------|
| `load(path)` | void | Load an image file |
| `isLoaded()` | boolean | Check if image is loaded |
| `dimensions()` | [width, height] | Get image dimensions |
| `process(adj)` | Buffer | Process with adjustments |
| `histogram(adj)` | Histogram | Generate histogram |
| `phash()` | { hash, bits } | Perceptual hash |
| `dhash()` | string | 64-bit hex hash |
| `originalRgba()` | Buffer | Original RGBA data |

### Standalone Functions

| Function | Description |
|----------|-------------|
| `generateDhashFromFile(path)` | Generate dHash from file |
| `calculateHammingDistance(h1, h2)` | Difference between hashes |
| `areDuplicates(h1, h2, threshold)` | Check if images are similar |
| `applyAdjustmentsToBuffer(buf, w, h, adj)` | Process RGBA buffer |
| `generateHistogramFromBuffer(buf)` | Generate histogram |

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
