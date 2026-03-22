import { MousePointer2, Crop, Paintbrush, Eraser, PenTool, Sparkles, Type, Layers, Moon, Sun } from 'lucide-react'

import { useThemeStore } from '../../store/useThemeStore'

interface ToolSidebarProps {
    activeTool?: string
    onToolChange?: (tool: string) => void
}

function ToolButton({ id, active, onClick, children, label, disabled }: {
    id: string
    active: boolean
    onClick: (id: string) => void
    children: React.ReactNode
    label: string
    disabled?: boolean
}) {
    const isAI = id === 'ai'
    return (
        <button
            className={`flex items-center p-0 justify-center w-10 h-10 rounded-lg transition-colors ${
                disabled
                    ? 'opacity-30 cursor-not-allowed'
                    : active
                        ? isAI
                            ? 'bg-accent/15'
                            : 'bg-surface-card'
                        : 'hover:bg-surface-hover'
            }`}
            title={label}
            onClick={() => !disabled && onClick(id)}
            disabled={disabled}
        >
            {children}
        </button>
    )
}

export default function ToolSidebar({ activeTool = 'ai', onToolChange }: ToolSidebarProps) {
    const { theme, toggleTheme } = useThemeStore()
    const handleClick = (id: string) => onToolChange?.(id)
    const ic = (id: string) => activeTool === id ? (id === 'ai' ? 'text-accent' : 'text-text-primary') : 'text-text-secondary'

    return (
        <div className="flex flex-col items-center w-12 shrink-0 bg-surface-panel border-r border-border-subtle h-full">
            {/* Maige logo */}
            <div className="flex items-center justify-center mt-3 mb-2 rounded-lg font-bold text-base select-none cursor-default w-[34px] h-[34px] bg-accent/20 text-accent">
                M
            </div>

            {/* Divider */}
            <div className="w-6 h-px bg-border-base mb-2" />

            {/* Tool icons */}
            <div className="flex flex-col items-center gap-1">
                <ToolButton id="select" active={activeTool === 'select'} onClick={handleClick} label="Pointer (Pan & Zoom)">
                    <MousePointer2 size={18} className={ic('select')} />
                </ToolButton>
                <ToolButton id="crop" active={activeTool === 'crop'} onClick={handleClick} label="Crop">
                    <Crop size={18} className={ic('crop')} />
                </ToolButton>
                <ToolButton id="brush" active={activeTool === 'brush'} onClick={handleClick} label="Brush">
                    <Paintbrush size={18} className={ic('brush')} />
                </ToolButton>
                <ToolButton id="eraser" active={activeTool === 'eraser'} onClick={handleClick} label="Eraser">
                    <Eraser size={18} className={ic('eraser')} />
                </ToolButton>
                <ToolButton id="pen" active={activeTool === 'pen'} onClick={handleClick} label="Pen">
                    <PenTool size={18} className={ic('pen')} />
                </ToolButton>
                <ToolButton id="ai" active={activeTool === 'ai'} onClick={handleClick} label="AI Editor">
                    <Sparkles size={18} className={ic('ai')} />
                </ToolButton>
                <ToolButton id="text" active={activeTool === 'text'} onClick={handleClick} label="Text">
                    <Type size={18} className={ic('text')} />
                </ToolButton>
                <ToolButton id="layers" active={activeTool === 'layers'} onClick={handleClick} label="Layers">
                    <Layers size={18} className={ic('layers')} />
                </ToolButton>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Theme toggle */}
            <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-surface-hover transition-colors mb-2"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
                {theme === 'dark'
                    ? <Sun size={18} className="text-text-secondary" />
                    : <Moon size={18} className="text-text-secondary" />
                }
            </button>
        </div>
    )
}
