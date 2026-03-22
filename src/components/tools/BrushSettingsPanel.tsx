import { useState } from 'react'
import { Paintbrush } from 'lucide-react'
import { AdjustmentSlider } from '../adjustments/AdjustmentSlider'

export function BrushSettingsPanel() {
    const [size, setSize] = useState(40)
    const [opacity, setOpacity] = useState(80)
    const [flow, setFlow] = useState(100)
    const [feather, setFeather] = useState(15)
    const [showMaskOverlay, setShowMaskOverlay] = useState(false)

    return (
        <div className="h-full bg-gray-50 dark:bg-[#252525] border-r border-gray-300 dark:border-[#333] flex flex-col">
            {/* Header */}
            <div className="h-10 flex items-center px-4 border-b border-gray-300 dark:border-[#333] bg-white dark:bg-[#1f1f1f] shrink-0">
                <Paintbrush size={14} className="text-[#C8A951] mr-2" />
                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">Brush Settings</span>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <AdjustmentSlider
                    label="Size"
                    value={size}
                    min={1}
                    max={500}
                    onChange={setSize}
                />

                <AdjustmentSlider
                    label="Opacity"
                    value={opacity}
                    min={0}
                    max={100}
                    onChange={setOpacity}
                />

                <AdjustmentSlider
                    label="Flow"
                    value={flow}
                    min={0}
                    max={100}
                    onChange={setFlow}
                />

                <AdjustmentSlider
                    label="Feather"
                    value={feather}
                    min={0}
                    max={100}
                    onChange={setFeather}
                />

                {/* Show Mask Overlay toggle */}
                <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Show Mask Overlay</span>
                    <button
                        onClick={() => setShowMaskOverlay(!showMaskOverlay)}
                        className="relative w-9 h-5 rounded-full transition-colors duration-200"
                        style={{
                            backgroundColor: showMaskOverlay ? '#C8A951' : '#3a3a3a',
                        }}
                    >
                        <span
                            className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                            style={{
                                transform: showMaskOverlay ? 'translateX(16px)' : 'translateX(0)',
                            }}
                        />
                    </button>
                </div>
            </div>
        </div>
    )
}
