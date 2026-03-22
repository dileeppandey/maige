import { AdjustmentSlider } from './AdjustmentSlider'
import type { LightAdjustments } from '../../../shared/types'
import { useThemeStore } from '../../store/useThemeStore'
import { SectionHeader } from '../../design-system'

interface LightPanelProps {
    adjustments: LightAdjustments
    onAdjustmentChange: (key: keyof LightAdjustments, value: number) => void
}

export function LightPanel({ adjustments, onAdjustmentChange }: LightPanelProps) {
    const { theme } = useThemeStore()
    const isDark = theme === 'dark'

    const gradients = {
        exposure: isDark
            ? 'linear-gradient(to right, #1a1a1a, #6b7280, #d1d5db, #ffffff)'
            : 'linear-gradient(to right, #374151, #9ca3af, #e5e7eb, #ffffff)',
        highlights: isDark
            ? 'linear-gradient(to right, #6b7280, #b0b0b0, #e5e7eb, #ffffff)'
            : 'linear-gradient(to right, #6b7280, #b0b0b0, #e5e7eb, #ffffff)',
        shadows: isDark
            ? 'linear-gradient(to right, #000000, #1a1a1a, #3a3a3a, #6b7280)'
            : 'linear-gradient(to right, #1f2937, #374151, #6b7280, #9ca3af)',
        whites: isDark
            ? 'linear-gradient(to right, #9ca3af, #d1d5db, #f3f4f6, #ffffff)'
            : 'linear-gradient(to right, #9ca3af, #d1d5db, #f3f4f6, #ffffff)',
        blacks: isDark
            ? 'linear-gradient(to right, #000000, #1a1a1a, #2a2a2a, #4b5563)'
            : 'linear-gradient(to right, #111827, #1f2937, #4b5563, #6b7280)',
    }

    return (
        <div>
            <SectionHeader title="Light" className="mb-3" />
            <div className="space-y-4">
                <AdjustmentSlider
                    label="Exposure"
                    value={adjustments.exposure}
                    onChange={(v) => onAdjustmentChange('exposure', v)}
                    trackGradient={gradients.exposure}
                    valueColor={isDark ? '#d1d5db' : '#374151'}
                />
                <AdjustmentSlider
                    label="Contrast"
                    value={adjustments.contrast}
                    onChange={(v) => onAdjustmentChange('contrast', v)}
                    trackColor="#a855f7"
                    valueColor="#a855f7"
                />
                <AdjustmentSlider
                    label="Highlights"
                    value={adjustments.highlights}
                    onChange={(v) => onAdjustmentChange('highlights', v)}
                    trackGradient={gradients.highlights}
                    valueColor={isDark ? '#d1d5db' : '#6b7280'}
                />
                <AdjustmentSlider
                    label="Shadows"
                    value={adjustments.shadows}
                    onChange={(v) => onAdjustmentChange('shadows', v)}
                    trackGradient={gradients.shadows}
                    valueColor={isDark ? '#6b7280' : '#4b5563'}
                />
                <AdjustmentSlider
                    label="Whites"
                    value={adjustments.whites}
                    onChange={(v) => onAdjustmentChange('whites', v)}
                    trackGradient={gradients.whites}
                    valueColor={isDark ? '#e5e7eb' : '#9ca3af'}
                />
                <AdjustmentSlider
                    label="Blacks"
                    value={adjustments.blacks}
                    onChange={(v) => onAdjustmentChange('blacks', v)}
                    trackGradient={gradients.blacks}
                    valueColor={isDark ? '#4b5563' : '#374151'}
                />
            </div>
        </div>
    )
}
