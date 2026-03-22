import { type ReactNode } from 'react'

interface NavItemProps {
  icon?: ReactNode
  label: string
  count?: number | string
  active?: boolean
  onClick?: () => void
  className?: string
  leftAccent?: boolean
  indent?: boolean
}

export function NavItem({
  icon,
  label,
  count,
  active = false,
  onClick,
  className = '',
  leftAccent = true,
  indent = false,
}: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-3 py-1.5 text-sm rounded-md
        cursor-pointer text-left transition-colors
        ${leftAccent ? `border-l-2 ${active ? 'border-accent' : 'border-transparent'}` : ''}
        ${indent ? 'pl-8' : ''}
        ${active
          ? 'bg-accent/15 text-accent'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
        }
        ${className}
      `}
    >
      {icon && (
        <span className={`shrink-0 ${active ? 'text-accent' : 'text-text-muted'}`}>
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className={`text-xs tabular-nums ${active ? 'text-accent/70' : 'text-text-faint'}`}>
          {count}
        </span>
      )}
    </button>
  )
}
