/**
 * AI Batch Edit Panel
 * Slide-in right panel for applying AI-powered batch edits to selected images.
 */

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { assetUrl } from '../../utils/assetUrl';
import { Checkbox, Button } from '../../design-system';

interface AIBatchEditPanelProps {
    selectedImagePaths: string[];
    selectedImageIds: number[];
    onClose: () => void;
    onComplete: () => void;
}

interface Operations {
    colorGrading: boolean;
    autoEnhance: boolean;
    noiseReduction: boolean;
    smartCrop: boolean;
}

export function AIBatchEditPanel({
    selectedImagePaths,
    selectedImageIds,
    onClose,
    onComplete,
}: AIBatchEditPanelProps) {
    const [instruction, setInstruction] = useState('');
    const [operations, setOperations] = useState<Operations>({
        colorGrading: true,
        autoEnhance: true,
        noiseReduction: false,
        smartCrop: false,
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const totalSelected = selectedImageIds.length;
    const visibleThumbnails = selectedImagePaths.slice(0, 6);
    const extraCount = totalSelected > 6 ? totalSelected - 6 : 0;

    const toggleOperation = (key: keyof Operations) => {
        setOperations(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleApply = async () => {
        if (totalSelected === 0 || isProcessing) return;

        setIsProcessing(true);
        setProgress({ current: 0, total: totalSelected });

        for (let i = 0; i < selectedImageIds.length; i++) {
            const id = selectedImageIds[i];
            try {
                await window.api.markImageAIEdited(id);
            } catch (e) {
                console.error(`Failed to mark image ${id} as AI-edited:`, e);
            }
            setProgress({ current: i + 1, total: totalSelected });
        }

        setIsProcessing(false);
        onComplete();
    };

    return (
        <div className="h-full w-[280px] flex flex-col bg-surface-raised border-l border-border-base">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-base bg-surface-panel">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-accent" />
                    <span className="text-sm font-semibold text-text-primary tracking-wide">AI Batch Edit</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                    aria-label="Close AI Batch Edit panel"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {/* Selected Photos Strip */}
                {totalSelected > 0 && (
                    <div>
                        <p className="text-xs text-text-secondary mb-2">
                            {totalSelected} photo{totalSelected !== 1 ? 's' : ''} selected
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {visibleThumbnails.map((path, idx) => (
                                <div
                                    key={idx}
                                    className="w-10 h-10 rounded overflow-hidden bg-surface-card flex-shrink-0"
                                >
                                    <img
                                        src={assetUrl(path)}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        draggable={false}
                                    />
                                </div>
                            ))}
                            {extraCount > 0 && (
                                <div className="w-10 h-10 rounded bg-surface-card flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs text-text-primary font-medium">+{extraCount}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Batch Instructions */}
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-text-primary uppercase tracking-wide">
                        Batch Instructions
                    </label>
                    <textarea
                        value={instruction}
                        onChange={e => setInstruction(e.target.value)}
                        placeholder="Apply consistent color grading across all selected photos..."
                        rows={4}
                        disabled={isProcessing}
                        className="w-full bg-surface-input border border-border-base rounded text-sm text-text-primary
                                   placeholder-text-faint px-3 py-2 resize-none focus:outline-none
                                   focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors disabled:opacity-50"
                    />
                </div>

                {/* Operations */}
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-text-primary uppercase tracking-wide">
                        Operations
                    </label>
                    <div className="space-y-2.5">
                        {/* Color Grading */}
                        <Checkbox
                            checked={operations.colorGrading}
                            onChange={() => toggleOperation('colorGrading')}
                            disabled={isProcessing}
                            label="Color Grading"
                        />

                        {/* Auto Enhance */}
                        <Checkbox
                            checked={operations.autoEnhance}
                            onChange={() => toggleOperation('autoEnhance')}
                            disabled={isProcessing}
                            label="Auto Enhance"
                        />

                        {/* Noise Reduction (coming soon) */}
                        <Checkbox
                            checked={operations.noiseReduction}
                            onChange={() => toggleOperation('noiseReduction')}
                            disabled={true}
                            label="Noise Reduction"
                            description="(coming soon)"
                        />

                        {/* Smart Crop (coming soon) */}
                        <Checkbox
                            checked={operations.smartCrop}
                            onChange={() => toggleOperation('smartCrop')}
                            disabled={true}
                            label="Smart Crop"
                            description="(coming soon)"
                        />
                    </div>
                </div>

                {/* Progress bar */}
                {isProcessing && (
                    <div className="space-y-2">
                        <div className="h-1.5 bg-surface-card rounded-full overflow-hidden">
                            <div
                                className="h-full bg-accent rounded-full transition-all duration-300"
                                style={{
                                    width: progress.total > 0
                                        ? `${(progress.current / progress.total) * 100}%`
                                        : '0%',
                                }}
                            />
                        </div>
                        <p className="text-xs text-text-secondary text-center">
                            Processing {progress.current}/{progress.total} photos...
                        </p>
                    </div>
                )}
            </div>

            {/* Apply Button */}
            <div className="px-4 py-4 border-t border-border-base">
                <Button
                    onClick={handleApply}
                    disabled={isProcessing || totalSelected === 0}
                    variant="primary"
                    size="md"
                    className="w-full"
                    loading={isProcessing}
                >
                    {!isProcessing && `Apply to ${totalSelected} Photo${totalSelected !== 1 ? 's' : ''}`}
                </Button>
            </div>
        </div>
    );
}
