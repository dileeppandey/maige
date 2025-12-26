import { useCallback, useRef } from 'react'

interface AdjustmentSliderProps {
    label: string
    value: number
    min?: number
    max?: number
    onChange: (value: number) => void
}

export function AdjustmentSlider({
    label,
    value,
    min = -100,
    max = 100,
    onChange
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

    return (
        <div className="space-y-1.5">
            {/* Label and value */}
            <div className="flex justify-between text-xs text-gray-400">
                <span>{label}</span>
                <span className={`tabular-nums w-10 text-right ${value !== 0 ? 'text-gray-300' : 'text-gray-500'}`}>
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
                <div className="absolute inset-x-0 h-1 bg-[#3a3a3a] rounded-full">
                    {/* Fill bar - shows direction from center */}
                    <div
                        className="absolute h-full bg-blue-500 rounded-full transition-all duration-75 ease-out"
                        style={{
                            left: `${fillLeft}%`,
                            width: `${fillWidth}%`,
                        }}
                    />

                    {/* Center marker (0 point) - always visible */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-gray-500 rounded-full"
                        style={{ left: `${centerPercent}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                    />
                </div>

                {/* Thumb indicator - visible current position */}
                <div
                    className="absolute w-3 h-3 bg-white rounded-full shadow-md border border-gray-400 pointer-events-none transition-all duration-75"
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
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ margin: 0 }}
                />
            </div>
        </div>
    )
}
