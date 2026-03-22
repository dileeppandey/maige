import { useState } from 'react'
import { Eraser } from 'lucide-react'
import { AdjustmentSlider } from '../adjustments/AdjustmentSlider'

type Mode = 'heal' | 'clone'

export function HealClonePanel() {
    const [mode, setMode] = useState<Mode>('heal')
    const [brushSize, setBrushSize] = useState(50)
    const [softness, setSoftness] = useState(65)

    return (
        <div className="h-full bg-gray-50 dark:bg-[#252525] border-r border-gray-300 dark:border-[#333] flex flex-col">
            {/* Header */}
            <div className="h-10 flex items-center px-4 border-b border-gray-300 dark:border-[#333] bg-white dark:bg-[#1f1f1f] shrink-0">
                <Eraser size={14} className="text-[#C8A951] mr-2" />
                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">Heal / Clone</span>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Mode tabs */}
                <div className="flex gap-1 bg-white dark:bg-[#1f1f1f] rounded-md p-0.5">
                    <button
                        onClick={() => setMode('heal')}
                        className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                            mode === 'heal'
                                ? 'bg-[#C8A951] text-black font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    >
                        Heal
                    </button>
                    <button
                        onClick={() => setMode('clone')}
                        className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                            mode === 'clone'
                                ? 'bg-[#C8A951] text-black font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    >
                        Clone
                    </button>
                </div>

                <AdjustmentSlider
                    label="Brush Size"
                    value={brushSize}
                    min={1}
                    max={200}
                    onChange={setBrushSize}
                />

                <AdjustmentSlider
                    label="Softness"
                    value={softness}
                    min={0}
                    max={100}
                    onChange={setSoftness}
                />

                {/* Instructions */}
                <p className="text-xs text-gray-600 dark:text-gray-500 leading-relaxed pt-2">
                    Click to set source point, then paint to heal/clone
                </p>
            </div>
        </div>
    )
}
