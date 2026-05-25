import { useRef, useEffect, useState, useCallback } from 'react';
import { Crosshair, BookOpen, Send, X, Loader2 } from 'lucide-react';
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
                        onApplyAdjustments={applyAdjustments}
                        onApplySuggestion={applyAdjustments}
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

interface MessageBubbleProps {
    msg: ChatMessage;
    onApplyAdjustments: (flat: FlatAdjustments) => void;
    onApplySuggestion: (flat: FlatAdjustments) => void;
}

function MessageBubble({ msg, onApplyAdjustments, onApplySuggestion }: MessageBubbleProps) {
    const isUser = msg.role === 'user';

    return (
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            {msg.regionBase64 && isUser && (
                <img
                    src={msg.regionBase64}
                    alt="Region context"
                    className="h-14 w-auto rounded border border-[#444] object-cover mb-1"
                />
            )}
            <div
                className={`max-w-[90%] rounded px-3 py-2 text-xs leading-relaxed ${
                    isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#333] text-gray-200'
                }`}
            >
                {msg.content}
            </div>

            {!isUser && msg.adjustments && (
                <button
                    onClick={() => onApplyAdjustments(msg.adjustments!)}
                    className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                    Apply adjustments
                </button>
            )}

            {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-2 space-y-1 w-full max-w-[90%]">
                    {msg.suggestions.map((sug, i) => (
                        <div key={i} className="flex items-center justify-between bg-[#2e2e2e] rounded px-2 py-1.5 gap-2">
                            <span className="text-xs text-gray-300 truncate">{sug.label}</span>
                            <button
                                onClick={() => onApplySuggestion(sug.adjustments)}
                                className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap flex-shrink-0"
                            >
                                Apply
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
