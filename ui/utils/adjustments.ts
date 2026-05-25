import type { FlatAdjustments, ImageAdjustments } from '../../shared/types';

export function flattenAdjustments(adj: ImageAdjustments): FlatAdjustments {
    return {
        exposure: adj.light.exposure,
        contrast: adj.light.contrast,
        highlights: adj.light.highlights,
        shadows: adj.light.shadows,
        whites: adj.light.whites,
        blacks: adj.light.blacks,
        temperature: adj.color?.temperature ?? 0,
        tint: adj.color?.tint ?? 0,
        saturation: adj.color?.saturation ?? 0,
        vibrance: adj.color?.vibrance ?? 0,
    };
}

export function unflattenAdjustments(flat: FlatAdjustments): ImageAdjustments {
    return {
        light: {
            exposure: flat.exposure,
            contrast: flat.contrast,
            highlights: flat.highlights,
            shadows: flat.shadows,
            whites: flat.whites,
            blacks: flat.blacks,
        },
        color: {
            temperature: flat.temperature,
            tint: flat.tint,
            saturation: flat.saturation,
            vibrance: flat.vibrance,
        },
    };
}
