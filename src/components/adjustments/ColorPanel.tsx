import { AdjustmentSlider } from './AdjustmentSlider'
import type { ColorAdjustments } from '../../../shared/types'
import { SectionHeader } from '../../design-system'

interface ColorPanelProps {
    adjustments: ColorAdjustments
    onAdjustmentChange: (key: keyof ColorAdjustments, value: number) => void
}

export function ColorPanel({ adjustments, onAdjustmentChange }: ColorPanelProps) {
    return (
        <div>
            <SectionHeader title="Color" className="mb-3" />
            <div className="space-y-4">
                <AdjustmentSlider
                    label="Temperature"
                    value={adjustments.temperature}
                    onChange={(val) => onAdjustmentChange('temperature', val)}
                    trackGradient="linear-gradient(to right, #3b82f6, #60a5fa, #a3a3a3, #fbbf24, #f97316, #ef4444)"
                    valueColor={adjustments.temperature > 0 ? '#ef4444' : adjustments.temperature < 0 ? '#3b82f6' : undefined}
                />
                <AdjustmentSlider
                    label="Tint"
                    value={adjustments.tint}
                    onChange={(val) => onAdjustmentChange('tint', val)}
                    trackGradient="linear-gradient(to right, #22c55e, #a3a3a3, #d946ef)"
                    valueColor={adjustments.tint > 0 ? '#d946ef' : adjustments.tint < 0 ? '#22c55e' : undefined}
                />
                <AdjustmentSlider
                    label="Vibrance"
                    value={adjustments.vibrance}
                    onChange={(val) => onAdjustmentChange('vibrance', val)}
                    trackGradient="linear-gradient(to right, #6b7280, #9ca3af, #C8A951, #e5b835)"
                    valueColor="#C8A951"
                />
                <AdjustmentSlider
                    label="Saturation"
                    value={adjustments.saturation}
                    onChange={(val) => onAdjustmentChange('saturation', val)}
                    trackGradient="linear-gradient(to right, #6b7280, #3b82f6, #a855f7, #ef4444, #f97316)"
                    valueColor="#3b82f6"
                />
            </div>
        </div>
    )
}
