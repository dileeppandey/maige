import { ChevronDown, Copy, ClipboardPaste, RotateCcw } from 'lucide-react'
import { LightPanel } from '../adjustments/LightPanel'
import type { LightAdjustments, ImageAdjustments, StylePreset } from '../../../shared/types'

interface DevelopPanelProps {
    adjustments: ImageAdjustments
    onLightChange: (key: keyof LightAdjustments, value: number) => void
    onCopySettings: () => void
    onPasteSettings: () => void
    onResetSettings: () => void
    hasClipboard: boolean
    presets: StylePreset[]
    onApplyPreset: (presetId: string) => void
    onSavePreset: (name: string) => void
}

export function DevelopPanel({
    adjustments,
    onLightChange,
    onCopySettings,
    onPasteSettings,
    onResetSettings,
    hasClipboard,
    presets,
    onApplyPreset,
    onSavePreset
}: DevelopPanelProps) {
    const handleSavePreset = () => {
        const name = prompt('Enter preset name:')
        if (name && name.trim()) {
            onSavePreset(name.trim())
        }
    }

    return (
        <div className="h-full w-full flex flex-col bg-[#252525] border-l border-r border-[#333333]">
            <div className="h-12 flex items-center justify-between px-4 border-b border-[#333333]">
                <span className="font-semibold text-sm text-gray-100 uppercase tracking-wide">Develop</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onCopySettings}
                        className="p-1.5 hover:bg-[#333333] rounded text-gray-400 hover:text-gray-200"
                        title="Copy Settings"
                    >
                        <Copy size={14} />
                    </button>
                    <button
                        onClick={onPasteSettings}
                        disabled={!hasClipboard}
                        className="p-1.5 hover:bg-[#333333] rounded text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Paste Settings"
                    >
                        <ClipboardPaste size={14} />
                    </button>
                    <button
                        onClick={onResetSettings}
                        className="p-1.5 hover:bg-[#333333] rounded text-gray-400 hover:text-gray-200"
                        title="Reset All"
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {/* Histogram Placeholder */}
                <div className="h-32 bg-[#1a1a1a] rounded mb-6 border border-[#333333] flex items-center justify-center text-xs text-gray-600">
                    Histogram
                </div>

                {/* Presets Dropdown */}
                {presets.length > 0 && (
                    <div className="mb-6">
                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
                            Presets
                        </label>
                        <select
                            className="w-full bg-[#1a1a1a] border border-[#333333] text-gray-300 text-xs rounded px-2 py-1.5"
                            onChange={(e) => e.target.value && onApplyPreset(e.target.value)}
                            defaultValue=""
                        >
                            <option value="">Select a preset...</option>
                            {presets.map(preset => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Save Preset Button */}
                <button
                    onClick={handleSavePreset}
                    className="w-full mb-6 py-1.5 px-3 text-xs bg-[#1a1a1a] border border-[#333333] text-gray-400 hover:text-gray-200 hover:border-[#444444] rounded"
                >
                    Save as Preset...
                </button>

                {/* Basic Adjustments */}
                <div className="space-y-6">
                    <LightPanel
                        adjustments={adjustments.light}
                        onAdjustmentChange={onLightChange}
                    />

                    <div>
                        <div className="flex items-center justify-between mb-3 text-xs font-semibold text-gray-400 uppercase">
                            <span>Color</span>
                            <ChevronDown size={14} />
                        </div>
                        {/* Color sliders - coming soon */}
                        <div className="text-xs text-gray-600 italic">Coming soon...</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
