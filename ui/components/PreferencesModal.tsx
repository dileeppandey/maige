import { useEffect, useState } from 'react'
import { X, Settings, Bot, Monitor } from 'lucide-react'
import { useSettingsStore } from '../store/useSettingsStore'
import type { AiProvider, ExportFormat } from '../store/useSettingsStore'

interface PreferencesModalProps {
    isOpen: boolean
    onClose: () => void
}

type Tab = 'general' | 'ai' | 'interface'

export function PreferencesModal({ isOpen, onClose }: PreferencesModalProps) {
    const { settings, updateSetting } = useSettingsStore()
    const [activeTab, setActiveTab] = useState<Tab>('general')

    useEffect(() => {
        if (!isOpen) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'general', label: 'General', icon: <Settings size={15} /> },
        { id: 'ai', label: 'AI Assistant', icon: <Bot size={15} /> },
        { id: 'interface', label: 'Interface', icon: <Monitor size={15} /> },
    ]

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
                    <h2 className="text-sm font-semibold text-gray-200">Preferences</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a] transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <nav className="w-44 border-r border-[#2a2a2a] py-3 px-2 flex flex-col gap-0.5 shrink-0">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                                    activeTab === tab.id
                                        ? 'bg-blue-600/20 text-blue-400'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'general' && (
                            <GeneralTab settings={settings} onUpdate={updateSetting} />
                        )}
                        {activeTab === 'ai' && (
                            <AiTab settings={settings} onUpdate={updateSetting} />
                        )}
                        {activeTab === 'interface' && (
                            <InterfaceTab settings={settings} onUpdate={updateSetting} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type UpdateFn = ReturnType<typeof useSettingsStore>['updateSetting']

function SectionHeader({ title, description }: { title: string; description?: string }) {
    return (
        <div className="mb-4">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">{title}</h3>
            {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
    )
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 py-3 border-b border-[#2a2a2a] last:border-0">
            <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-300">{label}</div>
                {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!value)}
            className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-[#444]'}`}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    value ? 'translate-x-4' : 'translate-x-0'
                }`}
            />
        </button>
    )
}

function Select<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T
    options: { value: T; label: string }[]
    onChange: (v: T) => void
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value as T)}
            className="bg-[#2a2a2a] border border-[#444] rounded-md px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    )
}

function TextInput({
    value,
    placeholder,
    onChange,
    monospace,
}: {
    value: string
    placeholder?: string
    onChange: (v: string) => void
    monospace?: boolean
}) {
    return (
        <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onChange(e.target.value)}
            className={`bg-[#2a2a2a] border border-[#444] rounded-md px-2.5 py-1.5 text-xs text-gray-200 w-52 focus:outline-none focus:border-blue-500 ${monospace ? 'font-mono' : ''}`}
        />
    )
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab({ settings, onUpdate }: { settings: ReturnType<typeof useSettingsStore>['settings']; onUpdate: UpdateFn }) {
    const quality = parseInt(settings.export_quality, 10)

    return (
        <div>
            <SectionHeader title="Export" />
            <Row label="Default format" description="Format used when exporting images">
                <Select<ExportFormat>
                    value={settings.export_format}
                    options={[
                        { value: 'jpeg', label: 'JPEG' },
                        { value: 'png', label: 'PNG' },
                    ]}
                    onChange={(v) => onUpdate('export_format', v)}
                />
            </Row>
            <Row label="Default quality" description={`JPEG compression quality (${quality}%)`}>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min={1}
                        max={100}
                        value={quality}
                        onChange={(e) => onUpdate('export_quality', e.target.value)}
                        className="w-28 accent-blue-500"
                    />
                    <span className="text-xs text-gray-400 w-8 text-right">{quality}</span>
                </div>
            </Row>

            <div className="mt-6">
                <SectionHeader title="Import" />
                <Row label="Skip duplicates" description="Skip images that already exist in the library">
                    <Toggle
                        value={settings.import_skip_duplicates === 'true'}
                        onChange={(v) => onUpdate('import_skip_duplicates', v ? 'true' : 'false')}
                    />
                </Row>
            </div>
        </div>
    )
}

// ─── AI Assistant Tab ─────────────────────────────────────────────────────────

const AI_PROVIDERS: { value: AiProvider; label: string; description: string }[] = [
    { value: 'none', label: 'None', description: 'Disable AI features' },
    { value: 'ollama', label: 'Ollama', description: 'Local AI models via Ollama' },
]

function AiTab({ settings, onUpdate }: { settings: ReturnType<typeof useSettingsStore>['settings']; onUpdate: UpdateFn }) {
    const isOllama = settings.ai_provider === 'ollama'

    return (
        <div>
            <SectionHeader
                title="AI Provider"
                description="Choose your AI backend for natural language editing, scene analysis, and suggestions."
            />

            {/* Provider cards */}
            <div className="flex flex-col gap-2 mb-6">
                {AI_PROVIDERS.map((p) => (
                    <button
                        key={p.value}
                        onClick={() => onUpdate('ai_provider', p.value)}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                            settings.ai_provider === p.value
                                ? 'border-blue-500 bg-blue-600/10'
                                : 'border-[#333] bg-[#252525] hover:border-[#555]'
                        }`}
                    >
                        <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                settings.ai_provider === p.value ? 'border-blue-500' : 'border-[#555]'
                            }`}
                        >
                            {settings.ai_provider === p.value && (
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                            )}
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-200">{p.label}</div>
                            <div className="text-xs text-gray-500">{p.description}</div>
                        </div>
                    </button>
                ))}

                {/* Future providers placeholder */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-[#333] opacity-40">
                    <div className="w-4 h-4 rounded-full border-2 border-[#555] shrink-0" />
                    <div>
                        <div className="text-xs font-medium text-gray-400">More providers coming soon</div>
                        <div className="text-xs text-gray-600">OpenAI, Anthropic Claude, and others</div>
                    </div>
                </div>
            </div>

            {/* Ollama config */}
            {isOllama && (
                <div>
                    <SectionHeader title="Ollama Configuration" />
                    <Row label="Endpoint URL" description="URL where Ollama is running">
                        <TextInput
                            value={settings.ollama_endpoint}
                            placeholder="http://localhost:11434"
                            onChange={(v) => onUpdate('ollama_endpoint', v)}
                            monospace
                        />
                    </Row>
                    <Row label="Model" description="Ollama model to use for image editing">
                        <TextInput
                            value={settings.ollama_model}
                            placeholder="gemma4:e4b"
                            onChange={(v) => onUpdate('ollama_model', v)}
                            monospace
                        />
                    </Row>
                    <Row
                        label="Auto scene analysis"
                        description="Automatically analyze images when opened in the editor"
                    >
                        <Toggle
                            value={settings.ai_auto_scene_analysis === 'true'}
                            onChange={(v) => onUpdate('ai_auto_scene_analysis', v ? 'true' : 'false')}
                        />
                    </Row>
                </div>
            )}
        </div>
    )
}

// ─── Interface Tab ────────────────────────────────────────────────────────────

function InterfaceTab({ settings, onUpdate }: { settings: ReturnType<typeof useSettingsStore>['settings']; onUpdate: UpdateFn }) {
    return (
        <div>
            <SectionHeader title="Layout" />
            <Row label="Default view" description="Starting view when the app opens">
                <Select<'grid' | 'editor'>
                    value={settings.default_center_mode}
                    options={[
                        { value: 'grid', label: 'Grid' },
                        { value: 'editor', label: 'Editor' },
                    ]}
                    onChange={(v) => onUpdate('default_center_mode', v)}
                />
            </Row>
        </div>
    )
}
