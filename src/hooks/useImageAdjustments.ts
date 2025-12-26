import { useState, useCallback, useMemo } from 'react'
import type { ImageAdjustments, LightAdjustments } from '../../shared/types'
import { DEFAULT_IMAGE_ADJUSTMENTS, DEFAULT_LIGHT_ADJUSTMENTS } from '../../shared/types'

interface ImageEditRecord {
    adjustments: ImageAdjustments
    isDirty: boolean
}

/**
 * Hook to manage image adjustments state per file.
 * Tracks adjustments for multiple images and whether each has been edited.
 */
export function useImageAdjustments() {
    // Map of file path -> edit state
    const [editStates, setEditStates] = useState<Map<string, ImageEditRecord>>(new Map())

    // Get adjustments for a specific file (returns defaults if not edited)
    const getAdjustments = useCallback((filePath: string | null): ImageAdjustments => {
        if (!filePath) return DEFAULT_IMAGE_ADJUSTMENTS
        return editStates.get(filePath)?.adjustments ?? DEFAULT_IMAGE_ADJUSTMENTS
    }, [editStates])

    // Check if a specific file has unsaved edits
    const isDirty = useCallback((filePath: string | null): boolean => {
        if (!filePath) return false
        return editStates.get(filePath)?.isDirty ?? false
    }, [editStates])

    // Check if adjustments differ from defaults
    const checkIsDirty = useCallback((adjustments: ImageAdjustments): boolean => {
        const light = adjustments.light
        const defaultLight = DEFAULT_LIGHT_ADJUSTMENTS
        return (
            light.exposure !== defaultLight.exposure ||
            light.contrast !== defaultLight.contrast ||
            light.highlights !== defaultLight.highlights ||
            light.shadows !== defaultLight.shadows
        )
    }, [])

    // Update a light adjustment for a specific file
    const updateLightAdjustment = useCallback((
        filePath: string,
        key: keyof LightAdjustments,
        value: number
    ) => {
        setEditStates(prev => {
            const current = prev.get(filePath)?.adjustments ?? DEFAULT_IMAGE_ADJUSTMENTS
            const newAdjustments: ImageAdjustments = {
                ...current,
                light: {
                    ...current.light,
                    [key]: value
                }
            }
            const newMap = new Map(prev)
            newMap.set(filePath, {
                adjustments: newAdjustments,
                isDirty: checkIsDirty(newAdjustments)
            })
            return newMap
        })
    }, [checkIsDirty])

    // Reset adjustments for a specific file
    const resetAdjustments = useCallback((filePath: string) => {
        setEditStates(prev => {
            const newMap = new Map(prev)
            newMap.delete(filePath)
            return newMap
        })
    }, [])

    // Reset all adjustments
    const resetAllAdjustments = useCallback(() => {
        setEditStates(new Map())
    }, [])

    return {
        getAdjustments,
        isDirty,
        updateLightAdjustment,
        resetAdjustments,
        resetAllAdjustments,
        editStates  // Expose for debugging/save functionality
    }
}
