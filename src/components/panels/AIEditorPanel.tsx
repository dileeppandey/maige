/**
 * AIEditorPanel — Conversational AI chat panel for image editing
 * Sits on the left side of the editor view.
 */

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Paperclip, ImageIcon, Mic, Check, User } from 'lucide-react'
import type { ImageAdjustments } from '../../../shared/types'

interface AIMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    proposedAdjustments?: Record<string, number>
    applied: boolean
    timestamp: string
}

interface AIEditorPanelProps {
    selectedImagePath: string | null
    onApplyAdjustments: (adjustments: Partial<ImageAdjustments>) => void
}

// Mock AI responses for demo purposes (will be replaced with real AI integration)
const MOCK_RESPONSES: { content: string; adjustments: Record<string, number> }[] = [
    {
        content: "I've applied the following adjustments to enhance the sky:",
        adjustments: { vibrance: 55, temperature: 12, contrast: 18 },
    },
    {
        content: "Here are some adjustments to give your photo a warm golden hour feel:",
        adjustments: { exposure: 10, highlights: -20, shadows: 30, temperature: 35, saturation: 15 },
    },
    {
        content: "I've applied a cinematic grade to your photo:",
        adjustments: { contrast: 30, highlights: -30, shadows: -20, saturation: -20, temperature: -10 },
    },
]

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

function buildAdjustmentsFromRecord(
    record: Record<string, number>
): Partial<ImageAdjustments> {
    const lightKeys = new Set(['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks'])
    const colorKeys = new Set(['temperature', 'tint', 'saturation', 'vibrance'])

    const light: Record<string, number> = {}
    const color: Record<string, number> = {}

    for (const [key, value] of Object.entries(record)) {
        if (lightKeys.has(key)) light[key] = value
        else if (colorKeys.has(key)) color[key] = value
    }

    const result: Partial<ImageAdjustments> = {}
    if (Object.keys(light).length > 0) result.light = light as ImageAdjustments['light']
    if (Object.keys(color).length > 0) result.color = color as NonNullable<ImageAdjustments['color']>

    return result
}

export function AIEditorPanel({ selectedImagePath: _selectedImagePath, onApplyAdjustments }: AIEditorPanelProps) {
    // Local state scaffold — will be replaced with useAIStore when merged
    const [messages, setMessages] = useState<AIMessage[]>([])
    const [isThinking, setIsThinking] = useState(false)
    const [input, setInput] = useState('')

    const threadRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const mockResponseIndex = useRef(0)

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
        if (!trimmed || isThinking) return

        const userMessage: AIMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: trimmed,
            applied: false,
            timestamp: new Date().toISOString(),
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsThinking(true)

        // Simulate AI response after 1.5s
        setTimeout(() => {
            const mock = MOCK_RESPONSES[mockResponseIndex.current % MOCK_RESPONSES.length]
            mockResponseIndex.current += 1

            const aiMessage: AIMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: mock.content,
                proposedAdjustments: mock.adjustments,
                applied: false,
                timestamp: new Date().toISOString(),
            }

            setMessages(prev => [...prev, aiMessage])
            setIsThinking(false)
        }, 1500)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleApplyAll = (messageId: string, adjustments: Record<string, number>) => {
        const partial = buildAdjustmentsFromRecord(adjustments)
        onApplyAdjustments(partial)
        setMessages(prev =>
            prev.map(m => (m.id === messageId ? { ...m, applied: true } : m))
        )
    }

    const handleUndo = (messageId: string) => {
        setMessages(prev =>
            prev.map(m => (m.id === messageId ? { ...m, applied: false } : m))
        )
    }

    return (
        <div className="h-full w-full flex flex-col bg-[#252525] border-r border-[#333333]">
            {/* Header */}
            <div className="h-10 flex items-center gap-2 px-4 border-b border-[#333333] bg-[#1f1f1f] flex-shrink-0">
                <Sparkles size={14} className="text-[#C8A951]" />
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    Lumina AI
                </span>
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
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Describe how you'd like to edit this photo
                        </p>
                        <p className="text-xs text-gray-600">
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
                                ? 'bg-[#333333] border border-[#444444]'
                                : 'bg-[#C8A951]/10 border border-[#C8A951]/30'
                        }`}>
                            {message.role === 'user'
                                ? <User size={12} className="text-gray-400" />
                                : <Sparkles size={12} className="text-[#C8A951]" />
                            }
                        </div>

                        {/* Bubble / Card */}
                        <div className={`max-w-[85%] ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                            {message.role === 'user' ? (
                                // User bubble
                                <div className="px-3 py-2 rounded-lg bg-[#C8A951]/20 border border-[#C8A951]/40">
                                    <p className="text-sm text-gray-200 leading-relaxed">{message.content}</p>
                                </div>
                            ) : (
                                // AI response card
                                <div className="rounded-lg bg-[#1e1e1e] border border-[#333333] p-3 flex flex-col gap-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <Sparkles size={11} className="text-[#C8A951]" />
                                        <span className="text-[11px] font-semibold text-[#C8A951] uppercase tracking-wide">
                                            Lumina AI
                                        </span>
                                    </div>

                                    <p className="text-sm text-gray-300 leading-relaxed">{message.content}</p>

                                    {/* Adjustment chips */}
                                    {message.proposedAdjustments && Object.keys(message.proposedAdjustments).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {Object.entries(message.proposedAdjustments).map(([key, value]) => (
                                                <AdjustmentChip
                                                    key={key}
                                                    label={formatAdjustmentLabel(key)}
                                                    value={value}
                                                />
                                            ))}
                                        </div>
                                    )}

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
                                                        onClick={() => handleApplyAll(message.id, message.proposedAdjustments!)}
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

                            <span className="text-[10px] text-gray-600 px-1">
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
                        <div className="rounded-lg bg-[#1e1e1e] border border-[#333333] p-3 flex items-center gap-2">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A951]/60 animate-bounce [animation-delay:0ms]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A951]/60 animate-bounce [animation-delay:150ms]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A951]/60 animate-bounce [animation-delay:300ms]" />
                            </div>
                            <span className="text-xs text-gray-500">Lumina AI is thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-[#333333] p-3 bg-[#1f1f1f]">
                <div className="rounded-lg bg-[#252525] border border-[#333333] focus-within:border-[#C8A951]/50 transition-colors">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe what you want to edit..."
                        rows={1}
                        className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 px-3 pt-2.5 pb-1 resize-none outline-none leading-relaxed"
                        style={{ minHeight: '36px', maxHeight: '120px' }}
                    />

                    {/* Bottom action row */}
                    <div className="flex items-center justify-between px-2 pb-2 pt-1">
                        <div className="flex items-center gap-0.5">
                            <button
                                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-[#333333] rounded transition-colors"
                                title="Attach file"
                            >
                                <Paperclip size={14} />
                            </button>
                            <button
                                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-[#333333] rounded transition-colors"
                                title="Reference image"
                            >
                                <ImageIcon size={14} />
                            </button>
                            <button
                                disabled
                                className="p-1.5 text-gray-600 rounded cursor-not-allowed opacity-40"
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

                <p className="text-[10px] text-gray-700 text-center mt-2">
                    Press Enter to send · Shift+Enter for new line
                </p>
            </div>
        </div>
    )
}
