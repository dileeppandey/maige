import { LightPanel } from '../adjustments/LightPanel'
import { ColorPanel } from '../adjustments/ColorPanel'
import { AIPresets } from '../adjustments/AIPresets'
import type { LightAdjustments, ColorAdjustments, ImageAdjustments, StylePreset } from '../../../shared/types'
import { Button } from '../../design-system'

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
    onApplyBuiltIn?: (adjustments: Partial<ImageAdjustments>) => void
    selectedImagePath?: string | null
    histogramData?: { r: number[]; g: number[]; b: number[]; lum: number[] } | null
}

export function DevelopPanel({
    adjustments,
    onLightChange,
    onColorChange,
    onResetSettings,
    presets,
    onApplyPreset,
    onSavePreset,
    onApplyBuiltIn,
}: DevelopPanelProps) {
    return (
        <div className="h-full w-full flex flex-col bg-surface-raised">
            <div className="flex-1 overflow-y-auto p-4">
                {/* Header: Adjustments + Reset */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                        Adjustments
                    </h2>
                    <Button
                        onClick={onResetSettings}
                        variant="link"
                        size="sm"
                    >
                        Reset
                    </Button>
                </div>

                {/* Light & Color Sections */}
                <div className="space-y-6">
                    <LightPanel
                        adjustments={adjustments.light}
                        onAdjustmentChange={onLightChange}
                    />

                    <ColorPanel
                        adjustments={adjustments.color || { temperature: 0, tint: 0, saturation: 0, vibrance: 0 }}
                        onAdjustmentChange={onColorChange}
                    />
                </div>

                {/* AI Presets */}
                <div className="mt-6">
                    <AIPresets
                        presets={presets}
                        onApplyPreset={onApplyPreset}
                        onSavePreset={onSavePreset}
                        onApplyBuiltIn={onApplyBuiltIn}
                    />
                </div>
            </div>
        </div>
    )
}
