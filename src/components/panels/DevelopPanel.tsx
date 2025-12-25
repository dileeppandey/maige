import { ChevronDown } from 'lucide-react'

export function DevelopPanel() {
    return (
        <div className="h-full w-full flex flex-col bg-[#252525] border-l border-r border-[#333333]">
            <div className="h-12 flex items-center px-4 border-b border-[#333333]">
                <span className="font-semibold text-sm text-gray-100 uppercase tracking-wide">Develop</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {/* Histogram Placeholder */}
                <div className="h-32 bg-[#1a1a1a] rounded mb-6 border border-[#333333] flex items-center justify-center text-xs text-gray-600">
                    Histogram
                </div>

                {/* Basic Adjustments */}
                <div className="space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-3 text-xs font-semibold text-gray-400 uppercase">
                            <span>Light</span>
                            <ChevronDown size={14} />
                        </div>
                        <div className="space-y-4">
                            {['Exposure', 'Contrast', 'Highlights', 'Shadows'].map(label => (
                                <div key={label} className="space-y-1">
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>{label}</span>
                                        <span className="text-gray-500">0</span>
                                    </div>
                                    <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                                        <div className="w-1/2 h-full bg-gray-600"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3 text-xs font-semibold text-gray-400 uppercase">
                            <span>Color</span>
                            <ChevronDown size={14} />
                        </div>
                        {/* Color sliders placeholders */}
                    </div>
                </div>
            </div>
        </div>
    )
}
