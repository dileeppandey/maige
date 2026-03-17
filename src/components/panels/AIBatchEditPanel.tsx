/**
 * AI Batch Edit Panel
 * Slide-in right panel for applying AI-powered batch edits to selected images.
 */

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { assetUrl } from '../../utils/assetUrl';

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
        <div className="h-full w-[280px] flex flex-col bg-[#252525] border-l border-[#333333]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#333333] bg-[#1f1f1f]">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#C8A951]" />
                    <span className="text-sm font-semibold text-white tracking-wide">AI Batch Edit</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Close AI Batch Edit panel"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {/* Selected Photos Strip */}
                {totalSelected > 0 && (
                    <div>
                        <p className="text-xs text-gray-400 mb-2">
                            {totalSelected} photo{totalSelected !== 1 ? 's' : ''} selected
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {visibleThumbnails.map((path, idx) => (
                                <div
                                    key={idx}
                                    className="w-10 h-10 rounded overflow-hidden bg-[#333333] flex-shrink-0"
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
                                <div className="w-10 h-10 rounded bg-[#333333] flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs text-gray-300 font-medium">+{extraCount}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Batch Instructions */}
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-300 uppercase tracking-wide">
                        Batch Instructions
                    </label>
                    <textarea
                        value={instruction}
                        onChange={e => setInstruction(e.target.value)}
                        placeholder="Apply consistent color grading across all selected photos..."
                        rows={4}
                        disabled={isProcessing}
                        className="w-full bg-[#1a1a1a] border border-[#444444] rounded text-sm text-gray-200
                                   placeholder-gray-600 px-3 py-2 resize-none focus:outline-none
                                   focus:border-[#C8A951]/60 transition-colors disabled:opacity-50"
                    />
                </div>

                {/* Operations */}
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-300 uppercase tracking-wide">
                        Operations
                    </label>
                    <div className="space-y-2.5">
                        {/* Color Grading */}
                        <label className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={operations.colorGrading}
                                onChange={() => toggleOperation('colorGrading')}
                                disabled={isProcessing}
                                className="w-4 h-4 rounded border-[#444444] bg-[#1a1a1a] accent-[#C8A951]
                                           cursor-pointer disabled:cursor-not-allowed"
                            />
                            <span className="text-sm text-gray-200 group-hover:text-white transition-colors">
                                Color Grading
                            </span>
                        </label>

                        {/* Auto Enhance */}
                        <label className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={operations.autoEnhance}
                                onChange={() => toggleOperation('autoEnhance')}
                                disabled={isProcessing}
                                className="w-4 h-4 rounded border-[#444444] bg-[#1a1a1a] accent-[#C8A951]
                                           cursor-pointer disabled:cursor-not-allowed"
                            />
                            <span className="text-sm text-gray-200 group-hover:text-white transition-colors">
                                Auto Enhance
                            </span>
                        </label>

                        {/* Noise Reduction (coming soon) */}
                        <label className="flex items-center gap-2.5 cursor-not-allowed">
                            <input
                                type="checkbox"
                                checked={operations.noiseReduction}
                                onChange={() => toggleOperation('noiseReduction')}
                                disabled={isProcessing}
                                className="w-4 h-4 rounded border-[#444444] bg-[#1a1a1a] accent-[#C8A951]
                                           cursor-not-allowed opacity-50"
                            />
                            <span className="text-sm text-gray-500">
                                Noise Reduction{' '}
                                <span className="text-gray-600 text-xs">(coming soon)</span>
                            </span>
                        </label>

                        {/* Smart Crop (coming soon) */}
                        <label className="flex items-center gap-2.5 cursor-not-allowed">
                            <input
                                type="checkbox"
                                checked={operations.smartCrop}
                                onChange={() => toggleOperation('smartCrop')}
                                disabled={isProcessing}
                                className="w-4 h-4 rounded border-[#444444] bg-[#1a1a1a] accent-[#C8A951]
                                           cursor-not-allowed opacity-50"
                            />
                            <span className="text-sm text-gray-500">
                                Smart Crop{' '}
                                <span className="text-gray-600 text-xs">(coming soon)</span>
                            </span>
                        </label>
                    </div>
                </div>

                {/* Progress bar */}
                {isProcessing && (
                    <div className="space-y-2">
                        <div className="h-1.5 bg-[#333333] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#C8A951] rounded-full transition-all duration-300"
                                style={{
                                    width: progress.total > 0
                                        ? `${(progress.current / progress.total) * 100}%`
                                        : '0%',
                                }}
                            />
                        </div>
                        <p className="text-xs text-gray-400 text-center">
                            Processing {progress.current}/{progress.total} photos...
                        </p>
                    </div>
                )}
            </div>

            {/* Apply Button */}
            <div className="px-4 py-4 border-t border-[#333333]">
                <button
                    onClick={handleApply}
                    disabled={isProcessing || totalSelected === 0}
                    className="w-full py-2.5 px-4 rounded font-semibold text-sm
                               bg-[#C8A951] text-[#1a1a1a] hover:bg-[#d4b85e] transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing
                        ? 'Processing...'
                        : `Apply to ${totalSelected} Photo${totalSelected !== 1 ? 's' : ''}`}
                </button>
            </div>
        </div>
    );
}
