import { Droplet, Sun, Palette } from 'lucide-react'
import { AdjustmentSlider } from './AdjustmentSlider'
import type { ColorAdjustments } from '../../../shared/types'

interface ColorPanelProps {
    adjustments: ColorAdjustments
    onAdjustmentChange: (key: keyof ColorAdjustments, value: number) => void
}

export function ColorPanel({ adjustments, onAdjustmentChange }: ColorPanelProps) {
    return (
        <div className="space-y-4">
            {/* White Balance Section */}
            <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-400">
                    <Sun size={12} />
                    <span>White Balance</span>
                </div>
                <div className="space-y-4 pl-2">
                    <AdjustmentSlider
                        label="Temp"
                        value={adjustments.temperature}
                        min={-100}
                        max={100}
                        onChange={(val) => onAdjustmentChange('temperature', val)}
                        icon={<span className="text-[10px] select-none">TMP</span>}
                    />
                    <AdjustmentSlider
                        label="Tint"
                        value={adjustments.tint}
                        min={-100}
                        max={100}
                        onChange={(val) => onAdjustmentChange('tint', val)}
                        icon={<span className="text-[10px] select-none">TINT</span>}
                    />
                </div>
            </div>

            {/* Saturation Section */}
            <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-400">
                    <Palette size={12} />
                    <span>Presence</span>
                </div>
                <div className="space-y-4 pl-2">
                    <AdjustmentSlider
                        label="Vibrance"
                        value={adjustments.vibrance}
                        min={-100}
                        max={100}
                        onChange={(val) => onAdjustmentChange('vibrance', val)}
                        icon={<Droplet size={14} />}
                    />
                    <AdjustmentSlider
                        label="Saturation"
                        value={adjustments.saturation}
                        min={-100}
                        max={100}
                        onChange={(val) => onAdjustmentChange('saturation', val)}
                        icon={<Droplet size={14} />}
                    />
                </div>
            </div>
        </div>
    )
}
