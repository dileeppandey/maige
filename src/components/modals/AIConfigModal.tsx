/**
 * AI Config Modal
 * Configure AI model provider, API keys, and input channels for AI-assisted editing.
 */

import { useState } from 'react';
import {
    Settings2,
    SlidersHorizontal,
    Image,
    Mic,
    FileText,
    KeyRound,
    Lock,
} from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '../../design-system';
import { useUIStore } from '../../store/useUIStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'provider' | 'parameters' | 'vision' | 'voice' | 'prompts' | 'apikeys';

type Provider = 'claude' | 'gpt4vision' | 'gemini';

interface InputChannels {
    textPrompts: boolean;
    imageReference: boolean;
    voiceInput: boolean;
}

interface APIKeys {
    anthropic: string;
    openai: string;
    google: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ToggleProps {
    enabled: boolean;
    onChange: (val: boolean) => void;
}

function Toggle({ enabled, onChange }: ToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                enabled ? 'bg-accent' : 'bg-surface-hover'
            }`}
        >
            <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
            />
        </button>
    );
}

// ─── Section: Model Provider ──────────────────────────────────────────────────

const PROVIDERS: { id: Provider; name: string; description: string }[] = [
    {
        id: 'claude',
        name: 'Claude (Anthropic)',
        description: 'Best for nuanced editing instructions and multi-step workflows',
    },
    {
        id: 'gpt4vision',
        name: 'GPT-4 Vision (OpenAI)',
        description: 'Strong visual understanding and creative editing suggestions',
    },
    {
        id: 'gemini',
        name: 'Gemini Pro Vision (Google)',
        description: 'Fast processing with strong multi-modal understanding',
    },
];

interface ProviderSectionProps {
    selectedProvider: Provider;
    onSelectProvider: (p: Provider) => void;
    inputChannels: InputChannels;
    onToggleChannel: (channel: keyof InputChannels) => void;
}

function ProviderSection({
    selectedProvider,
    onSelectProvider,
    inputChannels,
    onToggleChannel,
}: ProviderSectionProps) {
    return (
        <div className="space-y-6">
            {/* Active Provider */}
            <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">Active Provider</h3>
                <p className="text-xs text-text-secondary mb-4">
                    Select which AI model powers your image editing.
                </p>
                <div className="space-y-3">
                    {PROVIDERS.map((provider) => {
                        const isSelected = selectedProvider === provider.id;
                        return (
                            <button
                                key={provider.id}
                                type="button"
                                onClick={() => onSelectProvider(provider.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                                    isSelected
                                        ? 'border-accent bg-accent/10'
                                        : 'border-border-base bg-surface-card hover:border-border-base'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* Radio indicator */}
                                        <span
                                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                                                isSelected
                                                    ? 'border-accent'
                                                    : 'border-border-base'
                                            }`}
                                        >
                                            {isSelected && (
                                                <span className="h-2 w-2 rounded-full bg-accent" />
                                            )}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium text-text-primary">
                                                {provider.name}
                                            </p>
                                            <p className="text-xs text-text-secondary mt-0.5">
                                                {provider.description}
                                            </p>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/40">
                                            Active
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Multi-Modal Input Channels */}
            <div>
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                    Multi-Modal Input Channels
                </h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-border-base bg-surface-card">
                        <div>
                            <p className="text-sm text-text-primary">Text Prompts</p>
                            <p className="text-xs text-text-secondary mt-0.5">
                                Type natural language editing instructions
                            </p>
                        </div>
                        <Toggle
                            enabled={inputChannels.textPrompts}
                            onChange={() => onToggleChannel('textPrompts')}
                        />
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-border-base bg-surface-card">
                        <div>
                            <p className="text-sm text-text-primary">Image Reference</p>
                            <p className="text-xs text-text-secondary mt-0.5">
                                Upload or select a reference image for style matching
                            </p>
                        </div>
                        <Toggle
                            enabled={inputChannels.imageReference}
                            onChange={() => onToggleChannel('imageReference')}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Section: API Keys ────────────────────────────────────────────────────────

interface APIKeysSectionProps {
    apiKeys: APIKeys;
    onChangeKey: (provider: keyof APIKeys, value: string) => void;
}

function APIKeysSection({ apiKeys, onChangeKey }: APIKeysSectionProps) {
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState<Record<string, boolean>>({});

    const handleSave = async (provider: keyof APIKeys, key: string) => {
        if (!key.trim()) return;
        setSaving((prev) => ({ ...prev, [provider]: true }));
        try {
            await window.api.saveAPIKey(provider, key.trim());
            setSaved((prev) => ({ ...prev, [provider]: true }));
            setTimeout(() => {
                setSaved((prev) => ({ ...prev, [provider]: false }));
            }, 2000);
        } catch (err) {
            console.error('Failed to save API key:', err);
        } finally {
            setSaving((prev) => ({ ...prev, [provider]: false }));
        }
    };

    const fields: { provider: keyof APIKeys; label: string; placeholder: string }[] = [
        { provider: 'anthropic', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
        { provider: 'openai', label: 'OpenAI API Key', placeholder: 'sk-...' },
        { provider: 'google', label: 'Google API Key', placeholder: 'AIza...' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">API Keys</h3>
                <p className="text-xs text-text-secondary mb-5">
                    Enter your API keys for each provider you want to use.
                </p>
                <div className="space-y-4">
                    {fields.map(({ provider, label, placeholder }) => (
                        <div key={provider}>
                            <label className="block text-xs font-medium text-text-secondary mb-1.5">
                                {label}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={apiKeys[provider]}
                                    onChange={(e) => onChangeKey(provider, e.target.value)}
                                    placeholder={placeholder}
                                    className="flex-1 px-3 py-2 bg-surface-input border border-border-base rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleSave(provider, apiKeys[provider])}
                                    disabled={!apiKeys[provider].trim() || saving[provider]}
                                    className="px-4 py-2 text-xs font-medium rounded-lg bg-accent text-black hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    {saving[provider] ? 'Saving...' : saved[provider] ? 'Saved!' : 'Save'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-border-base bg-surface-card">
                <Lock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <p className="text-xs text-text-secondary">
                    Keys are stored securely on your device, never uploaded.
                </p>
            </div>
        </div>
    );
}

// ─── Placeholder section ──────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <p className="text-sm font-medium text-text-primary">{label}</p>
            <span className="text-xs px-3 py-1 rounded-full bg-surface-hover text-text-muted">
                Coming soon
            </span>
        </div>
    );
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'provider', label: 'Model Provider', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'parameters', label: 'Parameters', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'vision', label: 'Vision Input', icon: <Image className="w-4 h-4" /> },
    { id: 'voice', label: 'Voice Input', icon: <Mic className="w-4 h-4" /> },
    { id: 'prompts', label: 'Text Prompts', icon: <FileText className="w-4 h-4" /> },
    { id: 'apikeys', label: 'API Keys', icon: <KeyRound className="w-4 h-4" /> },
];

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function AIConfigModal() {
    const { showAIConfig, toggleAIConfig } = useUIStore();

    // Local state
    const [activeSection, setActiveSection] = useState<Section>('provider');
    const [selectedProvider, setSelectedProvider] = useState<Provider>('claude');
    const [inputChannels, setInputChannels] = useState<InputChannels>({
        textPrompts: true,
        imageReference: false,
        voiceInput: false,
    });
    const [apiKeys, setApiKeys] = useState<APIKeys>({
        anthropic: '',
        openai: '',
        google: '',
    });


    const handleToggleChannel = (channel: keyof InputChannels) => {
        setInputChannels((prev) => ({ ...prev, [channel]: !prev[channel] }));
    };

    const handleChangeApiKey = (provider: keyof APIKeys, value: string) => {
        setApiKeys((prev) => ({ ...prev, [provider]: value }));
    };

    const handleSaveConfiguration = async () => {
        try {
            await window.api.saveAIConfig({
                provider: selectedProvider,
                inputChannels,
            });
            // Save any non-empty API keys
            for (const [provider, key] of Object.entries(apiKeys)) {
                if (key.trim()) {
                    await window.api.saveAPIKey(provider, key.trim());
                }
            }
        } catch (err) {
            console.error('Failed to save AI config:', err);
        }
        toggleAIConfig();
    };

    const renderContent = () => {
        switch (activeSection) {
            case 'provider':
                return (
                    <ProviderSection
                        selectedProvider={selectedProvider}
                        onSelectProvider={setSelectedProvider}
                        inputChannels={inputChannels}
                        onToggleChannel={handleToggleChannel}
                    />
                );
            case 'apikeys':
                return (
                    <APIKeysSection
                        apiKeys={apiKeys}
                        onChangeKey={handleChangeApiKey}
                    />
                );
            case 'parameters':
                return <ComingSoon label="Parameters" />;
            case 'vision':
                return <ComingSoon label="Vision Input" />;
            case 'voice':
                return <ComingSoon label="Voice Input" />;
            case 'prompts':
                return <ComingSoon label="Text Prompts" />;
            default:
                return null;
        }
    };

    return (
        <Modal isOpen={showAIConfig} onClose={toggleAIConfig} size="full" className="flex flex-col h-[600px]">
            <ModalHeader onClose={toggleAIConfig} icon={<Settings2 size={16} />}>AI Config</ModalHeader>

            {/* Body: sidebar + content layout */}
            <ModalBody scrollable={false} padding={false} className="flex flex-1 min-h-0">
                {/* Left sidebar */}
                <aside className="w-[280px] shrink-0 bg-surface-panel border-r border-border-base py-3 flex flex-col overflow-y-auto">
                        <nav className="space-y-0.5 px-2">
                            {NAV_ITEMS.map((item) => {
                                const isActive = activeSection === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setActiveSection(item.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                            isActive
                                                ? 'bg-accent/15 text-accent'
                                                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                                        }`}
                                    >
                                        <span className={isActive ? 'text-accent' : ''}>
                                            {item.icon}
                                        </span>
                                        {item.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                {/* Right content */}
                <main className="flex-1 overflow-y-auto px-6 py-5">
                    {renderContent()}
                </main>
            </ModalBody>

            <ModalFooter>
                <Button variant="ghost" size="sm" onClick={toggleAIConfig}>
                    Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveConfiguration}>
                    Save Configuration
                </Button>
            </ModalFooter>
        </Modal>
    );
}
