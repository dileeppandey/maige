import { ChevronDown } from 'lucide-react'
import { AdjustmentSlider } from './AdjustmentSlider'
import type { LightAdjustments } from '../../../shared/types'

interface LightPanelProps {
    adjustments: LightAdjustments
    onAdjustmentChange: (key: keyof LightAdjustments, value: number) => void
}

const LIGHT_CONTROLS: { key: keyof LightAdjustments; label: string }[] = [
    { key: 'exposure', label: 'Exposure' },
    { key: 'contrast', label: 'Contrast' },
    { key: 'highlights', label: 'Highlights' },
    { key: 'shadows', label: 'Shadows' },
    { key: 'whites', label: 'Whites' },
    { key: 'blacks', label: 'Blacks' },
]

export function LightPanel({ adjustments, onAdjustmentChange }: LightPanelProps) {
    return (
        <div>
            <div className="flex items-center justify-between mb-3 text-xs font-semibold text-gray-400 uppercase">
                <span>Light</span>
                <ChevronDown size={14} />
            </div>
            <div className="space-y-4">
                {LIGHT_CONTROLS.map(({ key, label }) => (
                    <AdjustmentSlider
                        key={key}
                        label={label}
                        value={adjustments[key]}
                        onChange={(value) => onAdjustmentChange(key, value)}
                    />
                ))}
            </div>
        </div>
    )
}
