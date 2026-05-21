import { useState, useCallback, useEffect, useRef, type ReactNode, type MouseEvent } from 'react'

interface ResizableLayoutProps {
    leftPanel: ReactNode
    centerPanel: ReactNode
    rightPanel: ReactNode
    defaultLeftWidth?: number
    defaultRightWidth?: number
    minWidth?: number
    maxWidth?: number
}

const STORAGE_KEY = 'panel-widths'
const MIN_CENTER_WIDTH = 200 // Minimum width for center panel

export function ResizableLayout({
    leftPanel,
    centerPanel,
    rightPanel,
    defaultLeftWidth = 280,
    defaultRightWidth = 300,
    minWidth = 150,
    maxWidth = 400,
}: ResizableLayoutProps) {
    const [leftWidth, setLeftWidth] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const { left } = JSON.parse(saved)
                return left ?? defaultLeftWidth
            } catch {
                return defaultLeftWidth
            }
        }
        return defaultLeftWidth
    })

    const [rightWidth, setRightWidth] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const { right } = JSON.parse(saved)
                return right ?? defaultRightWidth
            } catch {
                return defaultRightWidth
            }
        }
        return defaultRightWidth
    })

    const [isResizingLeft, setIsResizingLeft] = useState(false)
    const [isResizingRight, setIsResizingRight] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Persist widths to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: leftWidth, right: rightWidth }))
    }, [leftWidth, rightWidth])

    // Handle window/container resize - clamp panel widths if container shrinks
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const containerWidth = entry.contentRect.width
                const handleWidth = 8 // 2 handles * 4px each
                const availableForPanels = containerWidth - handleWidth - MIN_CENTER_WIDTH

                // Clamp panel widths if they exceed available space
                const maxPossibleLeft = Math.min(maxWidth, availableForPanels - minWidth)
                const maxPossibleRight = Math.min(maxWidth, availableForPanels - minWidth)

                if (leftWidth > maxPossibleLeft && maxPossibleLeft >= minWidth) {
                    setLeftWidth(Math.max(minWidth, maxPossibleLeft))
                }
                if (rightWidth > maxPossibleRight && maxPossibleRight >= minWidth) {
                    setRightWidth(Math.max(minWidth, maxPossibleRight))
                }
            }
        })

        resizeObserver.observe(container)
        return () => resizeObserver.disconnect()
    }, [leftWidth, rightWidth, minWidth, maxWidth])

    const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
        if (!containerRef.current) return

        const containerRect = containerRef.current.getBoundingClientRect()
        const containerWidth = containerRect.width
        const handleWidth = 8

        if (isResizingLeft) {
            const newWidth = e.clientX - containerRect.left
            // Ensure minimum center panel width
            const maxAllowed = Math.min(maxWidth, containerWidth - handleWidth - MIN_CENTER_WIDTH - rightWidth)
            setLeftWidth(Math.max(minWidth, Math.min(maxAllowed, newWidth)))
        }

        if (isResizingRight) {
            const newWidth = containerRect.right - e.clientX
            // Ensure minimum center panel width
            const maxAllowed = Math.min(maxWidth, containerWidth - handleWidth - MIN_CENTER_WIDTH - leftWidth)
            setRightWidth(Math.max(minWidth, Math.min(maxAllowed, newWidth)))
        }
    }, [isResizingLeft, isResizingRight, minWidth, maxWidth, leftWidth, rightWidth])

    const handleMouseUp = useCallback(() => {
        setIsResizingLeft(false)
        setIsResizingRight(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }, [])

    useEffect(() => {
        if (isResizingLeft || isResizingRight) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizingLeft, isResizingRight, handleMouseMove, handleMouseUp])

    const startResizeLeft = (e: MouseEvent) => {
        e.preventDefault()
        setIsResizingLeft(true)
    }

    const startResizeRight = (e: MouseEvent) => {
        e.preventDefault()
        setIsResizingRight(true)
    }

    return (
        <div ref={containerRef} className="flex-1 flex min-h-0 w-full h-full">
            {/* Left Panel */}
            {leftPanel && (
                <>
                    <div className="h-full" style={{ width: leftWidth, flexShrink: 0 }}>
                        {leftPanel}
                    </div>
                    {/* Left Resize Handle */}
                    <div
                        className="resize-handle h-full"
                        onMouseDown={startResizeLeft}
                    />
                </>
            )}

            {/* Center Panel */}
            <div className="flex-1 min-w-0 h-full">
                {centerPanel}
            </div>

            {/* Right Panel */}
            {rightPanel && (
                <>
                    {/* Right Resize Handle */}
                    <div
                        className="resize-handle h-full"
                        onMouseDown={startResizeRight}
                    />
                    <div className="h-full" style={{ width: rightWidth, flexShrink: 0 }}>
                        {rightPanel}
                    </div>
                </>
            )}
        </div>
    )
}

