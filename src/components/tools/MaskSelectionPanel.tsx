import { useState } from 'react'
import { CircleDot } from 'lucide-react'

type Mode = 'brush' | 'pen' | 'ai'

const instructions: Record<Mode, string> = {
    brush: 'Paint over the area you want to select',
    pen: 'Click to add points, close the path to complete selection',
    ai: 'Describe what you want to select and let AI create the mask',
}

export function MaskSelectionPanel() {
    const [mode, setMode] = useState<Mode>('brush')
    const [aiPrompt, setAiPrompt] = useState('')
    const [invertSelection, setInvertSelection] = useState(false)

    return (
        <div className="h-full bg-gray-50 dark:bg-[#252525] border-r border-gray-300 dark:border-[#333] flex flex-col">
            {/* Header */}
            <div className="h-10 flex items-center px-4 border-b border-gray-300 dark:border-[#333] bg-white dark:bg-[#1f1f1f] shrink-0">
                <CircleDot size={14} className="text-[#C8A951] mr-2" />
                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">Mask / Selection</span>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Mode tabs */}
                <div className="flex gap-1 bg-white dark:bg-[#1f1f1f] rounded-md p-0.5">
                    {([
                        { key: 'brush' as Mode, label: 'Brush' },
                        { key: 'pen' as Mode, label: 'Pen' },
                        { key: 'ai' as Mode, label: 'AI' },
                    ]).map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setMode(tab.key)}
                            className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                                mode === tab.key
                                    ? 'bg-[#C8A951] text-black font-medium'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* AI Mask Prompt (only in AI mode) */}
                {mode === 'ai' && (
                    <div className="space-y-1.5">
                        <label className="text-xs text-gray-600 dark:text-gray-400">AI Mask Prompt</label>
                        <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Select the sky..."
                            className="w-full bg-white dark:bg-[#1f1f1f] border border-gray-300 dark:border-[#333] rounded px-3 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-600 outline-none focus:border-[#C8A951] transition-colors"
                        />
                        <p className="text-[10px] text-gray-600 dark:text-gray-600">Describe what to select</p>
                    </div>
                )}

                {/* Invert Selection toggle */}
                <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Invert Selection</span>
                    <button
                        onClick={() => setInvertSelection(!invertSelection)}
                        className="relative w-9 h-5 rounded-full transition-colors duration-200"
                        style={{
                            backgroundColor: invertSelection ? '#C8A951' : '#3a3a3a',
                        }}
                    >
                        <span
                            className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                            style={{
                                transform: invertSelection ? 'translateX(16px)' : 'translateX(0)',
                            }}
                        />
                    </button>
                </div>

                {/* Instructions */}
                <p className="text-xs text-gray-600 dark:text-gray-500 leading-relaxed pt-2">
                    {instructions[mode]}
                </p>
            </div>
        </div>
    )
}
