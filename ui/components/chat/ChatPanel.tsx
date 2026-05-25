import { useRef, useEffect, useState, useCallback } from 'react';
import { Crosshair, BookOpen, Send, X, Loader2, Check } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useUIStore } from '../../store/useUIStore';
import { useEditStore } from '../../store/useEditStore';
import { flattenAdjustments, unflattenAdjustments } from '../../utils/adjustments';
import type { ChatMessage, FlatAdjustments, ImageAdjustments } from '../../../shared/types';
import { RecipeManager } from './RecipeManager';

interface ChatPanelProps {
    selectedImagePath: string | null;
    adjustments: ImageAdjustments;
}

function newId() {
    return Math.random().toString(36).slice(2);
}

const ADJ_LABELS: Record<keyof FlatAdjustments, string> = {
    exposure: 'Exposure',
    contrast: 'Contrast',
    highlights: 'Highlights',
    shadows: 'Shadows',
    whites: 'Whites',
    blacks: 'Blacks',
    temperature: 'Temp',
    tint: 'Tint',
    saturation: 'Saturation',
    vibrance: 'Vibrance',
};

export function ChatPanel({ selectedImagePath, adjustments }: ChatPanelProps) {
    const [input, setInput] = useState('');
    const [showRecipes, setShowRecipes] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const messages = useChatStore((s) => s.messages);
    const pendingRegion = useChatStore((s) => s.pendingRegion);
    const isAnalyzing = useChatStore((s) => s.isAnalyzing);
    const ollamaAvailable = useChatStore((s) => s.ollamaAvailable);
    const addMessage = useChatStore((s) => s.addMessage);
    const setPendingRegion = useChatStore((s) => s.setPendingRegion);
    const setAnalyzing = useChatStore((s) => s.setAnalyzing);

    const setRegionSelectMode = useUIStore((s) => s.setRegionSelectMode);
    const setAdjustments = useEditStore((s) => s.setAdjustments);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const applyAdjustments = useCallback((flat: FlatAdjustments) => {
        if (!selectedImagePath) return;
        setAdjustments(selectedImagePath, unflattenAdjustments(flat));
    }, [selectedImagePath, setAdjustments]);

    const updateSlider = useCallback((field: keyof FlatAdjustments, value: number) => {
        if (!selectedImagePath) return;
        const current = flattenAdjustments(adjustments);
        const updated = { ...current, [field]: value };
        setAdjustments(selectedImagePath, unflattenAdjustments(updated));
    }, [selectedImagePath, adjustments, setAdjustments]);

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text || !selectedImagePath || isAnalyzing) return;
        setInput('');

        const userMsg: ChatMessage = {
            id: newId(),
            role: 'user',
            content: text,
            regionBase64: pendingRegion?.base64,
            timestamp: new Date().toISOString(),
        };
        addMessage(userMsg);
        if (pendingRegion) setPendingRegion(null);

        setAnalyzing(true);
        try {
            const result = await window.api.chatEditImage(
                selectedImagePath,
                text,
                flattenAdjustments(adjustments),
                pendingRegion?.base64,
            ) as { message: string; adjustments: FlatAdjustments | null; suggestions: Array<{ label: string; adjustments: FlatAdjustments }> };

            const assistantMsg: ChatMessage = {
                id: newId(),
                role: 'assistant',
                content: result.message,
                adjustments: result.adjustments,
                suggestions: result.suggestions,
                timestamp: new Date().toISOString(),
            };
            addMessage(assistantMsg);

            // Auto-apply adjustments from chat response
            if (result.adjustments) {
                applyAdjustments(result.adjustments);
            }
        } finally {
            setAnalyzing(false);
        }
    }, [input, selectedImagePath, isAnalyzing, adjustments, pendingRegion, addMessage, setPendingRegion, setAnalyzing, applyAdjustments]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#252525]">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#333]">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-300 uppercase tracking-wide">AI Assistant</span>
                    <span
                        title={ollamaAvailable === null ? 'Checking...' : ollamaAvailable ? 'Ollama connected' : 'Ollama offline'}
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            ollamaAvailable === null ? 'bg-gray-500' :
                            ollamaAvailable ? 'bg-green-500' : 'bg-red-500'
                        }`}
                    />
                </div>
                <div className="flex items-center gap-1">
                    <button
                        title="Select region for context"
                        onClick={() => setRegionSelectMode(true)}
                        disabled={!selectedImagePath}
                        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <Crosshair size={14} />
                    </button>
                    <button
                        title="Recipes"
                        onClick={() => setShowRecipes(true)}
                        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#333] transition-colors"
                    >
                        <BookOpen size={14} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {messages.length === 0 && (
                    <div className="text-center text-gray-600 text-xs mt-8 px-4">
                        {selectedImagePath
                            ? 'Describe how you want to edit this image, or select a region for targeted edits.'
                            : 'Open an image to start chatting.'}
                    </div>
                )}
                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        msg={msg}
                        currentAdjustments={flattenAdjustments(adjustments)}
                        onApply={applyAdjustments}
                        onSliderChange={updateSlider}
                        autoApplied={msg.role === 'assistant' && !!msg.adjustments && !msg.suggestions?.length}
                    />
                ))}
                {isAnalyzing && (
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                        <Loader2 size={12} className="animate-spin" />
                        Thinking…
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Pending region preview */}
            {pendingRegion && (
                <div className="px-3 py-2 border-t border-[#333] flex items-center gap-2">
                    <img
                        src={pendingRegion.base64}
                        alt="Selected region"
                        className="h-10 w-auto rounded border border-[#444] object-cover"
                    />
                    <span className="text-xs text-gray-400 flex-1">Region selected</span>
                    <button onClick={() => setPendingRegion(null)} className="text-gray-500 hover:text-white">
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* Input */}
            <div className="px-3 py-2 border-t border-[#333] flex gap-2 items-end">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!selectedImagePath || isAnalyzing}
                    placeholder="Describe your edit…"
                    rows={2}
                    className="flex-1 bg-[#1a1a1a] text-white text-xs rounded border border-[#444] px-2 py-1.5 resize-none focus:outline-none focus:border-blue-500 placeholder-gray-600 disabled:opacity-50"
                />
                <button
                    onClick={sendMessage}
                    disabled={!input.trim() || !selectedImagePath || isAnalyzing}
                    className="p-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <Send size={13} className="text-white" />
                </button>
            </div>

            {showRecipes && (
                <RecipeManager
                    onClose={() => setShowRecipes(false)}
                    selectedImagePath={selectedImagePath}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------

type ApplyState = 'idle' | 'applying' | 'applied';

interface MessageBubbleProps {
    msg: ChatMessage;
    currentAdjustments: FlatAdjustments;
    onApply: (flat: FlatAdjustments) => void;
    onSliderChange: (field: keyof FlatAdjustments, value: number) => void;
    /** True when this assistant message's adjustments were auto-applied on arrival */
    autoApplied: boolean;
}

function MessageBubble({ msg, currentAdjustments, onApply, onSliderChange, autoApplied }: MessageBubbleProps) {
    const isUser = msg.role === 'user';
    // One apply-state per suggestion index (-1 = the main adjustments button)
    const [applyStates, setApplyStates] = useState<Record<number, ApplyState>>({});
    // Which items are showing their sliders (index -1 = main adjustments)
    const [slidersOpen, setSlidersOpen] = useState<Record<number, boolean>>(
        // auto-open sliders for auto-applied main adjustments
        autoApplied && msg.adjustments ? { [-1]: true } : {}
    );

    const triggerApply = useCallback((index: number, flat: FlatAdjustments) => {
        setApplyStates((prev) => ({ ...prev, [index]: 'applying' }));
        // Small delay so spinner is visible even for instant store writes
        setTimeout(() => {
            onApply(flat);
            setApplyStates((prev) => ({ ...prev, [index]: 'applied' }));
            setSlidersOpen((prev) => ({ ...prev, [index]: true }));
        }, 350);
    }, [onApply]);

    if (isUser) {
        return (
            <div className="flex flex-col items-end">
                {msg.regionBase64 && (
                    <img
                        src={msg.regionBase64}
                        alt="Region context"
                        className="h-14 w-auto rounded border border-[#444] object-cover mb-1"
                    />
                )}
                <div className="max-w-[90%] rounded px-3 py-2 text-xs leading-relaxed bg-blue-600 text-white">
                    {msg.content}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-start w-full">
            <div className="max-w-[90%] rounded px-3 py-2 text-xs leading-relaxed bg-[#333] text-gray-200">
                {msg.content}
            </div>

            {/* Main adjustments (chat response) */}
            {msg.adjustments && (
                <div className="mt-1.5 w-full max-w-[95%]">
                    {autoApplied && applyStates[-1] === undefined ? (
                        // Was auto-applied on arrival — show applied state immediately
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-green-400">
                                <Check size={12} />
                                <span>Applied</span>
                            </div>
                            <button
                                onClick={() => setSlidersOpen((prev) => ({ ...prev, [-1]: !prev[-1] }))}
                                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                {slidersOpen[-1] ? 'Hide sliders' : 'Adjust'}
                            </button>
                        </div>
                    ) : (
                        <ApplyButton
                            state={applyStates[-1] ?? 'idle'}
                            label="Apply adjustments"
                            onApply={() => triggerApply(-1, msg.adjustments!)}
                            showSliders={slidersOpen[-1]}
                            onToggleSliders={() => setSlidersOpen((prev) => ({ ...prev, [-1]: !prev[-1] }))}
                        />
                    )}
                    {slidersOpen[-1] && (
                        <AdjustmentSliders
                            adjustments={msg.adjustments}
                            currentValues={currentAdjustments}
                            onChange={onSliderChange}
                        />
                    )}
                </div>
            )}

            {/* Suggestions */}
            {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-2 space-y-1.5 w-full max-w-[95%]">
                    {msg.suggestions.map((sug, i) => (
                        <div key={i} className="rounded bg-[#2a2a2a] border border-[#3a3a3a]">
                            <div className="flex items-center justify-between px-2.5 py-2 gap-2">
                                <span className="text-xs text-gray-300 truncate">{sug.label}</span>
                                <ApplyButton
                                    state={applyStates[i] ?? 'idle'}
                                    label="Apply"
                                    onApply={() => triggerApply(i, sug.adjustments)}
                                    showSliders={slidersOpen[i]}
                                    onToggleSliders={() => setSlidersOpen((prev) => ({ ...prev, [i]: !prev[i] }))}
                                    compact
                                />
                            </div>
                            {slidersOpen[i] && (
                                <div className="px-2.5 pb-2.5">
                                    <AdjustmentSliders
                                        adjustments={sug.adjustments}
                                        currentValues={currentAdjustments}
                                        onChange={onSliderChange}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------

interface ApplyButtonProps {
    state: ApplyState;
    label: string;
    onApply: () => void;
    showSliders: boolean;
    onToggleSliders: () => void;
    compact?: boolean;
}

function ApplyButton({ state, label, onApply, showSliders, onToggleSliders, compact }: ApplyButtonProps) {
    if (state === 'applied') {
        return (
            <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs text-green-400 ${compact ? 'text-[11px]' : ''}`}>
                    <Check size={compact ? 11 : 12} />
                    <span>Applied</span>
                </div>
                <button
                    onClick={onToggleSliders}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                    {showSliders ? 'Hide' : 'Adjust'}
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={onApply}
            disabled={state === 'applying'}
            className={`flex items-center gap-1.5 rounded transition-colors disabled:cursor-not-allowed
                ${compact
                    ? 'px-2 py-0.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60'
                    : 'px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60'
                }`}
        >
            {state === 'applying' ? (
                <Loader2 size={compact ? 11 : 12} className="animate-spin" />
            ) : null}
            {label}
        </button>
    );
}

// ---------------------------------------------------------------------------

interface AdjustmentSlidersProps {
    /** The AI-suggested values — used to know which sliders to show */
    adjustments: FlatAdjustments;
    /** Live current values from the edit store */
    currentValues: FlatAdjustments;
    onChange: (field: keyof FlatAdjustments, value: number) => void;
}

function AdjustmentSliders({ adjustments, currentValues, onChange }: AdjustmentSlidersProps) {
    // Show only sliders for fields the AI actually changed (non-zero in suggestion)
    const fields = (Object.keys(adjustments) as Array<keyof FlatAdjustments>).filter(
        (k) => adjustments[k] !== 0
    );

    // If nothing was changed, show all fields anyway so user can still explore
    const visibleFields = fields.length > 0 ? fields : (Object.keys(adjustments) as Array<keyof FlatAdjustments>);

    return (
        <div className="mt-2 space-y-2">
            {visibleFields.map((field) => {
                const live = currentValues[field] ?? 0;
                return (
                    <div key={field} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-16 shrink-0 text-right">
                            {ADJ_LABELS[field]}
                        </span>
                        <input
                            type="range"
                            min={-100}
                            max={100}
                            step={1}
                            value={live}
                            onChange={(e) => onChange(field, Number(e.target.value))}
                            className="flex-1 h-1 accent-blue-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-400 w-8 text-right tabular-nums shrink-0">
                            {live > 0 ? `+${live}` : live}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
