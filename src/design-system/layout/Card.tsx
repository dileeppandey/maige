import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  border?: boolean
  hoverable?: boolean
  onClick?: () => void
}

const paddingClasses = {
  none: '',
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
}

export function Card({ children, className = '', padding = 'md', border = true, hoverable = false, onClick }: CardProps) {
  return (
    <div
      className={`
        bg-surface-card rounded-lg
        ${border ? 'border border-border-subtle' : ''}
        ${hoverable ? 'cursor-pointer hover:bg-surface-hover transition-colors' : ''}
        ${paddingClasses[padding]}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
