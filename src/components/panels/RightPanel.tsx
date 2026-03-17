/**
 * Right Panel Component
 * Wrapper with tabs for Develop and Details panels
 */

import { useState } from 'react';
import { Sliders, Info, Sparkles, Settings2 } from 'lucide-react';
import { DevelopPanel } from './DevelopPanel';
import { DetailsPanel } from './DetailsPanel';
import { AIEditorPanel } from './AIEditorPanel';
import { useUIStore } from '../../store/useUIStore';
import type { LightAdjustments, ColorAdjustments, ImageAdjustments, StylePreset } from '../../../shared/types';

type TabType = 'develop' | 'details' | 'ai';

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
    const { toggleAIConfig } = useUIStore();

    const tabClass = (tab: TabType) => `
        flex items-center justify-center gap-1.5 h-full px-3 text-xs font-medium uppercase tracking-wide transition-colors
        ${activeTab === tab
            ? 'text-white bg-[#252525] border-b-2 border-[#C8A951]'
            : 'text-gray-500 hover:text-gray-300 hover:bg-[#252525]/50'
        }
    `;

    return (
        <div className="h-full w-full flex flex-col bg-[#252525] border-l border-r border-[#333333]">
            {/* Tab Bar */}
            <div className="h-10 flex items-center border-b border-[#333333] bg-[#1f1f1f]">
                <button onClick={() => setActiveTab('develop')} className={tabClass('develop')}>
                    <Sliders size={12} />
                    Develop
                </button>
                <button onClick={() => setActiveTab('ai')} className={tabClass('ai')}>
                    <Sparkles size={12} />
                    AI
                </button>
                <button onClick={() => setActiveTab('details')} className={tabClass('details')}>
                    <Info size={12} />
                    Details
                </button>
                {/* Config button — only visible on AI tab */}
                {activeTab === 'ai' && (
                    <button
                        onClick={toggleAIConfig}
                        className="ml-auto mr-2 p-1.5 text-gray-500 hover:text-gray-200 hover:bg-[#333] rounded transition-colors"
                        title="AI Configuration"
                    >
                        <Settings2 size={14} />
                    </button>
                )}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'develop' && (
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
                )}
                {activeTab === 'ai' && (
                    <AIEditorPanel
                        selectedImagePath={selectedImagePath ?? null}
                        onApplyAdjustments={(adj) => {
                            if (adj.light) {
                                Object.entries(adj.light).forEach(([k, v]) =>
                                    onLightChange(k as keyof LightAdjustments, v)
                                );
                            }
                            if (adj.color) {
                                Object.entries(adj.color).forEach(([k, v]) =>
                                    onColorChange(k as keyof ColorAdjustments, v)
                                );
                            }
                        }}
                    />
                )}
                {activeTab === 'details' && (
                    <DetailsPanel selectedImagePath={selectedImagePath} />
                )}
            </div>
        </div>
    );
}
