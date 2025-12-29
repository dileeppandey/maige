# Develop Module Expansion Proposal

## Executive Summary
The current "Develop" module provides basic image adjustments (Exposure, Contrast, Highlights, Shadows). To compete with industry-leading software like Adobe Lightroom and Capture One, we need to significantly expand our toolset. This proposal outlines the missing features and suggests a phased roadmap for implementation.

## Competitive Analysis / Feature Gap

| Feature Category | Feature | Current State | Adobe Lightroom | Capture One | Priority |
|------------------|---------|---------------|-----------------|-------------|----------|
| **Light** | Exposure | ✅ Implemented | ✅ | ✅ | - |
| | Contrast | ✅ Implemented | ✅ | ✅ | - |
| | Highlights | ✅ Implemented | ✅ | ✅ | - |
| | Shadows | ✅ Implemented | ✅ | ✅ | - |
| | **Whites** | ❌ Missing | ✅ | ✅ | **High** |
| | **Blacks** | ❌ Missing | ✅ | ✅ | **High** |
| | **Tone Curve** | ❌ Missing | ✅ (Parametric & Point) | ✅ (Luma & RGB) | **High** |
| **Color** | **Temperature** | ⚠️ Types Only | ✅ | ✅ (Kelvin) | **High** |
| | **Tint** | ⚠️ Types Only | ✅ | ✅ | **High** |
| | **Vibrance** | ⚠️ Types Only | ✅ | ✅ (Saturation) | **Medium** |
| | **Saturation** | ⚠️ Types Only | ✅ | ✅ | **Medium** |
| | **Color Mixer/HSL** | ❌ Missing | ✅ (HSL) | ✅ (Color Editor) | **High** |
| | **Color Grading** | ❌ Missing | ✅ (Wheels) | ✅ (Balance) | **Medium** |
| **Detail** | **Sharpening** | ❌ Missing | ✅ (Amount, Radius, etc) | ✅ | **Medium** |
| | **Noise Reduction** | ❌ Missing | ✅ (Lumi, Color) | ✅ | **Medium** |
| **Effects** | **Vignette** | ❌ Missing | ✅ | ✅ | **Low** |
| | **Dehaze** | ❌ Missing | ✅ | ✅ | **Low** |
| | **Grain** | ❌ Missing | ✅ | ✅ | **Low** |
| **Optics** | **Lens Correction**| ❌ Missing | ✅ | ✅ | **Low** |
| **Geometry** | **Transform** | ❌ Missing | ✅ | ✅ (Keystone) | **Low** |
| | **Crop & Rotate** | ❌ Missing | ✅ | ✅ | **High** |

## Implementation Roadmap

### Phase 1: Core Light & Color Completeness (MVP)
**Goal**: Finish the basic "Global" adjustments panel.
1.  **Logic**: Implement `Whites` and `Blacks` algorithms in `ImageProcessor.ts`.
2.  **Logic**: Implement `Temperature` and `Tint` (White Balance) in `ImageProcessor.ts`.
3.  **Logic**: Implement `Saturation` and `Vibrance` algorithms.
4.  **UI**: Update `LightPanel` to include Whites/Blacks.
5.  **UI**: Create `ColorPanel` for Temp, Tint, Vibrance, Saturation.
6.  **Store**: Ensure `useImageAdjustments` accurately tracks these new states.

### Phase 2: Histogram & Curve
**Goal**: Visual feedback and precision control.
1.  **UI**: detailed RGB Histogram.
2.  **Tool**: Tone Curve UI (interactive graph).
3.  **Logic**: Apply curve look-up table (LUT) in `ImageProcessor.ts`.

### Phase 3: Advanced Color (HSL)
**Goal**: Professional color manipulation.
1.  **Tool**: HSL sliders for 8 color channels (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta).
2.  **Logic**: HSL colorspace conversion in `ImageProcessor.ts` to isolate and shift hues.

### Phase 4: Detail & Crop
**Goal**: Final image polish.
1.  **Tool**: Crop tool with aspect ratio overlay.
2.  **Filter**: Convolution kernels for Sharpening.
3.  **Filter**: Basic noise reduction (median/gaussian blur on chrominance).

## Technical Considerations
-   **Performance**: As the filter chain grows, we must ensure `OffscreenCanvas` processing remains performant. We might need to switch to WebGL (via `pixi.js` or raw WebGL) if canvas 2D CPU processing becomes too slow for real-time slider manipulation.
-   **Non-Destructive**: All edits must remain non-destructive (json metadata only).
-   **History**: We will need an undo/redo stack for these complex states.

## Recommendation
Start immediately with **Phase 1**. The lack of White Balance and Whites/Blacks controls makes the current editor insufficient for even basic photo editing tasks.
