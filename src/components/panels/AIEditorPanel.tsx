/**
 * AIEditorPanel — Conversational AI chat panel for image editing
 * Sits on the left side of the editor view.
 */

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Paperclip, ImageIcon, Mic, Check, User, Settings2 } from 'lucide-react'
import type { ImageAdjustments } from '../../../shared/types'
import { useAIStore } from '../../store/useAIStore'
import { useUIStore } from '../../store/useUIStore'

interface AIEditorPanelProps {
    selectedImagePath: string | null
    onApplyAdjustments: (adjustments: Partial<ImageAdjustments>) => void
}


function AdjustmentChip({ label, value }: { label: string; value: number }) {
    const isPositive = value >= 0
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                isPositive
                    ? 'bg-[#C8A951]/15 border-[#C8A951]/40 text-[#C8A951]'
                    : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
            }`}
        >
            {label} {isPositive ? '+' : ''}{value}
        </span>
    )
}

function formatAdjustmentLabel(key: string): string {
    const labels: Record<string, string> = {
        exposure: 'Exposure',
        contrast: 'Contrast',
        highlights: 'Highlights',
        shadows: 'Shadows',
        whites: 'Whites',
        blacks: 'Blacks',
        temperature: 'Temp',
        tint: 'Tint',
        saturation: 'Sat',
        vibrance: 'Vibrance',
    }
    return labels[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}


export function AIEditorPanel({ selectedImagePath, onApplyAdjustments }: AIEditorPanelProps) {
    const { messages, isThinking, sendMessage, applyProposal, clearMessages } = useAIStore()
    const { toggleAIConfig } = useUIStore()
    const [input, setInput] = useState('')

    const threadRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (threadRef.current) {
            threadRef.current.scrollTop = threadRef.current.scrollHeight
        }
    }, [messages, isThinking])

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }, [input])

    const handleSend = () => {
        const trimmed = input.trim()
        if (!trimmed || isThinking || !selectedImagePath) return
        setInput('')
        sendMessage(selectedImagePath, trimmed)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleApplyAll = (messageId: string) => {
        // Apply via store (which calls useEditStore internally)
        applyProposal(messageId)
        // Also propagate to parent for immediate canvas re-render
        const msg = messages.find(m => m.id === messageId)
        if (msg?.proposedAdjustments) {
            onApplyAdjustments(msg.proposedAdjustments)
        }
    }

    const handleUndo = (_messageId: string) => {
        // Undo is handled by the store; clear is a simpler fallback
        clearMessages()
    }

    return (
        <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-[#252525] border-r border-gray-300 dark:border-[#333333]">
            {/* Header */}
            <div className="h-10 flex items-center justify-between px-4 border-b border-gray-300 dark:border-[#333333] bg-white dark:bg-[#1f1f1f] flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[#C8A951]" />
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-300 uppercase tracking-wide">
                        AI Editor
                    </span>
                </div>
                <button
                    onClick={toggleAIConfig}
                    className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
                    title="AI Configuration"
                >
                    <Settings2 size={13} />
                    <span>Config</span>
                </button>
            </div>

            {/* Message Thread */}
            <div
                ref={threadRef}
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-4"
            >
                {/* Empty state */}
                {messages.length === 0 && !isThinking && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#C8A951]/10 border border-[#C8A951]/30 flex items-center justify-center">
                            <Sparkles size={18} className="text-[#C8A951]" />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            Describe how you'd like to edit this photo
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-600">
                            e.g. "Make the sky more vibrant" or "Give it a warm cinematic feel"
                        </p>
                    </div>
                )}

                {/* Messages */}
                {messages.map(message => (
                    <div
                        key={message.id}
                        className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                        {/* Avatar */}
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                            message.role === 'user'
                                ? 'bg-gray-200 dark:bg-[#333333] border border-gray-300 dark:border-[#444444]'
                                : 'bg-[#C8A951]/10 border border-[#C8A951]/30'
                        }`}>
                            {message.role === 'user'
                                ? <User size={12} className="text-gray-700 dark:text-gray-400" />
                                : <Sparkles size={12} className="text-[#C8A951]" />
                            }
                        </div>

                        {/* Bubble / Card */}
                        <div className={`max-w-[85%] ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                            {message.role === 'user' ? (
                                // User bubble
                                <div className="px-3 py-2 rounded-lg bg-[#C8A951]/20 border border-[#C8A951]/40">
                                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{message.content}</p>
                                </div>
                            ) : (
                                // AI response card
                                <div className="rounded-lg bg-gray-50 dark:bg-[#1e1e1e] border border-gray-300 dark:border-[#333333] p-3 flex flex-col gap-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <Sparkles size={11} className="text-[#C8A951]" />
                                        <span className="text-[11px] font-semibold text-[#C8A951] uppercase tracking-wide">
                                            Maige AI
                                        </span>
                                    </div>

                                    <p className="text-sm text-gray-800 dark:text-gray-300 leading-relaxed">{message.content}</p>

                                    {/* Adjustment chips — flatten nested Partial<ImageAdjustments> */}
                                    {message.proposedAdjustments && (() => {
                                        const adj = message.proposedAdjustments
                                        const pairs: [string, number][] = [
                                            ...Object.entries(adj.light ?? {}),
                                            ...Object.entries(adj.color ?? {}),
                                        ] as [string, number][]
                                        return pairs.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {pairs.map(([key, value]) => (
                                                    <AdjustmentChip
                                                        key={key}
                                                        label={formatAdjustmentLabel(key)}
                                                        value={value}
                                                    />
                                                ))}
                                            </div>
                                        ) : null
                                    })()}

                                    {/* Action row */}
                                    {message.proposedAdjustments && (
                                        <div className="flex items-center gap-2 pt-0.5">
                                            {message.applied ? (
                                                <div className="flex items-center gap-1 text-xs text-green-400">
                                                    <Check size={12} />
                                                    <span>Applied</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleApplyAll(message.id)}
                                                        className="px-3 py-1 text-xs font-semibold bg-[#C8A951] text-[#1a1a1a] rounded hover:bg-[#d4b55a] transition-colors"
                                                    >
                                                        Apply All
                                                    </button>
                                                    <button
                                                        onClick={() => handleUndo(message.id)}
                                                        className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                                                    >
                                                        Undo
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <span className="text-[10px] text-gray-500 dark:text-gray-600 px-1">
                                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}

                {/* Thinking indicator */}
                {isThinking && (
                    <div className="flex gap-2 flex-row">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#C8A951]/10 border border-[#C8A951]/30 flex items-center justify-center mt-0.5">
                            <Sparkles size={12} className="text-[#C8A951]" />
                        </div>
                        <div className="rounded-lg bg-gray-50 dark:bg-[#1e1e1e] border border-gray-300 dark:border-[#333333] p-3 flex items-center gap-2">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A951]/60 animate-bounce [animation-delay:0ms]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A951]/60 animate-bounce [animation-delay:150ms]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A951]/60 animate-bounce [animation-delay:300ms]" />
                            </div>
                            <span className="text-xs text-gray-600 dark:text-gray-500">Maige AI is thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-gray-300 dark:border-[#333333] p-3 bg-white dark:bg-[#1f1f1f]">
                <div className="rounded-lg bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-[#333333] focus-within:border-[#C8A951]/50 transition-colors">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe what you want to edit..."
                        rows={1}
                        className="w-full bg-transparent text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-600 px-3 pt-2.5 pb-1 resize-none outline-none leading-relaxed"
                        style={{ minHeight: '36px', maxHeight: '120px' }}
                    />

                    {/* Bottom action row */}
                    <div className="flex items-center justify-between px-2 pb-2 pt-1">
                        <div className="flex items-center gap-0.5">
                            <button
                                className="p-1.5 text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333333] rounded transition-colors"
                                title="Attach file"
                            >
                                <Paperclip size={14} />
                            </button>
                            <button
                                className="p-1.5 text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333333] rounded transition-colors"
                                title="Reference image"
                            >
                                <ImageIcon size={14} />
                            </button>
                            <button
                                disabled
                                className="p-1.5 text-gray-500 dark:text-gray-600 rounded cursor-not-allowed opacity-40"
                                title="Voice input (coming soon)"
                            >
                                <Mic size={14} />
                            </button>
                        </div>

                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isThinking}
                            className="p-1.5 rounded bg-[#C8A951] text-[#1a1a1a] hover:bg-[#d4b55a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Send (Enter)"
                        >
                            <Send size={13} />
                        </button>
                    </div>
                </div>

                <p className="text-[10px] text-gray-600 dark:text-gray-700 text-center mt-2">
                    Press Enter to send · Shift+Enter for new line
                </p>
            </div>
        </div>
    )
}
