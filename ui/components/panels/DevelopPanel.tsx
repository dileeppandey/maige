import { useState, useEffect } from 'react'
import { ChevronDown, Copy, ClipboardPaste, RotateCcw, Tag } from 'lucide-react'
import { LightPanel } from '../adjustments/LightPanel'
import { ColorPanel } from '../adjustments/ColorPanel'
import { Histogram } from '../adjustments/Histogram'
import type { LightAdjustments, ColorAdjustments, ImageAdjustments, StylePreset } from '../../../shared/types'

interface DevelopPanelProps {
    adjustments: ImageAdjustments
    onLightChange: (key: keyof LightAdjustments, value: number) => void
    onColorChange: (key: keyof ColorAdjustments, value: number) => void
    onCopySettings: () => void
    onPasteSettings: () => void
    onResetSettings: () => void
    hasClipboard: boolean
    presets: StylePreset[]
    onApplyPreset: (presetId: string) => void
    onSavePreset: (name: string) => void
    selectedImagePath?: string | null
    histogramData?: { r: number[]; g: number[]; b: number[]; lum: number[] } | null
}

interface ImageTagInfo {
    tag: string
    score: number
    category: string | null
}

export function DevelopPanel({
    adjustments,
    onLightChange,
    onColorChange,
    onCopySettings,
    onPasteSettings,
    onResetSettings,
    hasClipboard,
    presets,
    onApplyPreset,
    onSavePreset,
    selectedImagePath,
    histogramData
}: DevelopPanelProps) {
    const [imageTags, setImageTags] = useState<ImageTagInfo[]>([])

    // Fetch tags when selected image changes
    useEffect(() => {
        const loadTags = async () => {
            if (!selectedImagePath) {
                setImageTags([])
                return
            }
            try {
                const tags = await window.api.getImageTagsByPath(selectedImagePath)
                setImageTags(tags)
            } catch {
                setImageTags([])
            }
        }
        loadTags()
    }, [selectedImagePath])

    const handleSavePreset = () => {
        const name = prompt('Enter preset name:')
        if (name && name.trim()) {
            onSavePreset(name.trim())
        }
    }

    return (
        <div className="h-full w-full flex flex-col bg-[#252525]">
            <div className="flex-1 overflow-y-auto p-4">
                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-1 mb-4">
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
                {/* Histogram */}
                <Histogram histogramData={histogramData ?? null} />

                {/* AI Tags Section */}
                {imageTags.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                            <Tag size={12} />
                            <span>AI Tags</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {imageTags.map((tag, idx) => (
                                <span
                                    key={idx}
                                    className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded border border-blue-500/30"
                                    title={`Confidence: ${Math.round(tag.score * 100)}%`}
                                >
                                    {tag.tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

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
                        <ColorPanel
                            adjustments={adjustments.color || { temperature: 0, tint: 0, saturation: 0, vibrance: 0 }}
                            onAdjustmentChange={onColorChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

