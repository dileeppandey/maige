import { useCallback, useRef } from 'react'

interface AdjustmentSliderProps {
    label: string
    value: number
    min?: number
    max?: number
    onChange: (value: number) => void
    icon?: React.ReactNode
    trackColor?: string
    valueColor?: string
    /** Full-width gradient for the entire track (e.g. temperature red-to-blue) */
    trackGradient?: string
}

export function AdjustmentSlider({
    label,
    value,
    min = -100,
    max = 100,
    onChange,
    icon,
    trackColor,
    valueColor,
    trackGradient
}: AdjustmentSliderProps) {
    const trackRef = useRef<HTMLDivElement>(null)

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(Number(e.target.value))
    }, [onChange])

    const handleDoubleClick = useCallback(() => {
        onChange(0)
    }, [onChange])

    // Calculate fill position and width
    const range = max - min
    const centerPercent = ((0 - min) / range) * 100 // Where 0 sits on the track
    const valuePercent = ((value - min) / range) * 100

    // Fill bar positioning: from center to current value
    const fillLeft = value >= 0 ? centerPercent : valuePercent
    const fillWidth = Math.abs(valuePercent - centerPercent)

    const fillColor = trackColor || '#3b82f6'

    return (
        <div className="space-y-1.5">
            {/* Label and value */}
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                    {icon && <span className="opacity-70">{icon}</span>}
                    <span>{label}</span>
                </div>
                <span
                    className={`tabular-nums w-10 text-right ${value !== 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}
                    style={value !== 0 && valueColor ? { color: valueColor } : undefined}
                >
                    {value > 0 ? `+${value}` : value}
                </span>
            </div>

            {/* Slider track container */}
            <div
                ref={trackRef}
                className="relative h-5 flex items-center cursor-pointer"
                onDoubleClick={handleDoubleClick}
                title="Double-click to reset"
            >
                {/* Track background */}
                <div
                    className={`absolute inset-x-0 h-[3px] rounded-full ${!trackGradient ? 'bg-gray-300 dark:bg-[#3a3a3a]' : ''}`}
                    style={trackGradient
                        ? { background: trackGradient }
                        : {}
                    }
                >
                    {/* Fill bar - only shown for non-gradient tracks */}
                    {!trackGradient && (
                        <div
                            className="absolute h-full rounded-full transition-all duration-75 ease-out"
                            style={{
                                left: `${fillLeft}%`,
                                width: `${fillWidth}%`,
                                backgroundColor: fillColor,
                            }}
                        />
                    )}
                </div>

                {/* Thumb indicator - visible current position */}
                <div
                    className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-md pointer-events-none transition-all duration-75"
                    style={{
                        left: `${valuePercent}%`,
                        transform: 'translateX(-50%)',
                    }}
                />

                {/* Invisible range input - full height for easy interaction */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={handleChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                    style={{ margin: 0 }}
                />
            </div>
        </div>
    )
}
