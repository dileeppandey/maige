/**
 * CropOverlay — Visual crop region overlay on the image canvas
 * Supports aspect ratio constraints, draggable handles, and rule-of-thirds grid
 */

import { useState, useCallback, useEffect, useRef } from 'react'

interface CropRect {
    x: number
    y: number
    w: number
    h: number
}

interface CropOverlayProps {
    width: number
    height: number
    cropRect: CropRect
    onCropChange: (rect: CropRect) => void
    /** Aspect ratio to enforce (w/h), or null for freeform */
    aspectRatio?: number | null
    showGrid?: boolean
}

type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

interface DragState {
    handle: DragHandle
    startX: number
    startY: number
    startRect: CropRect
}

const CORNER_SIZE = 10
const EDGE_SIZE = 6

function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val))
}

export default function CropOverlay({
    width,
    height,
    cropRect,
    onCropChange,
    aspectRatio = null,
    showGrid = true,
}: CropOverlayProps) {
    const [dragState, setDragState] = useState<DragState | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Convert aspect ratio from image-space to normalized-space
    // In normalized coords, w=1 means full image width, h=1 means full image height
    // So a 1:1 pixel crop on a 440x587 image means normalized w/h ratio = (1/440)/(1/587) = 587/440
    const normAR = aspectRatio != null ? (aspectRatio * height) / width : null

    // Pixel values from normalized crop rect
    const px = cropRect.x * width
    const py = cropRect.y * height
    const pw = cropRect.w * width
    const ph = cropRect.h * height

    const handleMouseDown = useCallback(
        (handle: DragHandle, e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            setDragState({
                handle,
                startX: e.clientX,
                startY: e.clientY,
                startRect: { ...cropRect },
            })
        },
        [cropRect],
    )

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!dragState) return

            const dx = (e.clientX - dragState.startX) / width
            const dy = (e.clientY - dragState.startY) / height
            const { startRect, handle } = dragState
            const minSize = 0.05

            let newRect = { ...startRect }

            if (handle === 'move') {
                newRect.x = clamp(startRect.x + dx, 0, 1 - startRect.w)
                newRect.y = clamp(startRect.y + dy, 0, 1 - startRect.h)
            } else if (normAR != null) {
                // Aspect-ratio-constrained resize
                // Use the dominant axis based on handle direction
                const isHorizontal = handle === 'e' || handle === 'w'
                const isVertical = handle === 'n' || handle === 's'

                if (isHorizontal) {
                    // Width drives, height follows
                    if (handle === 'e') {
                        newRect.w = clamp(startRect.w + dx, minSize, 1 - startRect.x)
                    } else {
                        const newX = clamp(startRect.x + dx, 0, startRect.x + startRect.w - minSize)
                        newRect.w = startRect.w - (newX - startRect.x)
                        newRect.x = newX
                    }
                    newRect.h = newRect.w / normAR
                    // Clamp height and adjust width to maintain ratio
                    if (newRect.h > 1 - newRect.y) {
                        newRect.h = 1 - newRect.y
                        newRect.w = newRect.h * normAR
                    }
                } else if (isVertical) {
                    // Height drives, width follows
                    if (handle === 's') {
                        newRect.h = clamp(startRect.h + dy, minSize, 1 - startRect.y)
                    } else {
                        const newY = clamp(startRect.y + dy, 0, startRect.y + startRect.h - minSize)
                        newRect.h = startRect.h - (newY - startRect.y)
                        newRect.y = newY
                    }
                    newRect.w = newRect.h * normAR
                    if (newRect.w > 1 - newRect.x) {
                        newRect.w = 1 - newRect.x
                        newRect.h = newRect.w / normAR
                    }
                } else {
                    // Corner handle — use the larger delta to drive
                    const absDx = Math.abs(dx)
                    const absDy = Math.abs(dy)

                    if (absDx >= absDy) {
                        // Width drives
                        if (handle.includes('e')) {
                            newRect.w = clamp(startRect.w + dx, minSize, 1 - startRect.x)
                        } else {
                            const newX = clamp(startRect.x + dx, 0, startRect.x + startRect.w - minSize)
                            newRect.w = startRect.w - (newX - startRect.x)
                            newRect.x = newX
                        }
                        newRect.h = newRect.w / normAR
                    } else {
                        // Height drives
                        if (handle.includes('s')) {
                            newRect.h = clamp(startRect.h + dy, minSize, 1 - startRect.y)
                        } else {
                            const newY = clamp(startRect.y + dy, 0, startRect.y + startRect.h - minSize)
                            newRect.h = startRect.h - (newY - startRect.y)
                            newRect.y = newY
                        }
                        newRect.w = newRect.h * normAR
                    }

                    // Clamp to bounds
                    if (newRect.w > 1 - newRect.x) {
                        newRect.w = 1 - newRect.x
                        newRect.h = newRect.w / normAR
                    }
                    if (newRect.h > 1 - newRect.y) {
                        newRect.h = 1 - newRect.y
                        newRect.w = newRect.h * normAR
                    }

                    // Adjust anchor for top/left handles
                    if (handle.includes('n')) {
                        newRect.y = startRect.y + startRect.h - newRect.h
                    }
                    if (handle.includes('w')) {
                        newRect.x = startRect.x + startRect.w - newRect.w
                    }
                }
            } else {
                // Freeform resize
                if (handle.includes('w')) {
                    const newX = clamp(startRect.x + dx, 0, startRect.x + startRect.w - minSize)
                    newRect.w = startRect.w - (newX - startRect.x)
                    newRect.x = newX
                }
                if (handle.includes('e')) {
                    newRect.w = clamp(startRect.w + dx, minSize, 1 - startRect.x)
                }
                if (handle.includes('n')) {
                    const newY = clamp(startRect.y + dy, 0, startRect.y + startRect.h - minSize)
                    newRect.h = startRect.h - (newY - startRect.y)
                    newRect.y = newY
                }
                if (handle.includes('s')) {
                    newRect.h = clamp(startRect.h + dy, minSize, 1 - startRect.y)
                }
            }

            onCropChange(newRect)
        },
        [dragState, width, height, onCropChange, normAR],
    )

    const handleMouseUp = useCallback(() => {
        setDragState(null)
    }, [])

    useEffect(() => {
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            return () => {
                window.removeEventListener('mousemove', handleMouseMove)
                window.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [dragState, handleMouseMove, handleMouseUp])

    const cursorForHandle = (handle: DragHandle): string => {
        const cursors: Record<DragHandle, string> = {
            move: 'move',
            nw: 'nw-resize',
            ne: 'ne-resize',
            sw: 'sw-resize',
            se: 'se-resize',
            n: 'ns-resize',
            s: 'ns-resize',
            e: 'ew-resize',
            w: 'ew-resize',
        }
        return cursors[handle]
    }

    const renderHandle = (handle: DragHandle, left: number, top: number, isCorner: boolean) => {
        const size = isCorner ? CORNER_SIZE : EDGE_SIZE
        return (
            <div
                key={handle}
                onMouseDown={(e) => handleMouseDown(handle, e)}
                className="absolute bg-white border border-gray-300"
                style={{
                    width: size,
                    height: size,
                    left: left - size / 2,
                    top: top - size / 2,
                    cursor: cursorForHandle(handle),
                    zIndex: 4,
                }}
            />
        )
    }

    return (
        <div
            ref={containerRef}
            className="absolute inset-0"
            style={{ width, height, cursor: 'crosshair' }}
        >
            {/* Dark overlay — 4 rectangles around the crop area */}
            <div className="absolute bg-black/50" style={{ left: 0, top: 0, width, height: py }} />
            <div className="absolute bg-black/50" style={{ left: 0, top: py + ph, width, height: height - py - ph }} />
            <div className="absolute bg-black/50" style={{ left: 0, top: py, width: px, height: ph }} />
            <div className="absolute bg-black/50" style={{ left: px + pw, top: py, width: width - px - pw, height: ph }} />

            {/* Crop region border */}
            <div
                className="absolute border border-white/70"
                style={{ left: px, top: py, width: pw, height: ph, cursor: 'move' }}
                onMouseDown={(e) => handleMouseDown('move', e)}
            >
                {showGrid && (
                    <>
                        <div className="absolute top-0 bottom-0 border-l border-white/30" style={{ left: '33.333%' }} />
                        <div className="absolute top-0 bottom-0 border-l border-white/30" style={{ left: '66.666%' }} />
                        <div className="absolute left-0 right-0 border-t border-white/30" style={{ top: '33.333%' }} />
                        <div className="absolute left-0 right-0 border-t border-white/30" style={{ top: '66.666%' }} />
                    </>
                )}
            </div>

            {/* Corner handles */}
            {renderHandle('nw', px, py, true)}
            {renderHandle('ne', px + pw, py, true)}
            {renderHandle('sw', px, py + ph, true)}
            {renderHandle('se', px + pw, py + ph, true)}

            {/* Edge handles */}
            {renderHandle('n', px + pw / 2, py, false)}
            {renderHandle('s', px + pw / 2, py + ph, false)}
            {renderHandle('w', px, py + ph / 2, false)}
            {renderHandle('e', px + pw, py + ph / 2, false)}
        </div>
    )
}
