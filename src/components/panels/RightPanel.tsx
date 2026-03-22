/**
 * Right Panel Component
 * Displays Adjustments panel with Light, Color, and AI Presets sections
 */

import { DevelopPanel } from './DevelopPanel';
import type { LightAdjustments, ColorAdjustments, ImageAdjustments, StylePreset } from '../../../shared/types';

interface RightPanelProps {
    adjustments: ImageAdjustments;
    onLightChange: (key: keyof LightAdjustments, value: number) => void;
    onColorChange: (key: keyof ColorAdjustments, value: number) => void;
    onCopySettings: () => void;
    onPasteSettings: () => void;
    onResetSettings: () => void;
    hasClipboard: boolean;
    presets: StylePreset[];
    onApplyPreset: (presetId: string) => void;
    onSavePreset: (name: string) => void;
    onApplyBuiltIn?: (adjustments: Partial<ImageAdjustments>) => void;
    selectedImagePath?: string | null;
    histogramData?: { r: number[]; g: number[]; b: number[]; lum: number[] } | null;
}

export function RightPanel({
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
    onApplyBuiltIn,
    selectedImagePath,
    histogramData
}: RightPanelProps) {
    return (
        <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-[#252525] border-l border-r border-gray-200 dark:border-[#333333]">
            <div className="flex-1 overflow-hidden">
                <DevelopPanel
                    adjustments={adjustments}
                    onLightChange={onLightChange}
                    onColorChange={onColorChange}
                    onCopySettings={onCopySettings}
                    onPasteSettings={onPasteSettings}
                    onResetSettings={onResetSettings}
                    hasClipboard={hasClipboard}
                    presets={presets}
                    onApplyPreset={onApplyPreset}
                    onSavePreset={onSavePreset}
                    onApplyBuiltIn={onApplyBuiltIn}
                    selectedImagePath={selectedImagePath}
                    histogramData={histogramData}
                />
            </div>
        </div>
    );
}
