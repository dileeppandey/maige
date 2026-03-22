/**
 * AIPresets — Visual preset card grid for the Develop panel.
 * Replaces the plain-text dropdown preset selector with clickable cards.
 */

import { Plus } from 'lucide-react'
import type { StylePreset, ImageAdjustments } from '../../../shared/types'
import { SectionHeader, Badge, Button } from '../../design-system'

// ---- Built-in AI presets -----------------------------------------------

interface BuiltInPreset {
    id: string
    name: string
    adjustments: Partial<ImageAdjustments>
}

const BUILT_IN_PRESETS: BuiltInPreset[] = [
    {
        id: '__builtin_golden_hour__',
        name: 'Golden Hour',
        adjustments: {
            light: {
                exposure: 10,
                highlights: -20,
                shadows: 30,
                contrast: 0,
                whites: 0,
                blacks: 0,
            },
            color: {
                temperature: 35,
                saturation: 15,
                vibrance: 20,
                tint: 0,
            },
        },
    },
    {
        id: '__builtin_cinematic__',
        name: 'Cinematic',
        adjustments: {
            light: {
                contrast: 30,
                highlights: -30,
                shadows: -20,
                blacks: -15,
                exposure: 0,
                whites: 0,
            },
            color: {
                saturation: -20,
                temperature: -10,
                tint: 0,
                vibrance: 0,
            },
        },
    },
    {
        id: '__builtin_moody_dark__',
        name: 'Moody Dark',
        adjustments: {
            light: {
                exposure: -20,
                contrast: 40,
                highlights: -40,
                shadows: -30,
                whites: 0,
                blacks: 0,
            },
            color: {
                saturation: -30,
                vibrance: -10,
                temperature: 0,
                tint: 0,
            },
        },
    },
]

// ---- Helpers ---------------------------------------------------------------

/** Return a short summary of the most interesting adjustment values. */
function getSummaryChips(adjustments: Partial<ImageAdjustments>): { label: string; value: number }[] {
    const chips: { label: string; value: number }[] = []

    const labelMap: Record<string, string> = {
        exposure: 'Exp',
        contrast: 'Con',
        highlights: 'Hi',
        shadows: 'Sha',
        whites: 'Whi',
        blacks: 'Blk',
        temperature: 'Temp',
        tint: 'Tint',
        saturation: 'Sat',
        vibrance: 'Vib',
    }

    if (adjustments.light) {
        for (const [key, value] of Object.entries(adjustments.light)) {
            if (value !== 0 && chips.length < 3) {
                chips.push({ label: labelMap[key] ?? key, value: value as number })
            }
        }
    }

    if (chips.length < 3 && adjustments.color) {
        for (const [key, value] of Object.entries(adjustments.color)) {
            if (value !== 0 && chips.length < 3) {
                chips.push({ label: labelMap[key] ?? key, value: value as number })
            }
        }
    }

    return chips
}

// ---- Sub-components --------------------------------------------------------

function PresetChip({ label, value }: { label: string; value: number }) {
    const isPositive = value >= 0
    return (
        <Badge variant={isPositive ? 'accent' : 'blue'} size="sm">
            {label} {isPositive ? '+' : ''}{value}
        </Badge>
    )
}

interface PresetCardProps {
    name: string
    adjustments: Partial<ImageAdjustments>
    onClick: () => void
}

function PresetCard({ name, adjustments, onClick }: PresetCardProps) {
    const chips = getSummaryChips(adjustments)

    return (
        <button
            onClick={onClick}
            className="
                group text-left rounded-lg bg-surface-card border border-border-base
                hover:border-accent/60 hover:bg-surface-hover
                transition-all duration-150 p-2.5 flex flex-col gap-2
                focus:outline-none focus:border-accent/80
            "
        >
            <span className="text-xs font-semibold text-text-primary leading-tight truncate w-full">
                {name}
            </span>
            {chips.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {chips.map(chip => (
                        <PresetChip key={chip.label} label={chip.label} value={chip.value} />
                    ))}
                </div>
            )}
        </button>
    )
}

// ---- Main component --------------------------------------------------------

interface AIPresetsProps {
    presets: StylePreset[]
    onApplyPreset: (presetId: string) => void
    onSavePreset: (name: string) => void
    /** Called when a built-in AI preset is applied directly. */
    onApplyBuiltIn?: (adjustments: Partial<ImageAdjustments>) => void
}

export function AIPresets({ presets, onApplyPreset, onSavePreset, onApplyBuiltIn }: AIPresetsProps) {
    const handleSavePreset = () => {
        const name = prompt('Enter preset name:')
        if (name && name.trim()) {
            onSavePreset(name.trim())
        }
    }

    const handleBuiltInClick = (preset: BuiltInPreset) => {
        if (onApplyBuiltIn) {
            onApplyBuiltIn(preset.adjustments)
        } else {
            // Fallback: try to apply via id if caller handles it
            onApplyPreset(preset.id)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Section label */}
            <SectionHeader title="AI Presets" />

            {/* Built-in presets grid */}
            <div className="grid grid-cols-3 gap-2">
                {BUILT_IN_PRESETS.map(preset => (
                    <PresetCard
                        key={preset.id}
                        name={preset.name}
                        adjustments={preset.adjustments}
                        onClick={() => handleBuiltInClick(preset)}
                    />
                ))}
            </div>

            {/* User presets */}
            {presets.length > 0 && (
                <>
                    <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mt-1">
                        My Presets
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {presets.map(preset => (
                            <PresetCard
                                key={preset.id}
                                name={preset.name}
                                adjustments={preset.adjustments}
                                onClick={() => onApplyPreset(preset.id)}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Save current as preset */}
            <Button
                onClick={handleSavePreset}
                variant="ghost"
                size="sm"
                className="w-full mt-1"
                leftIcon={<Plus size={12} />}
            >
                Save Current as Preset
            </Button>
        </div>
    )
}
