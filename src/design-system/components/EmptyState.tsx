interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: { icon: 'w-8 h-8', title: 'text-xs', desc: 'text-[11px]' },
  md: { icon: 'w-10 h-10', title: 'text-sm', desc: 'text-xs' },
  lg: { icon: 'w-12 h-12', title: 'text-base', desc: 'text-sm' },
}

export function EmptyState({ icon, title, description, action, className = '', size = 'md' }: EmptyStateProps) {
  const sc = sizeClasses[size]
  return (
    <div className={`flex flex-col items-center justify-center text-center p-6 h-full gap-2 ${className}`}>
      {icon && (
        <div className={`${sc.icon} text-text-faint opacity-60 flex items-center justify-center`}>
          {icon}
        </div>
      )}
      <p className={`font-medium text-text-muted ${sc.title}`}>{title}</p>
      {description && <p className={`text-text-faint ${sc.desc} max-w-[200px]`}>{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
