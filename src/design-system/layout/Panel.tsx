import { type ReactNode } from 'react'

// ── Panel Root ──────────────────────────────────────────────────────────────
interface PanelProps {
  children: ReactNode
  className?: string
  border?: 'right' | 'left' | 'both' | 'none'
}

export function Panel({ children, className = '', border = 'right' }: PanelProps) {
  const borderClass = {
    right: 'border-r border-border-subtle',
    left: 'border-l border-border-subtle',
    both: 'border-x border-border-subtle',
    none: '',
  }[border]

  return (
    <div className={`h-full w-full flex flex-col bg-surface-panel ${borderClass} ${className}`}>
      {children}
    </div>
  )
}

// ── Panel Header ─────────────────────────────────────────────────────────────
interface PanelHeaderProps {
  children: ReactNode
  className?: string
  /** Height variant */
  size?: 'sm' | 'md' | 'lg'
  noBorder?: boolean
}

export function PanelHeader({ children, className = '', size = 'md', noBorder = false }: PanelHeaderProps) {
  const heightClass = { sm: 'h-8', md: 'h-10', lg: 'h-12' }[size]
  return (
    <div className={`
      flex items-center justify-between px-4 shrink-0
      ${heightClass}
      ${noBorder ? '' : 'border-b border-border-subtle'}
      ${className}
    `}>
      {children}
    </div>
  )
}

// ── Panel Title ───────────────────────────────────────────────────────────────
export function PanelTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`text-sm font-semibold text-text-primary ${className}`}>
      {children}
    </h2>
  )
}

// ── Panel Content ─────────────────────────────────────────────────────────────
interface PanelContentProps {
  children: ReactNode
  className?: string
  scrollable?: boolean
  padding?: 'none' | 'sm' | 'md'
}

export function PanelContent({ children, className = '', scrollable = true, padding = 'none' }: PanelContentProps) {
  const paddingClass = { none: '', sm: 'p-2', md: 'p-4' }[padding]
  return (
    <div className={`
      flex-1 min-h-0
      ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'}
      ${paddingClass}
      ${className}
    `}>
      {children}
    </div>
  )
}

// ── Panel Footer ──────────────────────────────────────────────────────────────
interface PanelFooterProps {
  children: ReactNode
  className?: string
  noBorder?: boolean
}

export function PanelFooter({ children, className = '', noBorder = false }: PanelFooterProps) {
  return (
    <div className={`
      px-3 py-2 shrink-0
      ${noBorder ? '' : 'border-t border-border-subtle'}
      ${className}
    `}>
      {children}
    </div>
  )
}

// ── Panel Section ─────────────────────────────────────────────────────────────
// For grouping related content within PanelContent
export function PanelSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-3 py-2 ${className}`}>
      {children}
    </div>
  )
}
