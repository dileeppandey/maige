import { ChevronDown } from 'lucide-react'

interface SectionHeaderProps {
  title: string
  collapsed?: boolean
  onToggle?: () => void
  action?: React.ReactNode
  className?: string
  uppercase?: boolean
}

export function SectionHeader({
  title,
  collapsed = false,
  onToggle,
  action,
  className = '',
  uppercase = true,
}: SectionHeaderProps) {
  const isCollapsible = onToggle !== undefined

  return (
    <div
      className={`
        flex items-center justify-between
        text-xs font-semibold text-text-muted
        ${uppercase ? 'uppercase tracking-wider' : ''}
        ${isCollapsible ? 'cursor-pointer select-none hover:text-text-secondary transition-colors' : ''}
        ${className}
      `}
      onClick={onToggle}
      role={isCollapsible ? 'button' : undefined}
      aria-expanded={isCollapsible ? !collapsed : undefined}
    >
      <span>{title}</span>
      <div className="flex items-center gap-1">
        {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
        {isCollapsible && (
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        )}
      </div>
    </div>
  )
}
