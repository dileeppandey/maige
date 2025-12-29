/**
 * Right Panel Component
 * Wrapper with tabs for Develop and Details panels
 */

import { useState } from 'react';
import { Sliders, Info } from 'lucide-react';
import { DevelopPanel } from './DevelopPanel';
import { DetailsPanel } from './DetailsPanel';
import type { LightAdjustments, ColorAdjustments, ImageAdjustments, StylePreset } from '../../../shared/types';

type TabType = 'develop' | 'details';

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
    selectedImagePath,
    histogramData
}: RightPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('develop');

    return (
        <div className="h-full w-full flex flex-col bg-[#252525] border-l border-r border-[#333333]">
            {/* Tab Bar */}
            <div className="h-10 flex items-center border-b border-[#333333] bg-[#1f1f1f]">
                <button
                    onClick={() => setActiveTab('develop')}
                    className={`
                        flex items-center justify-center gap-1.5 h-full px-4 text-xs font-medium uppercase tracking-wide transition-colors
                        ${activeTab === 'develop'
                            ? 'text-white bg-[#252525] border-b-2 border-blue-500'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-[#252525]/50'
                        }
                    `}
                >
                    <Sliders size={12} />
                    Develop
                </button>
                <button
                    onClick={() => setActiveTab('details')}
                    className={`
                        flex items-center justify-center gap-1.5 h-full px-4 text-xs font-medium uppercase tracking-wide transition-colors
                        ${activeTab === 'details'
                            ? 'text-white bg-[#252525] border-b-2 border-blue-500'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-[#252525]/50'
                        }
                    `}
                >
                    <Info size={12} />
                    Details
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'develop' ? (
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
                        selectedImagePath={selectedImagePath}
                        histogramData={histogramData}
                    />
                ) : (
                    <DetailsPanel selectedImagePath={selectedImagePath} />
                )}
            </div>
        </div>
    );
}
