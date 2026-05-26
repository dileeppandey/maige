import { useRef, useEffect, useState, useCallback } from 'react';
import { Crosshair, BookOpen, Send, X, Loader2, Check, RotateCcw } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useUIStore } from '../../store/useUIStore';
import { useEditStore } from '../../store/useEditStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { flattenAdjustments } from '../../utils/adjustments';
import { AdjustmentSlider } from '../adjustments/AdjustmentSlider';
import type { ChatMessage, FlatAdjustments, ImageAdjustments, LightAdjustments, ColorAdjustments } from '../../../shared/types';
import { RecipeManager } from './RecipeManager';

interface ChatPanelProps {
    selectedImagePath: string | null;
    adjustments: ImageAdjustments;
}

function newId() {
    return Math.random().toString(36).slice(2);
}

// Light field keys and color field keys for routing to the right updater
const LIGHT_KEYS = new Set<keyof FlatAdjustments>(['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks']);
const COLOR_KEYS = new Set<keyof FlatAdjustments>(['temperature', 'tint', 'saturation', 'vibrance']);

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
    // Tracks the most-recently-selected path so in-flight AI responses can detect staleness
    const activePathRef = useRef<string | null>(null);

    const messages = useChatStore((s) => s.messages);
    const pendingRegion = useChatStore((s) => s.pendingRegion);
    const isAnalyzing = useChatStore((s) => s.isAnalyzing);
    const ollamaAvailable = useChatStore((s) => s.ollamaAvailable);
    const addMessage = useChatStore((s) => s.addMessage);
    const setMessages = useChatStore((s) => s.setMessages);
    const setPendingRegion = useChatStore((s) => s.setPendingRegion);
    const setAnalyzing = useChatStore((s) => s.setAnalyzing);

    const setRegionSelectMode = useUIStore((s) => s.setRegionSelectMode);

    // Read AI provider setting
    const aiProvider = useSettingsStore((s) => s.settings.ai_provider);
    const setOllamaAvailable = useChatStore((s) => s.setOllamaAvailable);

    // Use the same update functions the Develop panel uses — they're proven to work
    const updateLightAdjustment = useEditStore((s) => s.updateLightAdjustment);
    const updateColorAdjustment = useEditStore((s) => s.updateColorAdjustment);

    // Compute whether AI is available: Ollama running AND ai_provider is 'ollama'
    const isAIAvailable = ollamaAvailable === true && aiProvider === 'ollama';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Keep activePathRef in sync so sendMessage's async callback can detect stale responses
    useEffect(() => {
        activePathRef.current = selectedImagePath;
    }, [selectedImagePath]);

    // Load persisted chat history whenever the selected image changes
    useEffect(() => {
        if (!selectedImagePath) {
            setMessages([]);
            return;
        }
        window.api.getChatMessages(selectedImagePath).then((rows) => {
            // Guard: ignore if the user switched again before this resolved
            if (selectedImagePath !== activePathRef.current) return;
            const loaded: ChatMessage[] = rows.map((r) => ({
                id: r.id,
                role: r.role as 'user' | 'assistant',
                content: r.content,
                adjustments: r.adjustments ? JSON.parse(r.adjustments) : undefined,
                suggestions: r.suggestions ? JSON.parse(r.suggestions) : undefined,
                regionBase64: r.region_base64 ?? undefined,
                timestamp: r.timestamp,
            }));
            setMessages(loaded);
        });
    }, [selectedImagePath, setMessages]);

    // Apply a full FlatAdjustments object by routing each field to the correct updater
    const applyFlat = useCallback((flat: FlatAdjustments) => {
        if (!selectedImagePath) return;
        (Object.keys(flat) as Array<keyof FlatAdjustments>).forEach((key) => {
            if (LIGHT_KEYS.has(key)) {
                updateLightAdjustment(selectedImagePath, key as keyof LightAdjustments, flat[key]);
            } else if (COLOR_KEYS.has(key)) {
                updateColorAdjustment(selectedImagePath, key as keyof ColorAdjustments, flat[key]);
            }
        });
    }, [selectedImagePath, updateLightAdjustment, updateColorAdjustment]);

    const handleSliderChange = useCallback((field: keyof FlatAdjustments, value: number) => {
        if (!selectedImagePath) return;
        if (LIGHT_KEYS.has(field)) {
            updateLightAdjustment(selectedImagePath, field as keyof LightAdjustments, value);
        } else if (COLOR_KEYS.has(field)) {
            updateColorAdjustment(selectedImagePath, field as keyof ColorAdjustments, value);
        }
    }, [selectedImagePath, updateLightAdjustment, updateColorAdjustment]);

    // Helper to wrap promises with a timeout
    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
            promise,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(`AI request timed out after ${ms / 1000} seconds`)), ms)
            ),
        ]);

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text || !selectedImagePath || isAnalyzing || !isAIAvailable) return;
        setInput('');

        // Capture path at send-time so we can detect if the user switches images
        // while the AI call is in-flight
        const pathAtSend = selectedImagePath;

        const regionBase64 = pendingRegion?.base64;
        const userMsg: ChatMessage = {
            id: newId(),
            role: 'user',
            content: text,
            regionBase64,
            timestamp: new Date().toISOString(),
        };
        addMessage(userMsg);
        window.api.saveChatMessage({
            id: userMsg.id,
            imagePath: pathAtSend,
            role: userMsg.role,
            content: userMsg.content,
            regionBase64: userMsg.regionBase64 ?? null,
            timestamp: userMsg.timestamp,
        });
        if (pendingRegion) setPendingRegion(null);

        setAnalyzing(true);
        try {
            const result = await withTimeout(
                window.api.chatEditImage(
                    pathAtSend,
                    text,
                    flattenAdjustments(adjustments),
                    regionBase64,
                ),
                30000  // 30-second timeout
            ) as { message: string; adjustments: FlatAdjustments | null; suggestions: Array<{ label: string; adjustments: FlatAdjustments }> };

            // If the user switched to a different image while awaiting, discard the response.
            // The user message was already saved to DB for the correct image; the assistant
            // response would belong to the wrong chat context if we applied it now.
            if (pathAtSend !== activePathRef.current) return;

            const assistantMsg: ChatMessage = {
                id: newId(),
                role: 'assistant',
                content: result.message,
                adjustments: result.adjustments,
                suggestions: result.suggestions,
                timestamp: new Date().toISOString(),
            };
            addMessage(assistantMsg);
            window.api.saveChatMessage({
                id: assistantMsg.id,
                imagePath: pathAtSend,
                role: assistantMsg.role,
                content: assistantMsg.content,
                adjustments: result.adjustments ? JSON.stringify(result.adjustments) : null,
                suggestions: result.suggestions?.length ? JSON.stringify(result.suggestions) : null,
                timestamp: assistantMsg.timestamp,
            });

            // Auto-apply chat response adjustments immediately
            if (result.adjustments) {
                applyFlat(result.adjustments);
            }
        } catch (err) {
            // Handle timeout and other errors
            if (err instanceof Error && err.message.includes('timed out')) {
                const timeoutMsg: ChatMessage = {
                    id: newId(),
                    role: 'assistant',
                    content: err.message,
                    timestamp: new Date().toISOString(),
                };
                if (pathAtSend === activePathRef.current) {
                    addMessage(timeoutMsg);
                    window.api.saveChatMessage({
                        id: timeoutMsg.id,
                        imagePath: pathAtSend,
                        role: timeoutMsg.role,
                        content: timeoutMsg.content,
                        timestamp: timeoutMsg.timestamp,
                    });
                }
            }
            // Other errors are handled by bridge.ts fallback messages
        } finally {
            // Only clear the analyzing spinner if we're still on the same image
            if (pathAtSend === activePathRef.current) setAnalyzing(false);
        }
    }, [input, selectedImagePath, isAnalyzing, isAIAvailable, adjustments, pendingRegion, activePathRef, addMessage, setPendingRegion, setAnalyzing, applyFlat]);

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
                        title={
                            aiProvider === 'none'
                                ? 'AI features disabled'
                                : ollamaAvailable === null
                                ? 'Checking...'
                                : ollamaAvailable
                                ? 'Ollama connected'
                                : 'Ollama offline'
                        }
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            aiProvider === 'none'
                                ? 'bg-gray-500'
                                : ollamaAvailable === null
                                ? 'bg-gray-500'
                                : ollamaAvailable
                                ? 'bg-green-500'
                                : 'bg-red-500'
                        }`}
                    />
                    {aiProvider === 'ollama' && ollamaAvailable === false && (
                        <button
                            onClick={async () => {
                                const ok = await window.api.checkOllamaStatus();
                                setOllamaAvailable(ok);
                            }}
                            title="Re-check Ollama status"
                            className="p-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-[#333] transition-colors"
                        >
                            <RotateCcw size={12} />
                        </button>
                    )}
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
                            ? aiProvider === 'none'
                                ? 'AI features are disabled. Enable in Preferences > AI Assistant.'
                                : ollamaAvailable === false
                                ? 'Ollama is offline. Check Preferences > AI Assistant or click the refresh button above.'
                                : 'Describe how you want to edit this image, or select a region for targeted edits.'
                            : 'Open an image to start chatting.'}
                    </div>
                )}
                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        msg={msg}
                        currentAdjustments={flattenAdjustments(adjustments)}
                        onApply={applyFlat}
                        onSliderChange={handleSliderChange}
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
                    disabled={!selectedImagePath || isAnalyzing || !isAIAvailable}
                    placeholder={isAIAvailable ? 'Describe your edit…' : 'AI features disabled or offline'}
                    rows={2}
                    className="flex-1 bg-[#1a1a1a] text-white text-xs rounded border border-[#444] px-2 py-1.5 resize-none focus:outline-none focus:border-blue-500 placeholder-gray-600 disabled:opacity-50"
                />
                <button
                    onClick={sendMessage}
                    disabled={!input.trim() || !selectedImagePath || isAnalyzing || !isAIAvailable}
                    className="p-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={!isAIAvailable ? 'AI is not available' : 'Send message'}
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
    autoApplied: boolean;
}

function MessageBubble({ msg, currentAdjustments, onApply, onSliderChange, autoApplied }: MessageBubbleProps) {
    const isUser = msg.role === 'user';
    const [applyStates, setApplyStates] = useState<Record<number, ApplyState>>({});
    const [slidersOpen, setSlidersOpen] = useState<Record<number, boolean>>(
        autoApplied && msg.adjustments ? { [-1]: true } : {}
    );

    const triggerApply = useCallback((index: number, flat: FlatAdjustments) => {
        setApplyStates((prev) => ({ ...prev, [index]: 'applying' }));
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

            {/* Main chat-response adjustments */}
            {msg.adjustments && (
                <div className="mt-1.5 w-full">
                    {autoApplied && applyStates[-1] === undefined ? (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-green-400">
                                <Check size={12} />
                                <span>Applied</span>
                            </div>
                            <button
                                onClick={() => setSlidersOpen((prev) => ({ ...prev, [-1]: !prev[-1] }))}
                                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                {slidersOpen[-1] ? 'Hide sliders' : 'Fine-tune'}
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
                            suggestedAdjustments={msg.adjustments}
                            currentValues={currentAdjustments}
                            onChange={onSliderChange}
                        />
                    )}
                </div>
            )}

            {/* Scene analysis suggestions */}
            {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-2 space-y-1.5 w-full">
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
                                <div className="px-3 pb-3">
                                    <AdjustmentSliders
                                        suggestedAdjustments={sug.adjustments}
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
                <div className={`flex items-center gap-1.5 text-green-400 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                    <Check size={compact ? 11 : 12} />
                    <span>Applied</span>
                </div>
                <button
                    onClick={onToggleSliders}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                    {showSliders ? 'Hide' : 'Fine-tune'}
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
            {state === 'applying' && <Loader2 size={compact ? 11 : 12} className="animate-spin" />}
            {label}
        </button>
    );
}

// ---------------------------------------------------------------------------

interface AdjustmentSlidersProps {
    /** The AI-suggested values — determines which sliders to show */
    suggestedAdjustments: FlatAdjustments;
    /** Live current values from the edit store (passed as prop, re-renders when store changes) */
    currentValues: FlatAdjustments;
    onChange: (field: keyof FlatAdjustments, value: number) => void;
}

function AdjustmentSliders({ suggestedAdjustments, currentValues, onChange }: AdjustmentSlidersProps) {
    // Show sliders only for fields the AI changed (non-zero in suggestion)
    const fields = (Object.keys(suggestedAdjustments) as Array<keyof FlatAdjustments>).filter(
        (k) => suggestedAdjustments[k] !== 0
    );
    const visibleFields = fields.length > 0 ? fields : (Object.keys(suggestedAdjustments) as Array<keyof FlatAdjustments>);

    return (
        <div className="mt-3 space-y-1">
            {visibleFields.map((field) => (
                <AdjustmentSlider
                    key={field}
                    label={ADJ_LABELS[field]}
                    value={currentValues[field] ?? 0}
                    onChange={(value) => onChange(field, value)}
                />
            ))}
        </div>
    );
}
