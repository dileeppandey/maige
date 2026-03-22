export type BadgeVariant = 'accent' | 'gray' | 'red' | 'green' | 'blue' | 'purple'
export type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  accent: 'bg-accent/15 text-accent border border-accent/40',
  gray: 'bg-surface-card text-text-secondary border border-border-base',
  red: 'bg-red-500/15 text-red-500 border border-red-500/40',
  green: 'bg-green-500/15 text-green-500 border border-green-500/40',
  blue: 'bg-blue-500/15 text-blue-400 border border-blue-500/40',
  purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/40',
}

const dotVariantClasses: Record<BadgeVariant, string> = {
  accent: 'bg-accent',
  gray: 'bg-text-muted',
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px] rounded gap-1',
  md: 'px-2 py-0.5 text-xs rounded-md gap-1.5',
}

export function Badge({ variant = 'gray', size = 'sm', children, className = '', dot = false }: BadgeProps) {
  return (
    <span className={`inline-flex items-center font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotVariantClasses[variant]}`} />}
      {children}
    </span>
  )
}
